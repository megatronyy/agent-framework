/**
 * Subagent Module
 *
 * Provides subagent management, execution, and handoff capabilities.
 */

// Registry - manages subagent registration and lookup
export { SubagentRegistry } from "./registry.js";
export type {
  SubagentMetadata,
  SubagentRegistryConfig,
} from "./registry.js";

// Executor - executes subagents with isolated context
export { SubagentExecutor } from "./SubagentExecutor.js";
export type {
  SubagentExecutionOptions,
  SubagentExecutionResult,
} from "./executor.js";

// Handoff - manages agent control transfer
export { HandoffManager } from "./handoff.js";
export type {
  HandoffContext,
  HandoffResult,
  HandoffStrategy,
  HandoffConfig,
} from "./handoff.js";

// Tools - factory functions for creating subagent and handoff tools
export {
  createSubagentTool,
  createSubagentTools,
  createHandoffTool,
  createDirectedHandoffTool,
} from "./tools.js";
