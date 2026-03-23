/**
 * Core Agent class - main entry point for running AI agents
 */

import type {
  AgentConfig,
  AgentRunOptions,
  AgentRunResult,
  Message,
  ContentBlock,
  ImageContent,
  Session,
  ToolExecution,
  AgentEvent,
  EventListener,
  AgentProvider,
} from "../types.js";
import { AnthropicProvider } from "./providers/AnthropicProvider.js";
import { OpenAIProvider } from "./providers/OpenAIProvider.js";
import { MemorySessionManager } from "../session/MemorySessionManager.js";
import { MemoryToolRegistry } from "../tools/MemoryToolRegistry.js";

export class Agent {
  private config: AgentConfig;
  private sessionManager: MemorySessionManager;
  private toolRegistry: MemoryToolRegistry;
  private provider: AgentProvider;
  private eventListeners: Set<EventListener>;
  private activeRuns: Map<string, AbortController>;

  constructor(config: AgentConfig) {
    this.config = config;
    this.sessionManager = new MemorySessionManager();
    this.toolRegistry = new MemoryToolRegistry();
    this.eventListeners = new Set();
    this.activeRuns = new Map();

    // Register agent tools
    if (config.tools) {
      for (const tool of config.tools) {
        this.toolRegistry.register(tool);
      }
    }

    // Initialize provider
    this.provider = this.createProvider(config.model);
  }

  /**
   * Create a provider instance based on model config
   */
  private createProvider(modelConfig: AgentConfig["model"]): AgentProvider {
    switch (modelConfig.provider) {
      case "anthropic":
        return new AnthropicProvider(modelConfig);
      case "openai":
      case "openrouter":
        return new OpenAIProvider(modelConfig);
      default:
        throw new Error(`Unsupported provider: ${modelConfig.provider}`);
    }
  }

  /**
   * Run the agent with a message
   */
  async run(options: AgentRunOptions): Promise<AgentRunResult> {
    const runId = `run-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const abortController = new AbortController();

    // Combine with external abort signal if provided
    if (options.abortSignal) {
      options.abortSignal.addEventListener("abort", () => abortController.abort());
    }

    this.activeRuns.set(runId, abortController);

    try {
      this.emit({
        type: "session:start",
        timestamp: Date.now(),
        sessionId: options.sessionId,
        agentId: this.config.id,
      });

      // Get or create session
      let session: Session;
      if (options.sessionId) {
        const existing = this.sessionManager.get(options.sessionId);
        if (existing) {
          session = existing;
        } else {
          throw new Error(`Session not found: ${options.sessionId}`);
        }
      } else {
        session = this.sessionManager.create({
          agentId: this.config.id,
          metadata: options.metadata,
        });
      }

      // Add user message to session
      const userMessage: Message = {
        role: "user",
        content: this.buildUserContent(options.message, options.images),
        timestamp: Date.now(),
      };
      this.sessionManager.addMessage(session.id, userMessage);

      // Prepare messages for provider
      const messages = this.prepareMessages(session);

      // Run the agent loop (handle tool calls)
      const result = await this.runAgentLoop({
        session,
        messages,
        temperature: options.temperature ?? this.config.temperature,
        maxTokens: options.maxTokens ?? this.config.maxTokens,
        onProgress: options.onProgress,
        abortSignal: abortController.signal,
        onToolCall: options.onToolCall,
      });

      // Add assistant response to session
      const assistantMessage: Message = {
        role: "assistant",
        content: result.response,
        timestamp: Date.now(),
      };
      this.sessionManager.addMessage(session.id, assistantMessage);

      this.emit({
        type: "session:end",
        timestamp: Date.now(),
        sessionId: session.id,
        agentId: this.config.id,
        data: { usage: result.usage },
      });

      return {
        ...result,
        metadata: {
          ...result.metadata,
          sessionId: session.id,
        },
      };
    } finally {
      this.activeRuns.delete(runId);
    }
  }

  /**
   * Run the agent loop - handles tool calls until complete
   */
  private async runAgentLoop(params: {
    session: Session;
    messages: Message[];
    temperature?: number;
    maxTokens?: number;
    onProgress?: (token: string) => void;
    abortSignal: AbortSignal;
    onToolCall?: (tool: string, input: Record<string, unknown>) => void;
  }): Promise<AgentRunResult> {
    const toolExecutions: ToolExecution[] = [];
    let currentMessages = [...params.messages];
    let maxIterations = 10; // Prevent infinite loops
    let iteration = 0;

    while (iteration < maxIterations) {
      iteration++;

      // Emit progress event
      this.emit({
        type: "progress",
        timestamp: Date.now(),
        sessionId: params.session.id,
        agentId: this.config.id,
        data: { iteration },
      });

      // Generate response
      const result = await this.provider.generate({
        messages: currentMessages,
        tools: Array.from(this.toolRegistry.list()),
        temperature: params.temperature,
        maxTokens: params.maxTokens,
        onProgress: params.onProgress,
        abortSignal: params.abortSignal,
      });

      // Check for tool calls
      if (!result.toolExecutions || result.toolExecutions.length === 0) {
        // No tool calls, we're done
        return { response: result.response, usage: result.usage };
      }

      // Execute tools
      const toolResults: Array<{ id: string; content: string; isError?: boolean }> = [];

      for (const execution of result.toolExecutions) {
        if (params.onToolCall) {
          params.onToolCall(execution.tool.name, execution.input);
        }

        this.emit({
          type: "tool:start",
          timestamp: Date.now(),
          sessionId: params.session.id,
          agentId: this.config.id,
          data: { tool: execution.tool.name, input: execution.input },
        });

        try {
          const updatedExecution = await this.executeTool(execution);
          toolExecutions.push(updatedExecution);
          toolResults.push({
            id: (execution.input as any).id || execution.tool.name,
            content: typeof updatedExecution.result.content === "string"
              ? updatedExecution.result.content
              : JSON.stringify(updatedExecution.result.content),
            isError: updatedExecution.result.isError,
          });

          this.emit({
            type: "tool:end",
            timestamp: Date.now(),
            sessionId: params.session.id,
            agentId: this.config.id,
            data: { tool: execution.tool.name, durationMs: execution.durationMs },
          });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);

          this.emit({
            type: "tool:error",
            timestamp: Date.now(),
            sessionId: params.session.id,
            agentId: this.config.id,
            data: { tool: execution.tool.name, error: errorMessage },
          });

          toolResults.push({
            id: (execution.input as any).id || execution.tool.name,
            content: JSON.stringify({ error: errorMessage }),
            isError: true,
          });
        }
      }

      // Add assistant message and tool results to conversation
      currentMessages.push({
        role: "assistant",
        content: result.response,
      });

      currentMessages.push({
        role: "user",
        content: toolResults.map((tr) => ({
          type: "tool_result",
          tool_use_id: tr.id,
          content: tr.content,
          is_error: tr.isError,
        })),
      });

      // Continue loop
    }

    // Max iterations reached
    return {
      response: "I reached the maximum number of tool iterations. Please try again.",
      toolExecutions,
    };
  }

  /**
   * Execute a tool
   */
  private async executeTool(execution: ToolExecution): Promise<ToolExecution> {
    const startTime = Date.now();

    const result = await execution.tool.handler({
      input: execution.input,
      context: {
        sessionId: "", // Will be filled in runAgentLoop context
        agentId: this.config.id,
      },
    });

    execution.result = result;
    execution.durationMs = Date.now() - startTime;

    return execution;
  }

  /**
   * Prepare messages for the provider
   */
  private prepareMessages(session: Session): Message[] {
    const messages: Message[] = [];

    // Add system prompt
    if (this.config.systemPrompt) {
      messages.push({
        role: "system",
        content: this.config.systemPrompt,
      });
    }

    // Add session messages
    messages.push(...session.messages);

    return messages;
  }

  /**
   * Build user message content (text + images)
   */
  private buildUserContent(
    message: string,
    images?: string[],
  ): string | ContentBlock[] {
    if (!images || images.length === 0) {
      return message;
    }

    const content: ContentBlock[] = [
      { type: "text", text: message },
    ];

    for (const img of images) {
      const imageContent: ImageContent = img.startsWith("data:")
        ? {
            type: "image",
            source: {
              type: "base64",
              media_type: "image/png",
              data: img.split(",")[1] ?? "",
            },
          }
        : {
            type: "image",
            source: {
              type: "url",
              url: img,
            },
          };
      content.push(imageContent);
    }

    return content;
  }

  /**
   * Register an event listener
   */
  on(event: EventListener): () => void {
    this.eventListeners.add(event);
    return () => this.eventListeners.delete(event);
  }

  /**
   * Emit an event
   */
  private emit(event: AgentEvent): void {
    for (const listener of this.eventListeners) {
      try {
        listener(event);
      } catch (error) {
        console.error("Error in event listener:", error);
      }
    }
  }

  /**
   * Get session manager
   */
  getSessionManager(): MemorySessionManager {
    return this.sessionManager;
  }

  /**
   * Get tool registry
   */
  getToolRegistry(): MemoryToolRegistry {
    return this.toolRegistry;
  }

  /**
   * Get agent config
   */
  getConfig(): AgentConfig {
    return { ...this.config };
  }

  /**
   * Abort all active runs
   */
  abortAll(): void {
    for (const controller of this.activeRuns.values()) {
      controller.abort();
    }
    this.activeRuns.clear();
  }
}
