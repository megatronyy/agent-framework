/**
 * Subagent Registry
 *
 * Manages registration and lookup of specialized subagents.
 */

import type { Agent } from "../core/Agent.js";

/**
 * Subagent metadata
 */
export interface SubagentMetadata {
  id: string;
  name: string;
  description: string;
  agent: Agent;
  parentId?: string;
  createdAt: Date;
}

/**
 * Subagent registry configuration
 */
export interface SubagentRegistryConfig {
  maxSubagents?: number;
  allowDuplicateIds?: boolean;
}

/**
 * Registry for managing subagents
 */
export class SubagentRegistry {
  private subagents: Map<string, SubagentMetadata> = new Map();
  private config: Required<SubagentRegistryConfig>;

  constructor(config: SubagentRegistryConfig = {}) {
    this.config = {
      maxSubagents: config.maxSubagents ?? 100,
      allowDuplicateIds: config.allowDuplicateIds ?? false,
    };
  }

  /**
   * Register a subagent
   */
  register(metadata: Omit<SubagentMetadata, "createdAt">): void {
    const { id } = metadata;

    // Check for duplicate IDs
    if (!this.config.allowDuplicateIds && this.subagents.has(id)) {
      throw new Error(`Subagent with id '${id}' already exists`);
    }

    // Check max subagents limit
    if (this.subagents.size >= this.config.maxSubagents) {
      throw new Error(
        `Maximum subagents limit reached: ${this.config.maxSubagents}`
      );
    }

    this.subagents.set(id, {
      ...metadata,
      createdAt: new Date(),
    });
  }

  /**
   * Unregister a subagent
   */
  unregister(id: string): boolean {
    return this.subagents.delete(id);
  }

  /**
   * Get a subagent by ID
   */
  get(id: string): SubagentMetadata | undefined {
    return this.subagents.get(id);
  }

  /**
   * Get the Agent instance for a subagent
   */
  getAgent(id: string): Agent | undefined {
    return this.subagents.get(id)?.agent;
  }

  /**
   * Check if a subagent exists
   */
  has(id: string): boolean {
    return this.subagents.has(id);
  }

  /**
   * List all registered subagent IDs
   */
  list(): string[] {
    return Array.from(this.subagents.keys());
  }

  /**
   * List all subagent metadata
   */
  listMetadata(): SubagentMetadata[] {
    return Array.from(this.subagents.values());
  }

  /**
   * Get subagents by parent ID
   */
  getByParent(parentId: string): SubagentMetadata[] {
    return Array.from(this.subagents.values()).filter(
      (subagent) => subagent.parentId === parentId
    );
  }

  /**
   * Clear all registered subagents
   */
  clear(): void {
    this.subagents.clear();
  }

  /**
   * Get the count of registered subagents
   */
  get size(): number {
    return this.subagents.size;
  }
}
