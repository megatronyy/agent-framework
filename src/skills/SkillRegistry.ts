/**
 * Skill registry and loader
 */

import { promises as fs } from "node:fs";
import { join } from "node:path";
import type { Skill, SkillManifest } from "./Skill.js";
import { parseSkill, buildSkillsPrompt } from "./SkillParser.js";

export interface SkillRegistryOptions {
  skillPaths?: string[];
  includeDisabled?: boolean;
}

export class SkillRegistry {
  private skills: Map<string, Skill>;
  private skillPaths: string[];
  private includeDisabled: boolean;
  private manifest: SkillManifest | null;

  constructor(options: SkillRegistryOptions = {}) {
    this.skills = new Map();
    this.skillPaths = options.skillPaths ?? this.getDefaultSkillPaths();
    this.includeDisabled = options.includeDisabled ?? false;
    this.manifest = null;
  }

  private getDefaultSkillPaths(): string[] {
    const paths: string[] = [];

    // Global skill paths
    if (process.env.HOME) {
      paths.push(
        join(process.env.HOME, ".agent-framework", "skills"),
        join(process.env.HOME, ".agents", "skills")
      );
    }

    // Current working directory skills
    paths.push(join(process.cwd(), ".agent-framework", "skills"));
    paths.push(join(process.cwd(), ".agents", "skills"));

    return paths;
  }

  async load(): Promise<SkillManifest> {
    this.skills.clear();

    for (const skillPath of this.skillPaths) {
      await this.loadFromPath(skillPath);
    }

    this.manifest = {
      skills: Array.from(this.skills.values()),
      loadedAt: Date.now(),
      source: this.skillPaths.join(","),
    };

    return this.manifest;
  }

  private async loadFromPath(basePath: string): Promise<void> {
    try {
      const stat = await fs.stat(basePath);
      if (!stat.isDirectory()) {
        return;
      }
    } catch {
      // Path doesn't exist, skip
      return;
    }

    // Load direct SKILL.md files
    await this.loadSkillFiles(basePath);

    // Load from subdirectories
    const entries = await fs.readdir(basePath, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        await this.loadFromPath(join(basePath, entry.name));
      }
    }
  }

  private async loadSkillFiles(path: string): Promise<void> {
    try {
      const entries = await fs.readdir(path);

      for (const entry of entries) {
        if (entry === "SKILL.md") {
          await this.loadSkillFile(join(path, entry));
        } else if (entry.endsWith(".md")) {
          await this.loadSkillFile(join(path, entry));
        }
      }
    } catch {
      // Directory doesn't exist or isn't readable
    }
  }

  private async loadSkillFile(filePath: string): Promise<void> {
    try {
      const content = await fs.readFile(filePath, "utf-8");
      const skill = parseSkill(content, filePath);

      if (skill) {
        // Skip disabled skills unless includeDisabled is true
        if (skill.frontmatter.disableModelInvocation && !this.includeDisabled) {
          return;
        }

        // Skip duplicates (first one wins)
        if (!this.skills.has(skill.name)) {
          this.skills.set(skill.name, skill);
        }
      }
    } catch {
      // File doesn't exist or isn't readable
    }
  }

  get(name: string): Skill | undefined {
    return this.skills.get(name);
  }

  list(): Skill[] {
    return Array.from(this.skills.values());
  }

  getManifest(): SkillManifest | null {
    return this.manifest;
  }

  buildPrompt(): string {
    return buildSkillsPrompt(this.list());
  }

  has(name: string): boolean {
    return this.skills.has(name);
  }

  size(): number {
    return this.skills.size;
  }

  clear(): void {
    this.skills.clear();
    this.manifest = null;
  }
}
