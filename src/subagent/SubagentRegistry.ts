/**
 * Subagent Registry
 *
 * Manages registered subagents and their handoff configurations.
 */

import type { SubagentConfig, SubagentHandoff } from "../types.js";

/**
 * Registry for managing subagents
 */
export class SubagentRegistry {
  private subagents: Record<string, SubagentConfig> = {};

  /**
   * Register a subagent
   */
  register(config: SubagentConfig): void {
    this.subagents[config.id] = config;
  }

  /**
   * Unregister a subagent
   */
  unregister(id: string): boolean {
    if (id in this.subagents) {
      delete this.subagents[id];
      return true;
    }
    return false;
  }

  /**
   * Get a subagent by ID
   */
  get(id: string): SubagentConfig | undefined {
    return this.subagents[id];
  }

  /**
   * List all registered subagents
   */
  list(): SubagentConfig[] {
    return Object.values(this.subagents);
  }

  /**
   * Check if a subagent exists
   */
  has(id: string): boolean {
    return id in this.subagents;
  }

  /**
   * Find subagent by name
   */
  findByName(name: string): SubagentConfig | undefined {
    return Object.values(this.subagents).find((s) => s.name === name);
  }

  /**
   * Find subagent that should handle a message based on handoff keywords
   */
  findHandoffTarget(message: string): SubagentConfig | null {
    const lowerMessage = message.toLowerCase();

    for (const subagent of Object.values(this.subagents)) {
      if (subagent.handoff) {
        for (const handoff of subagent.handoff) {
          if (handoff.keywords.some((keyword) => lowerMessage.includes(keyword.toLowerCase()))) {
            return subagent;
          }
        }
      }
    }

    return null;
  }

  /**
   * Get handoff configuration for a subagent
   */
  getHandoffConfig(subagentId: string): SubagentHandoff | null {
    const subagent = this.get(subagentId);
    if (!subagent?.handoff || subagent.handoff.length === 0) {
      return null;
    }

    // Return first handoff config as a template
    const handoff = subagent.handoff[0];
    if (handoff) {
      return {
        targetSubagentId: handoff.targetSubagentId,
        reason: `Handoff based on keywords: ${handoff.keywords.join(", ")}`,
        context: {},
      };
    }

    return null;
  }

  /**
   * Clear all registered subagents
   */
  clear(): void {
    this.subagents = {};
  }
}
