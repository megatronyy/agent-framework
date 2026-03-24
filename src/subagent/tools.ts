/**
 * Subagent and Handoff Tool Factories
 *
 * Creates tools from subagents and handoff actions.
 */

import type { Tool } from "../types.js";
import type { SubagentMetadata, SubagentRegistry } from "./registry.js";
import type { HandoffManager, HandoffConfig } from "./handoff.js";
import type { SubagentExecutor } from "./executor.js";

/**
 * Create a tool from a subagent
 */
export function createSubagentTool(
  subagent: SubagentMetadata,
  executor: SubagentExecutor
): Tool {
  return {
    name: subagent.id,
    description: subagent.description,
    inputSchema: {
      type: "object",
      properties: {
        input: {
          type: "string",
          description: "Input to pass to the subagent",
        },
        timeout: {
          type: "number",
          description: "Execution timeout in milliseconds",
          default: 30000,
        },
        maxTurns: {
          type: "number",
          description: "Maximum number of turns",
          default: 10,
        },
      },
      required: ["input"],
    },
    handler: async ({ input, context }) => {
      const agentId = context.agentId;
      const sessionId = context.sessionId;

      try {
        const result = await executor.execute(subagent, input.input as string, {
          timeout: input.timeout as number,
          maxTurns: input.maxTurns as number,
        });

        if (result.success) {
          return {
            content: JSON.stringify({
              success: true,
              output: result.output,
              duration: result.duration,
              subagent: subagent.id,
            }),
          };
        } else {
          return {
            isError: true,
            content: JSON.stringify({
              success: false,
              error: result.error,
              duration: result.duration,
              subagent: subagent.id,
            }),
          };
        }
      } catch (error) {
        return {
          isError: true,
          content: JSON.stringify({
            success: false,
            error: error instanceof Error ? error.message : String(error),
            subagent: subagent.id,
          }),
        };
      }
    },
  };
}

/**
 * Create tools for all registered subagents
 */
export function createSubagentTools(
  registry: SubagentRegistry,
  executor: SubagentExecutor
): Tool[] {
  const tools: Tool[] = [];

  for (const subagent of registry.listMetadata()) {
    tools.push(createSubagentTool(subagent, executor));
  }

  return tools;
}

/**
 * Create a handoff tool
 */
export function createHandoffTool(
  registry: SubagentRegistry,
  handoffManager: HandoffManager,
  config?: Partial<HandoffConfig>
): Tool {
  // Get available target agents
  const targetAgents = registry.listMetadata();

  return {
    name: "handoff",
    description: "Transfer control to another specialized agent",
    inputSchema: {
      type: "object",
      properties: {
        targetAgent: {
          type: "string",
          description: "ID of the target agent",
          enum: targetAgents.map((a) => a.id),
        },
        reason: {
          type: "string",
          description: "Reason for handoff",
        },
        strategy: {
          type: "string",
          description: "Handoff strategy",
          enum: ["immediate", "await_confirmation", "conditional"],
          default: "immediate",
        },
        preserveContext: {
          type: "boolean",
          description: "Preserve conversation context",
          default: true,
        },
      },
      required: ["targetAgent"],
    },
    handler: async ({ input, context }) => {
      const agentId = context.agentId;
      const sessionId = context.sessionId;

      try {
        const targetSubagent = registry.get(input.targetAgent as string);
        if (!targetSubagent) {
          return {
            isError: true,
            content: JSON.stringify({
              success: false,
              error: `Target agent not found: ${input.targetAgent}`,
            }),
          };
        }

        // Get current agent (assuming it's the source)
        const sourceAgent = registry.get(agentId);
        if (!sourceAgent) {
          return {
            isError: true,
            content: JSON.stringify({
              success: false,
              error: "Source agent not found in registry",
            }),
          };
        }

        // Execute handoff
        const result = await handoffManager.initiateHandoff(
          sourceAgent,
          targetSubagent,
          [], // Conversation history would be passed from context
          {
            strategy: input.strategy as "immediate" | "await_confirmation" | "conditional",
            preserveContext: input.preserveContext as boolean,
          }
        );

        return {
          content: JSON.stringify({
            success: result.success,
            toAgent: input.targetAgent,
            reason: input.reason || result.context?.handoffReason,
            error: result.error,
          }),
        };
      } catch (error) {
        return {
          isError: true,
          content: JSON.stringify({
            success: false,
            error: error instanceof Error ? error.message : String(error),
          }),
        };
      }
    },
  };
}

/**
 * Create a specialized handoff tool with pre-configured target
 */
export function createDirectedHandoffTool(
  targetAgentId: string,
  registry: SubagentRegistry,
  handoffManager: HandoffManager,
  handoffConfig?: Partial<HandoffConfig>
): Tool {
  const targetAgent = registry.get(targetAgentId);
  if (!targetAgent) {
    throw new Error(`Target agent not found: ${targetAgentId}`);
  }

  return {
    name: `handoff_to_${targetAgentId}`,
    description: `Transfer control to ${targetAgent.name}: ${targetAgent.description}`,
    inputSchema: {
      type: "object",
      properties: {
        reason: {
          type: "string",
          description: "Reason for handoff",
        },
        preserveContext: {
          type: "boolean",
          description: "Preserve conversation context",
          default: true,
        },
      },
      required: [],
    },
    handler: async ({ input, context }) => {
      const agentId = context.agentId;

      try {
        const sourceAgent = registry.get(agentId);
        if (!sourceAgent) {
          return {
            isError: true,
            content: JSON.stringify({
              success: false,
              error: "Source agent not found in registry",
            }),
          };
        }

        const result = await handoffManager.initiateHandoff(
          sourceAgent,
          targetAgent,
          [],
          handoffConfig
        );

        return {
          content: JSON.stringify({
            success: result.success,
            toAgent: targetAgentId,
            reason: input.reason || result.context?.handoffReason,
          }),
        };
      } catch (error) {
        return {
          isError: true,
          content: JSON.stringify({
            success: false,
            error: error instanceof Error ? error.message : String(error),
          }),
        };
      }
    },
  };
}
