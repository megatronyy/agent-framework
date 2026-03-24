/**
 * Simple Context Summarizer
 *
 * Compresses conversation history while preserving important information.
 */

import type { Message } from "./token-counter.js";
import type { TokenCounter } from "./token-counter.js";

/**
 * Summary section
 */
export interface SummarySection {
  title: string;
  content: string;
  timestamp: Date;
}

/**
 * Summary result
 */
export interface SummaryResult {
  summary: string;
  sections: SummarySection[];
  tokensReduced: number;
  compressionRatio: number;
}

/**
 * Summarizer options
 */
export interface SummarizerOptions {
  maxSummaryLength?: number;
  includeTimestamps?: boolean;
  preserveToolResults?: boolean;
}

/**
 * Default summarizer options
 */
const defaultOptions: Required<SummarizerOptions> = {
  maxSummaryLength: 2000,
  includeTimestamps: true,
  preserveToolResults: true,
};

/**
 * Simple context summarizer
 */
export class SimpleContextSummarizer {
  private options: Required<SummarizerOptions>;
  private tokenCounter?: TokenCounter;

  constructor(options?: SummarizerOptions, tokenCounter?: TokenCounter) {
    this.options = { ...defaultOptions, ...options };
    this.tokenCounter = tokenCounter;
  }

  /**
   * Summarize a conversation
   */
  async summarize(messages: Message[]): Promise<SummaryResult> {
    const originalTokens = this.tokenCounter
      ? this.tokenCounter.countConversation(messages).tokens
      : messages.length * 10; // Rough estimate

    const sections = this.extractSections(messages);
    const summary = this.buildSummary(sections);

    const summaryTokens = this.tokenCounter
      ? this.tokenCounter.countTokens(summary).tokens
      : summary.length * 10;

    return {
      summary,
      sections,
      tokensReduced: originalTokens - summaryTokens,
      compressionRatio: summaryTokens / originalTokens,
    };
  }

  /**
   * Summarize with a target token reduction
   */
  async summarizeToTarget(messages: Message[], targetTokens: number): Promise<SummaryResult> {
    const currentTokens = this.tokenCounter
      ? this.tokenCounter.countConversation(messages).tokens
      : messages.length * 10;

    if (currentTokens <= targetTokens) {
      return {
        summary: this.messagesToString(messages),
        sections: [],
        tokensReduced: 0,
        compressionRatio: 1,
      };
    }

    // Extract and prioritize key information
    const keyPoints = this.extractKeyPoints(messages);
    const recentConversation = this.getRecentMessages(messages, 10);

    const summary = this.buildTargetedSummary(keyPoints, recentConversation);

    const summaryTokens = this.tokenCounter
      ? this.tokenCounter.countTokens(summary).tokens
      : summary.length * 10;

    return {
      summary,
      sections: keyPoints.map((kp) => ({
        title: "Key Point",
        content: kp,
        timestamp: new Date(),
      })),
      tokensReduced: currentTokens - summaryTokens,
      compressionRatio: summaryTokens / currentTokens,
    };
  }

  /**
   * Extract meaningful sections from conversation
   */
  private extractSections(messages: Message[]): SummarySection[] {
    const sections: SummarySection[] = [];
    let currentSection: { content: string; messages: string[] } | null = null;

    for (const message of messages) {
      // User messages start new sections
      if (message.role === "user") {
        if (currentSection) {
          sections.push({
            title: "User Query",
            content: currentSection.messages.join("\n"),
            timestamp: new Date(),
          });
        }
        currentSection = {
          content: message.content.slice(0, 50),
          messages: [message.content],
        };
      } else if (message.role === "assistant" && currentSection) {
        currentSection.messages.push(message.content);
      } else if (message.role === "tool" && this.options.preserveToolResults) {
        // Tool results get their own section
        sections.push({
          title: "Tool Result",
          content: message.content.slice(0, 200),
          timestamp: new Date(),
        });
      }
    }

    if (currentSection) {
      sections.push({
        title: "User Query",
        content: currentSection.messages.join("\n"),
        timestamp: new Date(),
      });
    }

    return sections;
  }

  /**
   * Extract key points from messages
   */
  private extractKeyPoints(messages: Message[]): string[] {
    const points: string[] = [];

    for (const message of messages) {
      // Extract from user messages (questions, requests)
      if (message.role === "user") {
        const content = message.content.trim();
        if (content.length > 20) {
          points.push(`User: ${content.slice(0, 100)}...`);
        }
      }

      // Extract from assistant (decisions, outcomes)
      if (message.role === "assistant") {
        const lines = message.content.split("\n");
        for (const line of lines) {
          const trimmed = line.trim();
          // Look for declarative statements
          if (
            trimmed.length > 15 &&
            (trimmed.startsWith("I ") ||
              trimmed.startsWith("The ") ||
              trimmed.startsWith("Based on"))
          ) {
            points.push(trimmed.slice(0, 100));
            break; // One key point per assistant message
          }
        }
      }
    }

    return points.slice(0, 10); // Limit to 10 key points
  }

  /**
   * Get recent messages
   */
  private getRecentMessages(messages: Message[], count: number): Message[] {
    return messages.slice(-count);
  }

  /**
   * Build summary from sections
   */
  private buildSummary(sections: SummarySection[]): string {
    if (sections.length === 0) {
      return "No conversation to summarize.";
    }

    const parts: string[] = [];

    for (const section of sections) {
      const timestamp = this.options.includeTimestamps
        ? ` [${section.timestamp.toISOString()}]`
        : "";
      parts.push(`${section.title}${timestamp}:\n${section.content}`);
    }

    return parts.join("\n\n");
  }

  /**
   * Build targeted summary with specific structure
   */
  private buildTargetedSummary(keyPoints: string[], recent: Message[]): string {
    const parts: string[] = [];

    if (keyPoints.length > 0) {
      parts.push("## Key Points from Conversation");
      parts.push(...keyPoints);
      parts.push("");
    }

    if (recent.length > 0) {
      parts.push("## Recent Messages");
      for (const msg of recent) {
        parts.push(`${msg.role}: ${msg.content.slice(0, 200)}`);
      }
    }

    return parts.join("\n");
  }

  /**
   * Convert messages to string
   */
  private messagesToString(messages: Message[]): string {
    return messages
      .map((m) => `${m.role}: ${m.content}`)
      .join("\n");
  }
}
