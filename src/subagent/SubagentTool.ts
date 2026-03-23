/**
 * Subagent Tool
 *
 * Tool that allows agents to delegate tasks to subagents.
 */

import type { Tool, ToolResult, ToolContext } from "../types.js";

// Agent interface - minimal subset needed
export interface Agent {
  id: string;
  config: { id: string };
  run(options: { message: string; sessionId?: string; metadata?: Record<string, unknown> }): Promise<{
    response: string;
    toolExecutions?: unknown[];
    usage?: unknown;
    metadata?: Record<string, unknown>;
  }>;
}
import { SubagentExecutor } from "./SubagentExecutor.js";

// Global executor registry (one per main agent)
const executorRegistry = new WeakMap<object, SubagentExecutor>();

/**
 * Get or create executor for an agent
 */
function getExecutor(mainAgent: Agent): SubagentExecutor {
  let executor = executorRegistry.get(mainAgent);
  if (!executor) {
    executor = new SubagentExecutor(mainAgent);
    executorRegistry.set(mainAgent, executor);
  }
  return executor;
}

/**
 * Create a subagent delegation tool
 */
export function createSubagentTool(mainAgent: Agent): Tool {
  return {
    name: "delegate_to_subagent",
    description: `Delegate a task to a specialized subagent. Use this when:
- The task requires specific expertise or capabilities
- The task is complex and would benefit from specialization
- You need to hand off to another agent with different tools

Available subagents will be managed by the system. The response will include the subagent's answer.`,
    inputSchema: {
      type: "object",
      properties: {
        subagentId: {
          type: "string",
          description: "ID of the subagent to delegate to",
        },
        task: {
          type: "string",
          description: "Task description or message for the subagent",
        },
        parallel: {
          type: "boolean",
          description: "If delegating multiple tasks, execute in parallel (default: false)",
          default: false,
        },
        tasks: {
          type: "array",
          description: "Multiple tasks to delegate (for parallel/sequential execution)",
          items: {
            type: "object",
            properties: {
              subagentId: { type: "string" },
              task: { type: "string" },
            },
            required: ["subagentId", "task"],
          },
        },
      },
      required: [],
    },
    handler: async ({ input, context }: { input: Record<string, unknown>; context: ToolContext }): Promise<ToolResult> => {
      const executor = getExecutor(mainAgent);

      // Handle single task delegation
      if (input.task && typeof input.task === "string" && input.subagentId && typeof input.subagentId === "string") {
        const result = await executor.execute(input.subagentId, input.task, {
          sessionId: context.sessionId,
        });

        return {
          content: JSON.stringify({
            success: true,
            subagentId: result.subagentId,
            response: result.response,
            toolExecutions: result.toolExecutions.length,
            usage: result.usage,
            metadata: result.metadata,
          }, null, 2),
          metadata: {
            subagentId: result.subagentId,
            toolExecutions: result.toolExecutions,
          },
        };
      }

      // Handle multiple tasks delegation
      if (input.tasks && Array.isArray(input.tasks)) {
        const tasks = input.tasks as Array<{ subagentId: string; task: string }>;

        if (input.parallel === true) {
          const results = await executor.executeParallel(
            tasks.map((t) => ({ subagentId: t.subagentId, message: t.task }))
          );

          return {
            content: JSON.stringify({
              success: true,
              execution: "parallel",
              results: results.map((r) => ({
                subagentId: r.subagentId,
                response: r.response,
                toolExecutions: r.toolExecutions.length,
              })),
            }, null, 2),
            metadata: { results },
          };
        } else {
          const results = await executor.executeSequential(
            tasks.map((t) => ({ subagentId: t.subagentId, message: t.task }))
          );

          return {
            content: JSON.stringify({
              success: true,
              execution: "sequential",
              results: results.map((r) => ({
                subagentId: r.subagentId,
                response: r.response,
                toolExecutions: r.toolExecutions.length,
              })),
            }, null, 2),
            metadata: { results },
          };
        }
      }

      return {
        isError: true,
        content: JSON.stringify({
          success: false,
          error: "Invalid input. Provide either 'task' + 'subagentId' for single delegation, or 'tasks' array for multiple.",
        }),
      };
    },
  };
}

/**
 * Create a handoff tool for subagent transitions
 */
export function createHandoffTool(mainAgent: Agent): Tool {
  return {
    name: "handoff_to_subagent",
    description: `Hand off the conversation to another subagent. Use this when:
- The current task is better handled by another agent
- The user's request is outside your expertise
- You detect a specific keyword or topic that belongs to another agent

The handoff will transfer context and continue the conversation with the target agent.`,
    inputSchema: {
      type: "object",
      properties: {
        targetSubagentId: {
          type: "string",
          description: "ID of the subagent to hand off to",
        },
        reason: {
          type: "string",
          description: "Reason for the handoff",
        },
        context: {
          type: "string",
          description: "Additional context to pass to the target agent",
        },
      },
      required: ["targetSubagentId", "reason"],
    },
    handler: async ({ input, context }: { input: Record<string, unknown>; context: ToolContext }): Promise<ToolResult> => {
      const targetSubagentId = input.targetSubagentId as string;
      const reason = input.reason as string;
      const additionalContext = input.context as string | undefined;

      const executor = getExecutor(mainAgent);

      // Create handoff message
      const handoffMessage = `[Handoff from ${context.agentId}]: ${reason}${
        additionalContext ? `\n\nContext: ${additionalContext}` : ""
      }`;

      try {
        const result = await executor.execute(targetSubagentId, handoffMessage, {
          sessionId: context.sessionId,
        });

        return {
          content: JSON.stringify({
            success: true,
            handedOff: true,
            targetSubagentId,
            from: context.agentId,
            response: result.response,
            toolExecutions: result.toolExecutions.length,
          }, null, 2),
          metadata: {
            handoff: true,
            from: context.agentId,
            to: targetSubagentId,
            reason,
          },
        };
      } catch (error) {
        return {
          isError: true,
          content: JSON.stringify({
            success: false,
            error: `Handoff failed: ${error instanceof Error ? error.message : String(error)}`,
          }),
        };
      }
    },
  };
}
