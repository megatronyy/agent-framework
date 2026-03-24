/**
 * Simple Token Counter
 *
 * Counts tokens in messages and conversation history.
 * Uses approximate character-based counting when tiktoken is unavailable.
 */

/**
 * Message format for token counting
 */
export interface Message {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
}

/**
 * Token count result
 */
export interface TokenCount {
  tokens: number;
  characters: number;
  estimated: boolean; // True if using character approximation
}

/**
 * Token counter options
 */
export interface TokenCounterOptions {
  tokensPerChar?: number; // Fallback: tokens per character ratio
  includeImages?: boolean; // Whether to count image tokens
}

/**
 * Default token counter options
 */
const defaultOptions: Required<TokenCounterOptions> = {
  tokensPerChar: 0.25, // Rough estimate: 4 chars per token
  includeImages: true,
};

/**
 * Simple token counter
 */
export class SimpleTokenCounter {
  private options: Required<TokenCounterOptions>;

  constructor(options?: TokenCounterOptions) {
    this.options = { ...defaultOptions, ...options };
  }

  /**
   * Count tokens in a text string
   */
  countTokens(text: string): TokenCount {
    const characters = text.length;
    return {
      tokens: this.estimateTokens(text),
      characters,
      estimated: true,
    };
  }

  /**
   * Count tokens in a message
   */
  countMessage(message: Message): TokenCount {
    let total = 0;
    let chars = 0;

    // Count content
    const contentCount = this.countTokens(message.content);
    total += contentCount.tokens;
    chars += contentCount.characters;

    // Add overhead for message structure (role, formatting)
    total += 4; // Rough estimate for message overhead

    return {
      tokens: total,
      characters: chars,
      estimated: true,
    };
  }

  /**
   * Count tokens in a conversation (array of messages)
   */
  countConversation(messages: Message[]): TokenCount {
    let totalTokens = 0;
    let totalChars = 0;

    for (const message of messages) {
      const count = this.countMessage(message);
      totalTokens += count.tokens;
      totalChars += count.characters;
    }

    return {
      tokens: totalTokens,
      characters: totalChars,
      estimated: true,
    };
  }

  /**
   * Count tokens in messages with system prompt
   */
  countWithSystemPrompt(systemPrompt: string, messages: Message[]): TokenCount {
    const systemCount = this.countTokens(systemPrompt);
    const conversationCount = this.countConversation(messages);

    return {
      tokens: systemCount.tokens + conversationCount.tokens,
      characters: systemCount.characters + conversationCount.characters,
      estimated: true,
    };
  }

  /**
   * Estimate tokens from text (character-based approximation)
   */
  private estimateTokens(text: string): number {
    // Remove extra whitespace
    const normalized = text.trim().replace(/\s+/g, " ");
    const chars = normalized.length;
    return Math.ceil(chars * this.options.tokensPerChar);
  }

  /**
   * Check if token count exceeds a limit
   */
  exceedsLimit(messages: Message[], limit: number, systemPrompt?: string): boolean {
    const count = systemPrompt
      ? this.countWithSystemPrompt(systemPrompt, messages)
      : this.countConversation(messages);
    return count.tokens > limit;
  }

  /**
   * Calculate how many tokens to remove to fit within limit
   */
  calculateTokensToRemove(messages: Message[], limit: number, systemPrompt?: string): number {
    const count = systemPrompt
      ? this.countWithSystemPrompt(systemPrompt, messages)
      : this.countConversation(messages);

    if (count.tokens <= limit) {
      return 0;
    }

    return count.tokens - limit;
  }

  /**
   * Truncate messages to fit within token limit
   */
  truncateToFit(messages: Message[], limit: number, systemPrompt?: string): Message[] {
    const systemTokens = systemPrompt
      ? this.countTokens(systemPrompt).tokens
      : 0;
    const availableForMessages = limit - systemTokens;

    if (availableForMessages <= 0) {
      return [];
    }

    const result: Message[] = [];
    let usedTokens = 0;

    // Keep messages from the end (most recent)
    for (let i = messages.length - 1; i >= 0; i--) {
      const count = this.countMessage(messages[i]);
      if (usedTokens + count.tokens > availableForMessages) {
        break;
      }
      result.unshift(messages[i]);
      usedTokens += count.tokens;
    }

    return result;
  }
}
