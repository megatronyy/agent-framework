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
export { extendedTools, allTools } from "./tools/index.js";
export { webFetchTool } from "./tools/web/web-fetch.js";
export { webSearchTool } from "./tools/web/web-search.js";
export { fileReadTool, fileWriteTool, fileListTool } from "./tools/file/file-tool.js";
export { pdfTool } from "./tools/pdf/pdf-tool.js";
export { cronTool } from "./tools/cron/cron-tool.js";
export { codeExecuteTool } from "./tools/code/code-tool.js";

// Skills
export { SkillRegistry } from "./skills/SkillRegistry.js";
export { parseSkill, buildSkillsPrompt } from "./skills/SkillParser.js";
export * from "./skills/Skill.js";

// Persona
export { PersonaLoader } from "./persona/PersonaLoader.js";
export * from "./persona/Persona.js";

// Subagent
export { SubagentRegistry, SubagentExecutor, createSubagentTool, createHandoffTool } from "./subagent/index.js";

// Context Engine
export {
  ContextEngine,
  SimpleTokenCounter,
  SimpleContextSummarizer,
  InMemoryVectorStore,
  createRAGTool,
} from "./context/index.js";

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
  skills?: boolean;
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
    enableSkills: options.skills ?? true,
  });
}
