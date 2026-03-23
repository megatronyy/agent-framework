/**
 * Skill frontmatter parser
 */

import type { Skill, SkillFrontmatter } from "./Skill.js";

const FRONTMATTER_REGEX = /^---\s*\n([\s\S]+?)\n---\s*\n([\s\S]*)$/;

function parseFrontmatter(rawFrontmatter: string): SkillFrontmatter {
  const lines = rawFrontmatter.split("\n");
  const frontmatter: Record<string, unknown> = {};

  for (const line of lines) {
    const match = line.match(/^(\w+):\s*(.+)$/);
    if (match) {
      const [, key, value] = match;
      const trimmedValue = value.trim();

      // Handle boolean values
      if (trimmedValue === "true") {
        frontmatter[key] = true;
      } else if (trimmedValue === "false") {
        frontmatter[key] = false;
      }
      // Handle array values (comma-separated)
      else if (trimmedValue.includes(", ")) {
        frontmatter[key] = trimmedValue.split(", ").map((v) => v.trim());
      }
      // Handle string values
      else {
        frontmatter[key] = trimmedValue.replace(/^["']|["']$/g, "");
      }
    }
  }

  return {
    name: String(frontmatter.name || ""),
    description: String(frontmatter.description || ""),
    license: typeof frontmatter.license === "string" ? frontmatter.license : undefined,
    compatibility: typeof frontmatter.compatibility === "string" ? frontmatter.compatibility : undefined,
    metadata: typeof frontmatter.metadata === "object" && !Array.isArray(frontmatter.metadata)
      ? frontmatter.metadata as Record<string, unknown>
      : undefined,
    allowedTools: typeof frontmatter.allowedTools === "string" ? frontmatter.allowedTools : undefined,
    disableModelInvocation: frontmatter.disableModelInvocation === true,
  };
}

export function parseSkill(content: string, path: string): Skill | null {
  const match = content.match(FRONTMATTER_REGEX);
  if (!match) {
    return null;
  }

  const [, rawFrontmatter, body] = match;
  const frontmatter = parseFrontmatter(rawFrontmatter);

  // Validate required fields
  if (!frontmatter.name || !frontmatter.description) {
    return null;
  }

  // Validate name format (lowercase, hyphens, numbers)
  if (!/^[a-z0-9-]+$/.test(frontmatter.name)) {
    return null;
  }

  // Name must match parent directory
  const dirName = path.split("/").at(-2);
  if (dirName && dirName !== frontmatter.name) {
    return null;
  }

  return {
    name: frontmatter.name,
    description: frontmatter.description,
    content: body.trim(),
    path,
    frontmatter,
  };
}

export function buildSkillsPrompt(skills: Skill[]): string {
  if (skills.length === 0) {
    return "";
  }

  const lines: string[] = ["<skills>"];

  for (const skill of skills) {
    lines.push(`  <skill name="${skill.name}">`);
    lines.push(`    <description>${escapeXml(skill.description)}</description>`);
    lines.push(`  </skill>`);
  }

  lines.push("</skills>");
  lines.push("");
  lines.push(
    "When a task matches a skill, use `/skill:<name>` to load it. " +
    "Skills provide specialized instructions and tools for specific tasks."
  );

  return lines.join("\n");
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
