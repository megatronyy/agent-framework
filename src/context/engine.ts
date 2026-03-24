/**
 * Context Engine
 *
 * Orchestrates token counting, summarization, and RAG for context management.
 */

import { SimpleTokenCounter } from "./token-counter.js";
import { SimpleContextSummarizer } from "./summarizer.js";
import { InMemoryVectorStore } from "./vector-store.js";
import type { Message, TokenCount } from "./token-counter.js";
import type { VectorDocument } from "./vector-store.js";

/**
 * Context management options
 */
export interface ContextEngineOptions {
  maxTokens?: number;
  summaryThreshold?: number;
  ragThreshold?: number;
  preserveRecentMessages?: number;
}

/**
 * Context state
 */
export interface ContextState {
  messages: Message[];
  summary?: string;
  tokenCount: TokenCount;
  needsSummarization: boolean;
}

/**
 * Context engine result
 */
export interface ContextEngineResult {
  messages: Message[];
  summary?: string;
  tokenCount: TokenCount;
  action: "none" | "summarized" | "truncated" | "rag_applied";
}

/**
 * Main context engine
 */
export class ContextEngine {
  private tokenCounter: SimpleTokenCounter;
  private summarizer: SimpleContextSummarizer;
  private vectorStore: InMemoryVectorStore;
  private options: Required<ContextEngineOptions>;

  constructor(
    vectorStore?: InMemoryVectorStore,
    options?: ContextEngineOptions
  ) {
    this.tokenCounter = new SimpleTokenCounter();
    this.summarizer = new SimpleContextSummarizer(undefined, this.tokenCounter);
    this.vectorStore = vectorStore ?? new InMemoryVectorStore();
    this.options = {
      maxTokens: options?.maxTokens ?? 100000,
      summaryThreshold: options?.summaryThreshold ?? 80000,
      ragThreshold: options?.ragThreshold ?? 0.3,
      preserveRecentMessages: options?.preserveRecentMessages ?? 10,
    };
  }

  /**
   * Process and optimize context for the given messages
   */
  async processContext(
    messages: Message[],
    systemPrompt?: string
  ): Promise<ContextEngineResult> {
    const tokenCount = systemPrompt
      ? this.tokenCounter.countWithSystemPrompt(systemPrompt, messages)
      : this.tokenCounter.countConversation(messages);

    // Check if we need to process
    if (tokenCount.tokens <= this.options.maxTokens) {
      return {
        messages,
        tokenCount,
        action: "none",
      };
    }

    // Try summarization first
    if (tokenCount.tokens > this.options.summaryThreshold) {
      const result = await this.summarizeContext(messages);
      return {
        messages: result.messages,
        summary: result.summary,
        tokenCount: result.tokenCount,
        action: "summarized",
      };
    }

    // Fall back to truncation
    const truncated = this.truncateContext(messages, systemPrompt);
    return {
      messages: truncated.messages,
      tokenCount: truncated.tokenCount,
      action: "truncated",
    };
  }

  /**
   * Summarize conversation context
   */
  async summarizeContext(
    messages: Message[],
    targetTokens?: number
  ): Promise<{
    messages: Message[];
    summary: string;
    tokenCount: TokenCount;
  }> {
    const summaryResult = targetTokens
      ? await this.summarizer.summarizeToTarget(messages, targetTokens)
      : await this.summarizer.summarize(messages);

    // Create a system message with the summary
    const summaryMessage: Message = {
      role: "system",
      content: `Previous conversation summary:\n${summaryResult.summary}`,
    };

    // Keep recent messages
    const recentMessages = messages.slice(-this.options.preserveRecentMessages);

    return {
      messages: [summaryMessage, ...recentMessages],
      summary: summaryResult.summary,
      tokenCount: this.tokenCounter.countConversation([
        summaryMessage,
        ...recentMessages,
      ]),
    };
  }

  /**
   * Truncate context to fit within token limit
   */
  truncateContext(
    messages: Message[],
    systemPrompt?: string
  ): {
    messages: Message[];
    tokenCount: TokenCount;
  } {
    const systemTokens = systemPrompt
      ? this.tokenCounter.countTokens(systemPrompt).tokens
      : 0;
    const availableForMessages = this.options.maxTokens - systemTokens;

    const truncated = this.tokenCounter.truncateToFit(
      messages,
      availableForMessages
    );

    return {
      messages: truncated,
      tokenCount: this.tokenCounter.countConversation(truncated),
    };
  }

  /**
   * Apply RAG to enhance context with retrieved documents
   */
  async applyRAG(
    messages: Message[],
    query: string,
    options?: {
      limit?: number;
      threshold?: number;
      injectPosition?: "before" | "after";
    }
  ): Promise<ContextEngineResult> {
    const results = await this.vectorStore.search(query, {
      limit: options?.limit ?? 3,
      threshold: options?.threshold ?? this.options.ragThreshold,
    });

    if (results.length === 0) {
      return {
        messages,
        tokenCount: this.tokenCounter.countConversation(messages),
        action: "none",
      };
    }

    // Create context message from RAG results
    const ragContent = results
      .map((r) => `[Context: ${r.document.id}] ${r.document.content}`)
      .join("\n\n");

    const ragMessage: Message = {
      role: "system",
      content: `Relevant context from knowledge base:\n${ragContent}`,
    };

    // Inject RAG context
    const position = options?.injectPosition ?? "before";
    const enhancedMessages =
      position === "before"
        ? [ragMessage, ...messages]
        : [...messages, ragMessage];

    return {
      messages: enhancedMessages,
      tokenCount: this.tokenCounter.countConversation(enhancedMessages),
      action: "rag_applied",
    };
  }

  /**
   * Get current token count
   */
  getTokenCount(messages: Message[], systemPrompt?: string): TokenCount {
    return systemPrompt
      ? this.tokenCounter.countWithSystemPrompt(systemPrompt, messages)
      : this.tokenCounter.countConversation(messages);
  }

  /**
   * Check if context needs processing
   */
  needsProcessing(messages: Message[], systemPrompt?: string): boolean {
    const count = this.getTokenCount(messages, systemPrompt);
    return count.tokens > this.options.maxTokens;
  }

  /**
   * Get the vector store
   */
  getVectorStore(): InMemoryVectorStore {
    return this.vectorStore;
  }

  /**
   * Add documents to the vector store
   */
  async addDocuments(documents: VectorDocument[]): Promise<void> {
    await this.vectorStore.addMany(documents);
  }

  /**
   * Search the vector store
   */
  async search(query: string, options?: { limit?: number; threshold?: number }) {
    return this.vectorStore.search(query, options);
  }

  /**
   * Get context statistics
   */
  getContextStats(messages: Message[]): {
    totalTokens: number;
    messageCount: number;
    estimatedCompressionRatio: number;
  } {
    const tokenCount = this.tokenCounter.countConversation(messages);

    return {
      totalTokens: tokenCount.tokens,
      messageCount: messages.length,
      estimatedCompressionRatio: tokenCount.tokens / messages.length,
    };
  }
}
