/**
 * Handoff Mechanism
 *
 * Manages transfer of control between agents with context preservation.
 */

import type { Agent } from "../core/Agent.js";
import type { SubagentMetadata } from "./registry.js";

/**
 * Handoff context
 */
export interface HandoffContext {
  fromAgentId: string;
  toAgentId: string;
  conversationHistory: Array<{
    role: "user" | "assistant" | "system";
    content: string;
    timestamp: Date;
  }>;
  metadata?: Record<string, unknown>;
  handoffReason?: string;
}

/**
 * Handoff result
 */
export interface HandoffResult {
  success: boolean;
  context?: HandoffContext;
  error?: string;
}

/**
 * Handoff strategy
 */
export type HandoffStrategy =
  | "immediate" // Transfer immediately
  | "await_confirmation" // Wait for user confirmation
  | "conditional"; // Transfer based on conditions

/**
 * Handoff configuration
 */
export interface HandoffConfig {
  strategy: HandoffStrategy;
  preserveContext: boolean;
  maxHistoryLength?: number;
  timeoutMs?: number;
}

/**
 * Default handoff configuration
 */
const defaultHandoffConfig: Required<HandoffConfig> = {
  strategy: "immediate",
  preserveContext: true,
  maxHistoryLength: 100,
  timeoutMs: 5000,
};

/**
 * Handoff manager for agent control transfer
 */
export class HandoffManager {
  private pendingHandoffs: Map<string, HandoffContext> = new Map();
  private handoffHistory: HandoffContext[] = [];

  /**
   * Initiate a handoff from one agent to another
   */
  async initiateHandoff(
    fromAgent: Agent | SubagentMetadata,
    toAgent: Agent | SubagentMetadata,
    conversationHistory: HandoffContext["conversationHistory"],
    config?: Partial<HandoffConfig>
  ): Promise<HandoffResult> {
    const opts = { ...defaultHandoffConfig, ...config };

    const fromId = "agent" in fromAgent ? fromAgent.agent.id : fromAgent.id;
    const toId = "agent" in toAgent ? toAgent.agent.id : toAgent.id;

    // Prepare context
    const context: HandoffContext = {
      fromAgentId: fromId,
      toAgentId: toId,
      conversationHistory: opts.preserveContext
        ? this.truncateHistory(conversationHistory, opts.maxHistoryLength!)
        : [],
      handoffReason: this.determineHandoffReason(fromAgent, toAgent),
    };

    try {
      switch (opts.strategy) {
        case "immediate":
          return this.executeImmediateHandoff(context);

        case "await_confirmation":
          return this.awaitConfirmationHandoff(context, opts.timeoutMs!);

        case "conditional":
          return this.executeConditionalHandoff(context);

        default:
          return {
            success: false,
            error: `Unknown handoff strategy: ${opts.strategy}`,
          };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Confirm a pending handoff
   */
  confirmHandoff(handoffId: string): HandoffResult {
    const context = this.pendingHandoffs.get(handoffId);
    if (!context) {
      return {
        success: false,
        error: `No pending handoff found with id: ${handoffId}`,
      };
    }

    this.pendingHandoffs.delete(handoffId);
    this.recordHandoff(context);

    return {
      success: true,
      context,
    };
  }

  /**
   * Reject a pending handoff
   */
  rejectHandoff(handoffId: string): HandoffResult {
    const context = this.pendingHandoffs.get(handoffId);
    if (!context) {
      return {
        success: false,
        error: `No pending handoff found with id: ${handoffId}`,
      };
    }

    this.pendingHandoffs.delete(handoffId);

    return {
      success: true,
    };
  }

  /**
   * Get pending handoffs
   */
  getPendingHandoffs(): HandoffContext[] {
    return Array.from(this.pendingHandoffs.values());
  }

  /**
   * Get handoff history
   */
  getHandoffHistory(limit?: number): HandoffContext[] {
    if (limit) {
      return this.handoffHistory.slice(-limit);
    }
    return [...this.handoffHistory];
  }

  /**
   * Clear handoff history
   */
  clearHistory(): void {
    this.handoffHistory = [];
  }

  /**
   * Execute immediate handoff
   */
  private executeImmediateHandoff(context: HandoffContext): HandoffResult {
    this.recordHandoff(context);
    return {
      success: true,
      context,
    };
  }

  /**
   * Execute confirmation-required handoff
   */
  private async awaitConfirmationHandoff(
    context: HandoffContext,
    timeout: number
  ): Promise<HandoffResult> {
    const handoffId = `${context.fromAgentId}-${context.toAgentId}-${Date.now()}`;
    this.pendingHandoffs.set(handoffId, context);

    // In a real implementation, this would wait for user confirmation
    // For now, we'll simulate immediate confirmation
    return new Promise((resolve) => {
      setTimeout(() => {
        if (this.pendingHandoffs.has(handoffId)) {
          resolve({
            success: false,
            error: "Handoff confirmation timeout",
          });
        } else {
          resolve({
            success: true,
            context,
          });
        }
      }, timeout);
    });
  }

  /**
   * Execute conditional handoff
   */
  private executeConditionalHandoff(context: HandoffContext): HandoffResult {
    // Check if handoff conditions are met
    const conditionsMet = this.evaluateHandoffConditions(context);

    if (conditionsMet) {
      this.recordHandoff(context);
      return {
        success: true,
        context,
      };
    }

    return {
      success: false,
      error: "Handoff conditions not met",
    };
  }

  /**
   * Determine handoff reason based on agent capabilities
   */
  private determineHandoffReason(
    fromAgent: Agent | SubagentMetadata,
    toAgent: Agent | SubagentMetadata
  ): string {
    const fromName = "agent" in fromAgent ? fromAgent.agent.name : fromAgent.name;
    const toName = "agent" in toAgent ? toAgent.agent.name : toAgent.name;

    return `Transferring from ${fromName} to ${toName} for specialized handling`;
  }

  /**
   * Evaluate if handoff conditions are met
   */
  private evaluateHandoffConditions(_context: HandoffContext): boolean {
    // For now, always return true
    // In a real implementation, this would check various conditions
    return true;
  }

  /**
   * Truncate conversation history to max length
   */
  private truncateHistory(
    history: HandoffContext["conversationHistory"],
    maxLength: number
  ): HandoffContext["conversationHistory"] {
    if (history.length <= maxLength) {
      return history;
    }
    return history.slice(-maxLength);
  }

  /**
   * Record a handoff in history
   */
  private recordHandoff(context: HandoffContext): void {
    this.handoffHistory.push({
      ...context,
      metadata: {
        ...context.metadata,
        timestamp: new Date(),
      },
    });
  }
}
