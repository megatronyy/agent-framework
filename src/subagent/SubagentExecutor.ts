/**
 * Subagent Executor
 *
 * Executes tasks using subagents with delegation and handoff support.
 */

import type {
  AgentRunOptions,
  SubagentHandoff,
} from "../types.js";

import type { Agent } from "./SubagentTool.js";

/**
 * Result of a subagent execution with handoff info
 */
export interface SubagentExecutionResult {
  subagentId: string;
  response: string;
  toolExecutions: unknown[];
  usage?: unknown;
  metadata?: Record<string, unknown>;
  wasHandedOff?: boolean;
  handoffChain?: string[];
}

/**
 * Executor for running subagents
 */
export class SubagentExecutor {
  private agents: Record<string, Agent> = {};
  private handoffChain: string[] = [];

  constructor(_mainAgent: Agent) {}

  /**
   * Register an agent for a subagent
   */
  registerAgent(subagentId: string, agent: Agent): void {
    this.agents[subagentId] = agent;
  }

  /**
   * Get agent for a subagent
   */
  getAgent(subagentId: string): Agent | undefined {
    return this.agents[subagentId];
  }

  /**
   * Execute a task on a subagent
   */
  async execute(
    subagentId: string,
    message: string,
    options?: Partial<AgentRunOptions>
  ): Promise<SubagentExecutionResult> {
    const agent = this.agents[subagentId];
    if (!agent) {
      throw new Error(`No agent registered for subagent: ${subagentId}`);
    }

    const startTime = Date.now();

    try {
      const result = await agent.run({
        message,
        sessionId: options?.sessionId,
        metadata: {
          ...options?.metadata,
          subagentId,
          handoffChain: this.handoffChain,
        },
      });

      return {
        subagentId,
        response: result.response,
        toolExecutions: result.toolExecutions || [],
        usage: result.usage,
        metadata: {
          ...result.metadata,
          durationMs: Date.now() - startTime,
        },
      };
    } catch (error) {
      return {
        subagentId,
        response: `Error: ${error instanceof Error ? error.message : String(error)}`,
        toolExecutions: [],
        metadata: {
          error: error instanceof Error ? error.message : String(error),
          durationMs: Date.now() - startTime,
        },
      };
    }
  }

  /**
   * Execute with automatic handoff
   */
  async executeWithHandoff(
    subagentId: string,
    message: string,
    onHandoff?: (handoff: SubagentHandoff) => void,
    options?: Partial<AgentRunOptions>
  ): Promise<SubagentExecutionResult> {
    this.handoffChain = [subagentId];
    let currentSubagentId = subagentId;
    let maxHandoffs = 5; // Prevent infinite loops
    const results: SubagentExecutionResult[] = [];

    while (maxHandoffs-- > 0) {
      const result = await this.execute(currentSubagentId, message, options);
      results.push(result);

      // Check if response indicates a handoff is needed
      const handoff = this.detectHandoffNeeded(result.response);
      if (handoff) {
        onHandoff?.(handoff);
        currentSubagentId = handoff.targetSubagentId;
        this.handoffChain.push(currentSubagentId);
        result.wasHandedOff = true;
        result.handoffChain = [...this.handoffChain];
        message = `[Handed off from ${this.handoffChain[this.handoffChain.length - 2]}]: ${message}`;
        continue;
      }

      // Return the final result
      result.handoffChain = [...this.handoffChain];
      return result;
    }

    // Max handoffs reached
    const lastResult = results[results.length - 1];
    return {
      ...lastResult,
      response: `Maximum handoff limit reached. Last response: ${lastResult.response}`,
      handoffChain: [...this.handoffChain],
    };
  }

  /**
   * Detect if a handoff is needed based on response
   */
  private detectHandoffNeeded(response: string): SubagentHandoff | null {
    // Check for handoff patterns

    // Check for handoff patterns
    const handoffPatterns = [
      /(?:i\s+(?:can't|cannot)|need\s+to)\s+(?:handle|help\s+with)\s+(?:this|that)/i,
      /(?:please|can\s+you)\s+(?:transfer|handoff|escalate)/i,
      /outside\s+(?:my\s+)?(?:scope|expertise|ability)/i,
      /not\s+(?:qualified|equipped|able)\s+to/i,
    ];

    for (const pattern of handoffPatterns) {
      if (pattern.test(response)) {
        // Try to extract target from response
        const targetMatch = response.match(/(?:to|with)\s+([a-z_][a-z0-9_]*)/i);
        if (targetMatch) {
          return {
            targetSubagentId: targetMatch[1].toLowerCase().replace(/\s+/g, "_"),
            reason: "Handoff requested by subagent",
            context: { originalResponse: response },
          };
        }
      }
    }

    return null;
  }

  /**
   * Execute multiple subagents in parallel
   */
  async executeParallel(
    tasks: Array<{ subagentId: string; message: string }>
  ): Promise<SubagentExecutionResult[]> {
    const results = await Promise.all(
      tasks.map((task) =>
        this.execute(task.subagentId, task.message).catch((error) => ({
          subagentId: task.subagentId,
          response: `Error: ${error.message}`,
          toolExecutions: [],
          metadata: { error: error.message },
        }))
      )
    );

    return results;
  }

  /**
   * Execute subagents sequentially with context sharing
   */
  async executeSequential(
    tasks: Array<{ subagentId: string; message: string }>
  ): Promise<SubagentExecutionResult[]> {
    const results: SubagentExecutionResult[] = [];
    let sharedContext = "";

    for (const task of tasks) {
      const messageWithContext = sharedContext
        ? `${task.message}\n\nPrevious context:\n${sharedContext}`
        : task.message;

      const result = await this.execute(task.subagentId, messageWithContext);
      results.push(result);

      // Build shared context for next subagent
      sharedContext += `[${task.subagentId}]: ${result.response}\n\n`;
    }

    return results;
  }

  /**
   * Clear handoff chain
   */
  clearHandoffChain(): void {
    this.handoffChain = [];
  }
}
