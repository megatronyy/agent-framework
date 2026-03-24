/**
 * Subagent Executor
 *
 * Executes subagents with isolated context and error handling.
 */

import type { Agent } from "../core/Agent.js";
import type { SubagentMetadata } from "./registry.js";

/**
 * Subagent execution options
 */
export interface SubagentExecutionOptions {
  timeout?: number;
  maxTurns?: number;
  inputSchema?: Record<string, unknown>;
  returnIntermediateSteps?: boolean;
}

/**
 * Subagent execution result
 */
export interface SubagentExecutionResult {
  success: boolean;
  output?: string;
  error?: string;
  steps?: Array<{
    type: "tool_call" | "response" | "error";
    content: string;
    timestamp: Date;
  }>;
  duration: number;
  tokensUsed?: number;
}

/**
 * Executor for running subagents
 */
export class SubagentExecutor {
  private defaultOptions: Required<SubagentExecutionOptions> = {
    timeout: 30000,
    maxTurns: 10,
    inputSchema: {},
    returnIntermediateSteps: false,
  };

  constructor(options?: Partial<SubagentExecutionOptions>) {
    if (options) {
      this.defaultOptions = { ...this.defaultOptions, ...options };
    }
  }

  /**
   * Execute a subagent with the given input
   */
  async execute(
    subagent: SubagentMetadata,
    input: string,
    options?: Partial<SubagentExecutionOptions>
  ): Promise<SubagentExecutionResult> {
    const startTime = Date.now();
    const opts = { ...this.defaultOptions, ...options };
    const steps: SubagentExecutionResult["steps"] = [];

    try {
      // Create execution context
      const context = this.createExecutionContext(subagent, input);

      // Execute with timeout
      const result = await this.executeWithTimeout(
        subagent.agent,
        context,
        opts.timeout
      );

      const duration = Date.now() - startTime;

      return {
        success: true,
        output: result,
        steps: opts.returnIntermediateSteps ? steps : undefined,
        duration,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      steps.push({
        type: "error",
        content: errorMessage,
        timestamp: new Date(),
      });

      return {
        success: false,
        error: errorMessage,
        steps: opts.returnIntermediateSteps ? steps : undefined,
        duration,
      };
    }
  }

  /**
   * Execute multiple subagents in parallel
   */
  async executeParallel(
    executions: Array<{
      subagent: SubagentMetadata;
      input: string;
      options?: Partial<SubagentExecutionOptions>;
    }>
  ): Promise<SubagentExecutionResult[]> {
    return Promise.all(
      executions.map((exec) =>
        this.execute(exec.subagent, exec.input, exec.options)
      )
    );
  }

  /**
   * Execute subagents sequentially with output chaining
   */
  async executeChain(
    executions: Array<{
      subagent: SubagentMetadata;
      input?: string; // If omitted, uses previous output
      options?: Partial<SubagentExecutionOptions>;
    }>
  ): Promise<SubagentExecutionResult[]> {
    const results: SubagentExecutionResult[] = [];
    let lastOutput = "";

    for (const exec of executions) {
      const input = exec.input ?? lastOutput;
      if (!input) {
        results.push({
          success: false,
          error: "No input provided for chained execution",
          duration: 0,
        });
        continue;
      }

      const result = await this.execute(
        exec.subagent,
        input,
        exec.options
      );
      results.push(result);

      if (result.success && result.output) {
        lastOutput = result.output;
      } else {
        // Stop chain on failure
        break;
      }
    }

    return results;
  }

  /**
   * Create execution context for a subagent
   */
  private createExecutionContext(
    subagent: SubagentMetadata,
    input: string
  ): string {
    // Create a context string that includes subagent info
    return `You are ${subagent.name}, a specialized subagent.

${subagent.description}

User input: ${input}`;
  }

  /**
   * Execute agent with timeout
   */
  private async executeWithTimeout(
    agent: Agent,
    context: string,
    timeout: number
  ): Promise<string> {
    // For now, we'll use a simple timeout wrapper
    // In a real implementation, this would integrate with the Agent's execution model
    return Promise.race([
      this.runAgent(agent, context),
      new Promise<string>((_, reject) =>
        setTimeout(() => reject(new Error("Execution timeout")), timeout)
      ),
    ]);
  }

  /**
   * Run the agent (placeholder for actual agent execution)
   */
  private async runAgent(agent: Agent, context: string): Promise<string> {
    // This is a simplified implementation
    // The actual implementation would call agent.processMessage() or similar
    return `[Agent execution for ${agent.id}]`;
  }
}
