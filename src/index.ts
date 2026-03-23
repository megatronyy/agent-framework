/**
 * Agent Framework - Main entry point
 *
 * A lightweight AI agent framework for building intelligent agents
 * with tool calling capabilities.
 */

import { Agent } from "./core/Agent.js";

// Core exports
export { Agent } from "./core/Agent.js";
export { AnthropicProvider } from "./core/providers/AnthropicProvider.js";
export { OpenAIProvider } from "./core/providers/OpenAIProvider.js";

// Session management
export { MemorySessionManager } from "./session/MemorySessionManager.js";

// Tools
export { MemoryToolRegistry } from "./tools/MemoryToolRegistry.js";
export { builtinTools, calculatorTool, dateTimeTool, memoryTool } from "./tools/builtins/index.js";

// Types
export * from "./types.js";
import type { AgentConfig } from "./types.js";

/**
 * Create a new agent with the given configuration
 */
export function createAgent(config: AgentConfig): Agent {
  return new Agent(config);
}

/**
 * Create a simple text-only agent
 */
export function createTextAgent(options: {
  apiKey: string;
  model?: string;
  provider?: "anthropic" | "openai";
  systemPrompt?: string;
}): Agent {
  return createAgent({
    id: "default-agent",
    name: "Default Agent",
    model: {
      provider: options.provider || "anthropic",
      model: options.model || "claude-3-5-sonnet-20241022",
      apiKey: options.apiKey,
    },
    systemPrompt: options.systemPrompt,
    tools: [],
  });
}
