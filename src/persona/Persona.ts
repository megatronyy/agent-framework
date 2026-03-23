/**
 * Persona types and interfaces
 */

export interface SoulConfig {
  coreTruths?: string[];
  boundaries?: string[];
  vibe?: string;
}

export interface IdentityConfig {
  name?: string;
  creature?: string;
  vibe?: string;
  emoji?: string;
  avatar?: string;
}

export interface ToolsConfig {
  cameras?: Record<string, string>;
  ssh?: Record<string, string>;
  tts?: {
    preferredVoice?: string;
    defaultSpeaker?: string;
  };
  devices?: Record<string, string>;
  notes?: Record<string, string>;
}

export interface HeartbeatTask {
  id: string;
  description: string;
  interval?: number; // minutes
  command?: string;
}

export interface PersonaConfig {
  soul?: SoulConfig;
  identity?: IdentityConfig;
  tools?: ToolsConfig;
  heartbeat?: HeartbeatTask[];
}

export interface PersonaFiles {
  soul?: string;
  identity?: string;
  tools?: string;
  heartbeat?: string;
}
