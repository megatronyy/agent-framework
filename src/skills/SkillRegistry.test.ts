/**
 * SkillRegistry unit tests
 */

import { describe, it, expect, beforeEach } from "vitest";
import { SkillRegistry } from "./SkillRegistry.js";
import { parseSkill, buildSkillsPrompt } from "./SkillParser.js";

describe("SkillRegistry", () => {
  let registry: SkillRegistry;

  beforeEach(() => {
    registry = new SkillRegistry({
      skillPaths: [],
      includeDisabled: false,
    });
  });

  describe("parseSkill", () => {
    it("should parse valid skill content", () => {
      const content = `---
name: test-skill
description: A test skill
---

# Test Skill

This is a test skill.`;

      const skill = parseSkill(content, "/path/to/test-skill/SKILL.md");
      expect(skill).not.toBeNull();
      expect(skill?.name).toBe("test-skill");
      expect(skill?.description).toBe("A test skill");
    });

    it("should return null for content without frontmatter", () => {
      const content = `# Just content
No frontmatter here.`;

      const skill = parseSkill(content, "/path/to/SKILL.md");
      expect(skill).toBeNull();
    });

    it("should return null for skill without name", () => {
      const content = `---
description: A test skill
---

# Test`;

      const skill = parseSkill(content, "/path/to/SKILL.md");
      expect(skill).toBeNull();
    });

    it("should return null for skill without description", () => {
      const content = `---
name: test-skill
---

# Test`;

      const skill = parseSkill(content, "/path/to/SKILL.md");
      expect(skill).toBeNull();
    });
  });

  describe("buildSkillsPrompt", () => {
    it("should build XML skills prompt", () => {
      const skills = [
        {
          name: "test-skill",
          description: "A test skill",
          content: "# Test",
          path: "/path/to/test-skill/SKILL.md",
          frontmatter: {
            name: "test-skill",
            description: "A test skill",
          },
        },
      ];

      const prompt = buildSkillsPrompt(skills);
      expect(prompt).toContain("<skills>");
      expect(prompt).toContain('name="test-skill"');
      expect(prompt).toContain("A test skill");
      expect(prompt).toContain("</skills>");
    });

    it("should return empty string for no skills", () => {
      const prompt = buildSkillsPrompt([]);
      expect(prompt).toBe("");
    });
  });

  describe("SkillRegistry", () => {
    it("should initialize with default skill paths", () => {
      const reg = new SkillRegistry();
      expect(reg).toBeDefined();
    });

    it("should return empty list initially", () => {
      expect(registry.list()).toEqual([]);
    });

    it("should return undefined for non-existent skill", () => {
      expect(registry.get("non-existent")).toBeUndefined();
    });

    it("should report size correctly", () => {
      expect(registry.size()).toBe(0);
    });

    it("should clear all skills", () => {
      registry.clear();
      expect(registry.size()).toBe(0);
    });
  });
});
