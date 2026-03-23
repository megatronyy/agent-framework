/**
 * Skill types and interfaces
 */

export interface SkillFrontmatter {
  name: string;
  description: string;
  license?: string;
  compatibility?: string;
  metadata?: Record<string, unknown>;
  allowedTools?: string;
  disableModelInvocation?: boolean;
}

export interface Skill {
  name: string;
  description: string;
  content: string;
  path: string;
  frontmatter: SkillFrontmatter;
  metadata?: Record<string, unknown>;
}

export interface SkillLoadOptions {
  includeDisabled?: boolean;
  patterns?: string[];
}

export interface SkillManifest {
  skills: Skill[];
  loadedAt: number;
  source: string;
}
