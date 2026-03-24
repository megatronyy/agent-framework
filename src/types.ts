/**
 * Core type definitions for the agent framework
 */

/**
 * Supported model providers
 */
export type ModelProvider = "anthropic" | "openai" | "openrouter" | "ollama" | "zhipu";

/**
 * Message role in the conversation
 */
export type MessageRole = "user" | "assistant" | "system";

/**
 * Content types in messages
 */
export type TextContent = { type: "text"; text: string };
export type ImageContent = {
  type: "image";
  source: { type: "url"; url: string } | { type: "base64"; media_type: string; data: string };
};
export type ToolUseContent = {
  type: "tool_use";
  id: string;
  name: string;
  input: Record<string, unknown>;
};
export type ToolResultContent = {
  type: "tool_result";
  tool_use_id: string;
  content?: string | Array<TextContent | ImageContent>;
  is_error?: boolean;
};

export type ContentBlock = TextContent | ImageContent | ToolUseContent | ToolResultContent;

/**
 * Message in the conversation
 */
export interface Message {
  role: MessageRole;
  content: string | Array<ContentBlock>;
  timestamp?: number;
}

/**
 * Tool definition
 */
export interface Tool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  handler: ToolHandler;
}

/**
 * Tool handler function
 */
export type ToolHandler = (params: {
  input: Record<string, unknown>;
  context: ToolContext;
}) => Promise<ToolResult> | ToolResult;

/**
 * Context provided to tool handlers
 */
export interface ToolContext {
  sessionId: string;
  agentId: string;
  userId?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Result from a tool execution
 */
export interface ToolResult {
  content: string | Array<ContentBlock>;
  isError?: boolean;
  metadata?: Record<string, unknown>;
}

/**
 * Tool execution result
 */
export interface ToolExecution {
  tool: Tool;
  input: Record<string, unknown>;
  result: ToolResult;
  durationMs: number;
}

/**
 * Agent configuration
 */
export interface AgentConfig {
  id: string;
  name: string;
  description?: string;
  model: ModelConfig;
  systemPrompt?: string;
  tools?: Tool[];
  temperature?: number;
  maxTokens?: number;
  metadata?: Record<string, unknown>;
  skillsPaths?: string[];
  enableSkills?: boolean;
  personaPath?: string;
}

/**
 * Model configuration
 */
export interface ModelConfig {
  provider: ModelProvider;
  model: string;
  apiKey?: string;
  baseUrl?: string;
  headers?: Record<string, string>;
}

/**
 * Session state
 */
export interface Session {
  id: string;
  agentId: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
  metadata?: Record<string, unknown>;
}

/**
 * Agent run options
 */
export interface AgentRunOptions {
  sessionId?: string;
  message: string;
  images?: string[];
  temperature?: number;
  maxTokens?: number;
  metadata?: Record<string, unknown>;
  onProgress?: (token: string) => void;
  onToolCall?: (tool: string, input: Record<string, unknown>) => void;
  abortSignal?: AbortSignal;
}

/**
 * Agent run result
 */
export interface AgentRunResult {
  response: string;
  toolExecutions?: ToolExecution[];
  usage?: TokenUsage;
  metadata?: Record<string, unknown>;
}

/**
 * Token usage information
 */
export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
  totalTokens: number;
}

/**
 * Tool registry
 */
export interface ToolRegistry {
  register(tool: Tool): void;
  unregister(name: string): void;
  get(name: string): Tool | undefined;
  list(): Tool[];
  has(name: string): boolean;
}

/**
 * Session manager
 */
export interface SessionManager {
  create(params: { agentId: string; metadata?: Record<string, unknown> }): Session;
  get(id: string): Session | undefined;
  update(id: string, updates: Partial<Session>): Session | undefined;
  delete(id: string): boolean;
  list(agentId?: string): Session[];
  addMessage(sessionId: string, message: Message): void;
}

/**
 * Agent provider interface
 */
export interface AgentProvider {
  id: ModelProvider;
  generate(params: {
    messages: Message[];
    tools?: Tool[];
    temperature?: number;
    maxTokens?: number;
    onProgress?: (token: string) => void;
    abortSignal?: AbortSignal;
  }): Promise<AgentRunResult>;
}

/**
 * Event types for agent lifecycle
 */
export type AgentEventType =
  | "session:start"
  | "session:end"
  | "tool:start"
  | "tool:end"
  | "tool:error"
  | "error"
  | "progress";

/**
 * Agent event
 */
export interface AgentEvent {
  type: AgentEventType;
  timestamp: number;
  sessionId?: string;
  agentId?: string;
  data?: Record<string, unknown>;
}

/**
 * Event listener
 */
export type EventListener = (event: AgentEvent) => void;

// ============================================================================
// Subagent Types
// ============================================================================

/**
 * Subagent configuration
 */
export interface SubagentConfig {
  id: string;
  name: string;
  description: string;
  agentConfig: AgentConfig;
  allowedTools?: string[];
  maxTurns?: number;
  timeout?: number;
  handoff?: {
    keywords: string[];
    targetSubagentId: string;
  }[];
}

/**
 * Subagent execution result
 */
export interface SubagentResult {
  subagentId: string;
  response: string;
  toolExecutions: ToolExecution[];
  usage?: TokenUsage;
  metadata?: Record<string, unknown>;
}

/**
 * Subagent handoff request
 */
export interface SubagentHandoff {
  targetSubagentId: string;
  reason: string;
  context: Record<string, unknown>;
}

// ============================================================================
// Context Engine Types
// ============================================================================

/**
 * Context entry
 */
export interface ContextEntry {
  id: string;
  type: "message" | "memory" | "document" | "tool_result";
  content: string;
  metadata?: {
    timestamp?: number;
    source?: string;
    relevance?: number;
    tokens?: number;
    [key: string]: unknown;
  };
}

/**
 * Context window config
 */
export interface ContextWindowConfig {
  maxTokens: number;
  reserveForResponse: number;
  pruneStrategy: "oldest" | "least_relevant" | "summarize" | "smart";
  summarizationProvider?: "anthropic" | "openai";
}

/**
 * Context query options
 */
export interface ContextQueryOptions {
  query?: string;
  maxTokens?: number;
  includeSystem?: boolean;
  includeToolResults?: boolean;
  relevanceThreshold?: number;
}

/**
 * Context engine result
 */
export interface ContextEngineResult {
  entries: ContextEntry[];
  totalTokens: number;
  remainingTokens: number;
  wasPruned: boolean;
  wasSummarized: boolean;
}

/**
 * Context chunk for RAG
 */
export interface ContextChunk {
  content: string;
  metadata: {
    source: string;
    score: number;
    timestamp?: number;
    [key: string]: unknown;
  };
}

/**
 * Vector store interface for RAG
 */
export interface VectorStore {
  add(documents: Array<{ id: string; content: string; metadata?: Record<string, unknown> }>): Promise<void>;
  search(query: string, topK?: number): Promise<ContextChunk[]>;
  delete(id: string): Promise<void>;
  clear(): Promise<void>;
}
