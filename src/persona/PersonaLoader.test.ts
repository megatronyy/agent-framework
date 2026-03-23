/**
 * PersonaLoader unit tests
 */

import { describe, it, expect, beforeEach } from "vitest";
import { PersonaLoader } from "./PersonaLoader.js";
import type { PersonaConfig } from "./Persona.js";

describe("PersonaLoader", () => {
  let loader: PersonaLoader;

  beforeEach(() => {
    loader = new PersonaLoader("/mock/path");
  });

  describe("buildSystemPrompt", () => {
    it("should build prompt with identity", () => {
      const persona: PersonaConfig = {
        identity: {
          name: "TestBot",
          creature: "AI assistant",
          vibe: "helpful and friendly",
          emoji: "🤖",
        },
      };

      const prompt = loader.buildSystemPrompt(persona);
      expect(prompt).toContain("Your name is TestBot");
      expect(prompt).toContain("You are a AI assistant");
      expect(prompt).toContain("Your vibe: helpful and friendly");
      expect(prompt).toContain("Your signature emoji: 🤖");
    });

    it("should build prompt with soul", () => {
      const persona: PersonaConfig = {
        soul: {
          coreTruths: [
            "Be helpful",
            "Be resourceful",
          ],
          boundaries: [
            "Keep private things private",
            "Ask before external actions",
          ],
          vibe: "Concise and competent",
        },
      };

      const prompt = loader.buildSystemPrompt(persona);
      expect(prompt).toContain("## Core Truths");
      expect(prompt).toContain("- Be helpful");
      expect(prompt).toContain("## Boundaries");
      expect(prompt).toContain("- Keep private things private");
      expect(prompt).toContain("## Vibe");
      expect(prompt).toContain("Concise and competent");
    });

    it("should build prompt with tools", () => {
      const persona: PersonaConfig = {
        tools: {
          cameras: {
            "living-room": "Main area",
            "front-door": "Entrance",
          },
          ssh: {
            "home-server": "192.168.1.100",
          },
          tts: {
            preferredVoice: "Nova",
            defaultSpeaker: "Kitchen",
          },
        },
      };

      const prompt = loader.buildSystemPrompt(persona);
      expect(prompt).toContain("## Your Environment");
      expect(prompt).toContain("living-room, front-door");
      expect(prompt).toContain("home-server");
    });

    it("should return empty prompt for empty persona", () => {
      const prompt = loader.buildSystemPrompt({});
      expect(prompt).toBe("");
    });
  });

  describe("load", () => {
    it("should return empty config when no files exist", async () => {
      const config = await loader.load();
      expect(config).toEqual({});
    });
  });
});
