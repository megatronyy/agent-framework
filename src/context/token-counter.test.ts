/**
 * Token Counter Tests
 */

import { describe, it, expect } from "vitest";
import { SimpleTokenCounter } from "./token-counter.js";

describe("SimpleTokenCounter", () => {
  let counter: SimpleTokenCounter;

  beforeEach(() => {
    counter = new SimpleTokenCounter();
  });

  describe("countTokens", () => {
    it("should count tokens in text", () => {
      const result = counter.countTokens("Hello, world!");

      expect(result.tokens).toBeGreaterThan(0);
      expect(result.characters).toBe(13);
      expect(result.estimated).toBe(true);
    });

    it("should handle empty text", () => {
      const result = counter.countTokens("");

      expect(result.tokens).toBe(0);
      expect(result.characters).toBe(0);
    });

    it("should handle long text", () => {
      const longText = "a".repeat(1000);
      const result = counter.countTokens(longText);

      expect(result.tokens).toBeGreaterThan(0);
      expect(result.characters).toBe(1000);
    });
  });

  describe("countMessage", () => {
    it("should count tokens in user message", () => {
      const message = {
        role: "user" as const,
        content: "What is the weather today?",
      };

      const result = counter.countMessage(message);

      expect(result.tokens).toBeGreaterThan(0);
    });

    it("should count tokens in assistant message", () => {
      const message = {
        role: "assistant" as const,
        content: "The weather is sunny with a high of 75°F.",
      };

      const result = counter.countMessage(message);

      expect(result.tokens).toBeGreaterThan(0);
    });

    it("should count tokens in tool message", () => {
      const message = {
        role: "tool" as const,
        content: "Result: 42",
      };

      const result = counter.countMessage(message);

      expect(result.tokens).toBeGreaterThan(0);
    });
  });

  describe("countConversation", () => {
    it("should count tokens in multiple messages", () => {
      const messages = [
        { role: "user" as const, content: "Hello" },
        { role: "assistant" as const, content: "Hi there!" },
        { role: "user" as const, content: "How are you?" },
      ];

      const result = counter.countConversation(messages);

      expect(result.tokens).toBeGreaterThan(0);
      expect(result.characters).toBeGreaterThan(0);
    });

    it("should handle empty conversation", () => {
      const result = counter.countConversation([]);

      expect(result.tokens).toBe(0);
    });
  });

  describe("countWithSystemPrompt", () => {
    it("should count tokens with system prompt", () => {
      const systemPrompt = "You are a helpful assistant.";
      const messages = [
        { role: "user" as const, content: "Hello" },
        { role: "assistant" as const, content: "Hi!" },
      ];

      const result = counter.countWithSystemPrompt(systemPrompt, messages);

      expect(result.tokens).toBeGreaterThan(0);
      // Should be more than just conversation
      const convResult = counter.countConversation(messages);
      expect(result.tokens).toBeGreaterThan(convResult.tokens);
    });
  });

  describe("exceedsLimit", () => {
    it("should detect when limit is exceeded", () => {
      const messages = [
        { role: "user" as const, content: "a".repeat(1000) },
        { role: "assistant" as const, content: "b".repeat(1000) },
      ];

      const result = counter.exceedsLimit(messages, 100);

      expect(result).toBe(true);
    });

    it("should not exceed when under limit", () => {
      const messages = [
        { role: "user" as const, content: "Hi" },
        { role: "assistant" as const, content: "Hello!" },
      ];

      const result = counter.exceedsLimit(messages, 1000);

      expect(result).toBe(false);
    });
  });

  describe("truncateToFit", () => {
    it("should truncate messages to fit limit", () => {
      const messages = [
        { role: "user" as const, content: "Message 1" },
        { role: "assistant" as const, content: "Response 1" },
        { role: "user" as const, content: "Message 2" },
        { role: "assistant" as const, content: "Response 2" },
        { role: "user" as const, content: "Message 3" },
      ];

      const truncated = counter.truncateToFit(messages, 10); // Very low limit to force truncation

      // Should truncate
      expect(truncated.length).toBeLessThan(messages.length);
      // Should keep most recent (last message kept)
      expect(truncated[truncated.length - 1].content).toBe("Message 3");
    });

    it("should return empty array when limit is too small", () => {
      const messages = [
        { role: "user" as const, content: "Long message that exceeds limit" },
      ];

      const truncated = counter.truncateToFit(messages, 5);

      expect(truncated).toHaveLength(0);
    });
  });

  describe("calculateTokensToRemove", () => {
    it("should calculate tokens to remove", () => {
      const messages = [
        { role: "user" as const, content: "a".repeat(100) },
        { role: "assistant" as const, content: "b".repeat(100) },
      ];

      const toRemove = counter.calculateTokensToRemove(messages, 10);

      expect(toRemove).toBeGreaterThan(0);
    });

    it("should return 0 when under limit", () => {
      const messages = [
        { role: "user" as const, content: "Hi" },
      ];

      const toRemove = counter.calculateTokensToRemove(messages, 1000);

      expect(toRemove).toBe(0);
    });
  });
});
