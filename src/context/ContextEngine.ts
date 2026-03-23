/**
 * Context Engine
 *
 * Manages context windows, pruning, and intelligent context selection.
 */

import type {
  ContextEntry,
  ContextWindowConfig,
  ContextQueryOptions,
  ContextEngineResult,
  Message,
} from "../types.js";

/**
 * Token counter interface
 */
export interface TokenCounter {
  count(text: string): number;
  countMessages(messages: Message[]): number;
}

/**
 * Simple token counter (approximately 4 chars per token)
 */
export class SimpleTokenCounter implements TokenCounter {
  count(text: string): number {
    // Rough approximation: ~4 characters per token
    return Math.ceil(text.length / 4);
  }

  countMessages(messages: Message[]): number {
    let total = 0;
    for (const msg of messages) {
      if (typeof msg.content === "string") {
        total += this.count(msg.content);
      } else {
        for (const block of msg.content) {
          if (block.type === "text") {
            total += this.count(block.text);
          } else if (block.type === "image") {
            total += 85; // Approximate token cost for images
          } else if (block.type === "tool_use") {
            total += this.count(JSON.stringify(block.input)) + 10;
          } else if (block.type === "tool_result") {
            const content = typeof block.content === "string"
              ? block.content
              : JSON.stringify(block.content);
            total += this.count(content);
          }
        }
      }
    }
    return total;
  }
}

/**
 * Context summarizer interface
 */
export interface ContextSummarizer {
  summarize(entries: ContextEntry[]): Promise<string>;
}

/**
 * Simple context summarizer
 */
export class SimpleContextSummarizer implements ContextSummarizer {
  async summarize(entries: ContextEntry[]): Promise<string> {
    if (entries.length === 0) {
      return "";
    }

    const parts: string[] = [];

    // Group by type
    const messages = entries.filter((e) => e.type === "message");
    const toolResults = entries.filter((e) => e.type === "tool_result");
    const others = entries.filter((e) => e.type !== "message" && e.type !== "tool_result");

    if (messages.length > 0) {
      parts.push(`[Conversation Summary: ${messages.length} messages exchanged]`);
      // Include key information from first and last messages
      if (messages.length > 0) {
        const first = messages[0];
        parts.push(`First: ${first.content.slice(0, 100)}...`);
      }
      if (messages.length > 1) {
        const last = messages[messages.length - 1];
        parts.push(`Last: ${last.content.slice(0, 100)}...`);
      }
    }

    if (toolResults.length > 0) {
      parts.push(`[${toolResults.length} tool executions completed]`);
    }

    if (others.length > 0) {
      parts.push(`[${others.length} additional context entries]`);
    }

    return parts.join("\n");
  }
}

/**
 * Context Engine
 */
export class ContextEngine {
  private entries: ContextEntry[] = [];
  private tokenCounter: TokenCounter;
  private contextSummarizer: ContextSummarizer;

  constructor(
    private config: ContextWindowConfig,
    tokenCounter?: TokenCounter,
    summarizer?: ContextSummarizer
  ) {
    this.tokenCounter = tokenCounter || new SimpleTokenCounter();
    this.contextSummarizer = summarizer || new SimpleContextSummarizer();
  }

  /**
   * Add an entry to context
   */
  add(entry: ContextEntry): void {
    // Count tokens for the entry
    const tokens = this.tokenCounter.count(entry.content);
    entry.metadata = entry.metadata || {};
    entry.metadata.tokens = tokens;
    entry.metadata.timestamp = entry.metadata.timestamp || Date.now();

    this.entries.push(entry);
  }

  /**
   * Add a message to context
   */
  addMessage(message: Message): void {
    const content = typeof message.content === "string"
      ? message.content
      : JSON.stringify(message.content);

    this.add({
      id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      type: "message",
      content,
      metadata: {
        role: message.role,
        timestamp: message.timestamp || Date.now(),
      },
    });
  }

  /**
   * Get context entries based on options
   */
  query(options: ContextQueryOptions = {}): ContextEngineResult {
    const {
      maxTokens = this.config.maxTokens - this.config.reserveForResponse,
      includeToolResults = true,
      relevanceThreshold = 0.5,
    } = options;

    let filteredEntries = [...this.entries];

    // Filter by type
    if (!includeToolResults) {
      filteredEntries = filteredEntries.filter((e) => e.type !== "tool_result");
    }

    // Filter by relevance if query provided
    if (options.query) {
      filteredEntries = this.filterByRelevance(filteredEntries, options.query, relevanceThreshold);
    }

    // Sort by timestamp (newest first) for pruning
    filteredEntries.sort((a, b) => (b.metadata?.timestamp || 0) - (a.metadata?.timestamp || 0));

    // Calculate current token count
    const totalTokens = filteredEntries.reduce((sum, e) => sum + (e.metadata?.tokens || 0), 0);

    // Prune if necessary
    let wasPruned = false;
    let wasSummarized = false;
    let finalEntries = filteredEntries;

    if (totalTokens > maxTokens) {
      wasPruned = true;

      switch (this.config.pruneStrategy) {
        case "oldest":
          finalEntries = this.pruneOldest(filteredEntries, maxTokens);
          break;

        case "least_relevant":
          if (options.query) {
            finalEntries = this.pruneLeastRelevant(filteredEntries, maxTokens, options.query);
          } else {
            finalEntries = this.pruneOldest(filteredEntries, maxTokens);
          }
          break;

        case "summarize":
          finalEntries = this.summarizeOldEntries(filteredEntries, maxTokens);
          wasSummarized = true;
          break;

        case "smart":
          finalEntries = this.smartPrune(filteredEntries, maxTokens, options.query);
          break;
      }
    }

    const finalTokenCount = finalEntries.reduce((sum, e) => sum + (e.metadata?.tokens || 0), 0);

    return {
      entries: finalEntries,
      totalTokens: finalTokenCount,
      remainingTokens: maxTokens - finalTokenCount,
      wasPruned,
      wasSummarized,
    };
  }

  /**
   * Filter entries by relevance to a query
   */
  private filterByRelevance(entries: ContextEntry[], query: string, threshold: number): ContextEntry[] {
    const queryLower = query.toLowerCase();
    const queryWords = new Set(queryLower.split(/\s+/));

    return entries.filter((entry) => {
      const contentLower = entry.content.toLowerCase();
      const contentWords = new Set(contentLower.split(/\s+/));

      // Calculate Jaccard similarity
      const intersection = new Set([...queryWords].filter((x) => contentWords.has(x)));
      const union = new Set([...queryWords, ...contentWords]);
      const similarity = union.size > 0 ? intersection.size / union.size : 0;

      entry.metadata = entry.metadata || {};
      entry.metadata.relevance = similarity;

      return similarity >= threshold;
    });
  }

  /**
   * Prune oldest entries
   */
  private pruneOldest(entries: ContextEntry[], maxTokens: number): ContextEntry[] {
    const result: ContextEntry[] = [];
    let currentTokens = 0;

    // Keep newest entries first
    for (const entry of entries) {
      const entryTokens = entry.metadata?.tokens || this.tokenCounter.count(entry.content);
      if (currentTokens + entryTokens <= maxTokens) {
        result.push(entry);
        currentTokens += entryTokens;
      }
      if (currentTokens >= maxTokens) {
        break;
      }
    }

    return result;
  }

  /**
   * Prune least relevant entries
   */
  private pruneLeastRelevant(entries: ContextEntry[], maxTokens: number, _query: string): ContextEntry[] {
    // Sort by relevance (highest first), then by timestamp
    const sorted = [...entries].sort((a, b) => {
      const aRelevance = a.metadata?.relevance || 0;
      const bRelevance = b.metadata?.relevance || 0;
      if (aRelevance !== bRelevance) {
        return bRelevance - aRelevance;
      }
      return (b.metadata?.timestamp || 0) - (a.metadata?.timestamp || 0);
    });

    return this.pruneOldest(sorted, maxTokens);
  }

  /**
   * Summarize old entries
   */
  private summarizeOldEntries(entries: ContextEntry[], maxTokens: number): ContextEntry[] {
    const summaryEntry: ContextEntry = {
      id: `summary-${Date.now()}`,
      type: "message",
      content: "",
      metadata: { timestamp: Date.now(), tokens: 0 },
    };

    const result: ContextEntry[] = [];
    let currentTokens = 0;

    // Start from newest, keep until we need to summarize
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      const entryTokens = entry.metadata?.tokens || this.tokenCounter.count(entry.content);

      if (currentTokens + entryTokens <= maxTokens * 0.7) {
        result.push(entry);
        currentTokens += entryTokens;
      } else {
        // Summarize remaining entries
        const remaining = entries.slice(i);
        if (remaining.length > 0) {
          void this.contextSummarizer.summarize(remaining).then((summary: string) => {
            summaryEntry.content = summary;
            summaryEntry.metadata!.tokens = this.tokenCounter.count(summary);
          });
        }
        result.push(summaryEntry);
        break;
      }
    }

    return result;
  }

  /**
   * Smart pruning - combines strategies
   */
  private smartPrune(entries: ContextEntry[], maxTokens: number, query?: string): ContextEntry[] {
    // Keep recent messages (within 30% of max tokens)
    const recentEntries: ContextEntry[] = [];
    let currentTokens = 0;
    let index = 0;

    for (const entry of entries) {
      const entryTokens = entry.metadata?.tokens || this.tokenCounter.count(entry.content);
      if (currentTokens + entryTokens <= maxTokens * 0.3) {
        recentEntries.push(entry);
        currentTokens += entryTokens;
        index++;
      } else {
        break;
      }
    }

    // Fill remaining space with most relevant entries
    const remaining = entries.slice(index);

    if (query) {
      const relevantEntries = this.filterByRelevance(remaining, query, 0.3);
      const sortedByRelevance = relevantEntries.sort(
        (a, b) => (b.metadata?.relevance || 0) - (a.metadata?.relevance || 0)
      );

      for (const entry of sortedByRelevance) {
        const entryTokens = entry.metadata?.tokens || this.tokenCounter.count(entry.content);
        if (currentTokens + entryTokens <= maxTokens) {
          recentEntries.push(entry);
          currentTokens += entryTokens;
        }
        if (currentTokens >= maxTokens) {
          break;
        }
      }
    } else {
      for (const entry of remaining) {
        const entryTokens = entry.metadata?.tokens || this.tokenCounter.count(entry.content);
        if (currentTokens + entryTokens <= maxTokens) {
          recentEntries.push(entry);
          currentTokens += entryTokens;
        }
        if (currentTokens >= maxTokens) {
          break;
        }
      }
    }

    return recentEntries;
  }

  /**
   * Clear all entries
   */
  clear(): void {
    this.entries = [];
  }

  /**
   * Get all entries
   */
  getAll(): ContextEntry[] {
    return [...this.entries];
  }

  /**
   * Remove entry by ID
   */
  remove(id: string): boolean {
    const index = this.entries.findIndex((e) => e.id === id);
    if (index >= 0) {
      this.entries.splice(index, 1);
      return true;
    }
    return false;
  }

  /**
   * Get approximate token count for all entries
   */
  getTotalTokens(): number {
    return this.entries.reduce((sum, e) => sum + (e.metadata?.tokens || 0), 0);
  }
}
