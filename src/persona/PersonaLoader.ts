/**
 * Persona file loader and parser
 */

import { promises as fs } from "node:fs";
import { join } from "node:path";
import type { PersonaConfig, PersonaFiles, SoulConfig, IdentityConfig, ToolsConfig, HeartbeatTask } from "./Persona.js";

export class PersonaLoader {
  private basePath: string;

  constructor(basePath: string = process.cwd()) {
    this.basePath = basePath;
  }

  async load(): Promise<PersonaConfig> {
    const files = await this.findPersonaFiles();

    return {
      soul: files.soul ? await this.parseSoul(files.soul) : undefined,
      identity: files.identity ? await this.parseIdentity(files.identity) : undefined,
      tools: files.tools ? await this.parseTools(files.tools) : undefined,
      heartbeat: files.heartbeat ? await this.parseHeartbeat(files.heartbeat) : undefined,
    };
  }

  private async findPersonaFiles(): Promise<PersonaFiles> {
    const files: PersonaFiles = {};

    // Check for each file in the workspace
    try {
      files.soul = await this.findFile("SOUL.md");
      files.identity = await this.findFile("IDENTITY.md");
      files.tools = await this.findFile("TOOLS.md");
      files.heartbeat = await this.findFile("HEARTBEAT.md");
    } catch {
      // Ignore errors
    }

    return files;
  }

  private async findFile(filename: string): Promise<string | undefined> {
    const paths = [
      join(this.basePath, filename),
      join(this.basePath, ".agent-framework", filename),
      join(this.basePath, ".agents", filename),
    ];

    for (const path of paths) {
      try {
        await fs.access(path);
        return path;
      } catch {
        continue;
      }
    }

    return undefined;
  }

  private async parseSoul(path: string): Promise<SoulConfig> {
    const content = await fs.readFile(path, "utf-8");
    const config: SoulConfig = {};

    // Parse core truths (lines starting with **)
    const coreTruthMatch = content.match(/\*\*Be (.*?)\.?\*\*\s*([^\n]+)/g);
    if (coreTruthMatch) {
      config.coreTruths = coreTruthMatch.map((truth) => truth.replace(/\*\*/g, "").trim());
    }

    // Parse boundaries
    const boundariesSection = content.match(/## Boundaries\n([\s\S]+?)(?=##|$)/);
    if (boundariesSection) {
      const boundaries = boundariesSection[1]
        .split("\n")
        .filter((line) => line.trim().startsWith("-"))
        .map((line) => line.replace(/^-\s*/, "").trim());
      config.boundaries = boundaries;
    }

    // Parse vibe
    const vibeMatch = content.match(/## Vibe\n([\s\S]+?)(?=##|$)/);
    if (vibeMatch) {
      config.vibe = vibeMatch[1].trim();
    }

    return config;
  }

  private async parseIdentity(path: string): Promise<IdentityConfig> {
    const content = await fs.readFile(path, "utf-8");
    const config: IdentityConfig = {};

    // Parse identity fields
    const nameMatch = content.match(/-\s*\*\*Name:\*\*\s*_([^_]+)_/);
    if (nameMatch) {
      config.name = nameMatch[1].trim();
    }

    const creatureMatch = content.match(/-\s*\*\*Creature:\*\*\s*_([^_]+)_/);
    if (creatureMatch) {
      config.creature = creatureMatch[1].trim();
    }

    const vibeMatch = content.match(/-\s*\*\*Vibe:\*\*\s*_([^_]+)_/);
    if (vibeMatch) {
      config.vibe = vibeMatch[1].trim();
    }

    const emojiMatch = content.match(/-\s*\*\*Emoji:\*\*\s*_([^_]+)_/);
    if (emojiMatch) {
      config.emoji = emojiMatch[1].trim();
    }

    const avatarMatch = content.match(/-\s*\*\*Avatar:\*\*\s*_([^_]+)_/);
    if (avatarMatch) {
      config.avatar = avatarMatch[1].trim();
    }

    return config;
  }

  private async parseTools(path: string): Promise<ToolsConfig> {
    const content = await fs.readFile(path, "utf-8");
    const config: ToolsConfig = {};

    // Parse sections
    const camerasMatch = content.match(/###? Cameras?\n([\s\S]+?)(?=###?|$)/);
    if (camerasMatch) {
      config.cameras = {};
      const lines = camerasMatch[1].split("\n").filter((line) => line.includes("→"));
      for (const line of lines) {
        const [name, desc] = line.split("→").map((s) => s.trim());
        if (name && desc) {
          config.cameras[name.replace(/^-/, "").trim()] = desc;
        }
      }
    }

    const sshMatch = content.match(/###? SSH\n([\s\S]+?)(?=###?|$)/);
    if (sshMatch) {
      config.ssh = {};
      const lines = sshMatch[1].split("\n").filter((line) => line.includes("→"));
      for (const line of lines) {
        const [name, desc] = line.split("→").map((s) => s.trim());
        if (name && desc) {
          config.ssh[name.replace(/^-/, "").trim()] = desc;
        }
      }
    }

    const ttsMatch = content.match(/###? TTS\n([\s\S]+?)(?=###?|$)/);
    if (ttsMatch) {
      config.tts = {};
      const voiceMatch = ttsMatch[1].match(/Preferred voice:\s*"([^"]+)"/);
      if (voiceMatch) {
        config.tts.preferredVoice = voiceMatch[1];
      }
      const speakerMatch = ttsMatch[1].match(/Default speaker:\s*([^\n]+)/);
      if (speakerMatch) {
        config.tts.defaultSpeaker = speakerMatch[1].trim();
      }
    }

    return config;
  }

  private async parseHeartbeat(path: string): Promise<HeartbeatTask[]> {
    const content = await fs.readFile(path, "utf-8");
    const tasks: HeartbeatTask[] = [];

    // Each line is a potential task
    const lines = content.split("\n").filter((line) => line.trim() && !line.trim().startsWith("#"));

    for (const line of lines) {
      const task: HeartbeatTask = {
        id: Math.random().toString(36).slice(2, 9),
        description: line.trim(),
      };
      tasks.push(task);
    }

    return tasks;
  }

  buildSystemPrompt(persona: PersonaConfig): string {
    const parts: string[] = [];

    // Add identity
    if (persona.identity) {
      const id = persona.identity;
      if (id.name) {
        parts.push(`Your name is ${id.name}.`);
      }
      if (id.creature) {
        parts.push(`You are a ${id.creature}.`);
      }
      if (id.vibe) {
        parts.push(`Your vibe: ${id.vibe}`);
      }
      if (id.emoji) {
        parts.push(`Your signature emoji: ${id.emoji}`);
      }
    }

    // Add soul
    if (persona.soul) {
      const soul = persona.soul;
      if (soul.coreTruths && soul.coreTruths.length > 0) {
        parts.push("\n## Core Truths");
        for (const truth of soul.coreTruths) {
          parts.push(`- ${truth}`);
        }
      }
      if (soul.boundaries && soul.boundaries.length > 0) {
        parts.push("\n## Boundaries");
        for (const boundary of soul.boundaries) {
          parts.push(`- ${boundary}`);
        }
      }
      if (soul.vibe) {
        parts.push(`\n## Vibe\n${soul.vibe}`);
      }
    }

    // Add tools reference
    if (persona.tools) {
      parts.push("\n## Your Environment");
      if (persona.tools.cameras) {
        parts.push(`You have access to these cameras: ${Object.keys(persona.tools.cameras).join(", ")}`);
      }
      if (persona.tools.ssh) {
        parts.push(`You can SSH to these hosts: ${Object.keys(persona.tools.ssh).join(", ")}`);
      }
    }

    return parts.join("\n");
  }
}
