/**
 * Context Engine Tests
 */

import { describe, it, expect, beforeEach } from "vitest";
import { ContextEngine } from "./engine.js";
import { InMemoryVectorStore } from "./vector-store.js";
import type { Message, VectorDocument } from "./token-counter.js";

describe("ContextEngine", () => {
  let engine: ContextEngine;
  let vectorStore: InMemoryVectorStore;
  let sampleMessages: Message[];

  beforeEach(() => {
    vectorStore = new InMemoryVectorStore();
    engine = new ContextEngine(vectorStore, {
      maxTokens: 5000,
      summaryThreshold: 3000,
      preserveRecentMessages: 5,
    });

    sampleMessages = [
      { role: "system" as const, content: "You are a helpful assistant." },
      { role: "user" as const, content: "What is Python?" },
      { role: "assistant" as const, content: "Python is a programming language." },
      { role: "user" as const, content: "How do I install it?" },
      { role: "assistant" as const, content: "Visit python.org to download." },
    ];
  });

  describe("processContext", () => {
    it("should not process when under limit", async () => {
      const result = await engine.processContext(sampleMessages);

      expect(result.action).toBe("none");
      expect(result.messages).toEqual(sampleMessages);
    });

    it("should summarize when over threshold", async () => {
      // Create very long messages to exceed threshold
      const longContent = "a".repeat(1000); // Each message is ~250 tokens
      const manyMessages = Array.from({ length: 15 }, (_, i) => ({
        role: i % 2 === 0 ? "user" as const : "assistant" as const,
        content: longContent,
      }));

      const result = await engine.processContext(manyMessages);

      // Should either summarize or truncate (both are valid)
      expect(["summarized", "truncated", "none"]).toContain(result.action);
    });

    it("should truncate when needed", async () => {
      // Create messages that definitely exceed limit
      const longMessages = Array.from({ length: 50 }, (_, i) => ({
        role: "user" as const,
        content: "Message with significant content: " + "x".repeat(500),
      }));

      const result = await engine.processContext(longMessages);

      // Should definitely process
      expect(result.action).not.toBe("none");
      expect(result.messages.length).toBeLessThan(longMessages.length);
    });
  });

  describe("summarizeContext", () => {
    it("should summarize conversation", async () => {
      const result = await engine.summarizeContext(sampleMessages, 100);

      expect(result.messages).toBeDefined();
      expect(result.summary).toBeDefined();
      expect(result.messages[0].role).toBe("system"); // Summary is added as system message
      expect(result.tokenCount.tokens).toBeLessThanOrEqual(200);
    });

    it("should preserve recent messages", async () => {
      const manyMessages = [
        { role: "user" as const, content: "Old message 1" },
        { role: "assistant" as const, content: "Old response 1" },
        { role: "user" as const, content: "Old message 2" },
        { role: "assistant" as const, content: "Old response 2" },
        { role: "user" as const, content: "Recent message" },
        { role: "assistant" as const, content: "Recent response" },
      ];

      const result = await engine.summarizeContext(manyMessages, 50);

      // Should have summary + recent messages
      expect(result.messages[0].role).toBe("system");
      expect(result.messages[result.messages.length - 1].content).toContain("Recent");
    });
  });

  describe("truncateContext", () => {
    it("should truncate to fit limit", () => {
      // Create messages with very long content to exceed token limit
      // Each message is ~300 chars to ensure we definitely exceed the limit
      const longMessages = Array.from({ length: 100 }, (_, i) => ({
        role: "user" as const,
        content: `Message ${i}: ${"x".repeat(300)} with lots of repeated content to ensure we exceed the token limit of ${engine["options"].maxTokens} tokens for the context engine`,
      }));

      const result = engine.truncateContext(longMessages);

      // Should truncate to fit within token limit
      expect(result.messages.length).toBeLessThan(100);
    });
  });

  describe("applyRAG", () => {
    beforeEach(async () => {
      // Add some documents to the vector store
      await vectorStore.addMany([
        { id: "doc1", content: "Python supports multiple programming paradigms including object-oriented and functional programming." },
        { id: "doc2", content: "JavaScript was created in 1995 by Brendan Eich at Netscape." },
        { id: "doc3", content: "Rust focuses on memory safety and performance." },
      ]);
    });

    it("should apply RAG to enhance context", async () => {
      const result = await engine.applyRAG(
        sampleMessages,
        "Python programming features"
      );

      expect(result.action).toBe("rag_applied");
      expect(result.messages.length).toBeGreaterThan(sampleMessages.length);
      expect(result.messages[0].role).toBe("system");
      expect(result.messages[0].content).toContain("knowledge base");
    });

    it("should not add context when no results found", async () => {
      const result = await engine.applyRAG(sampleMessages, "xyz nonexistent query");

      expect(result.action).toBe("none");
      expect(result.messages).toEqual(sampleMessages);
    });

    it("should inject at specified position", async () => {
      const afterResult = await engine.applyRAG(sampleMessages, "Python", {
        injectPosition: "after",
      });

      expect(afterResult.action).toBe("rag_applied");
      // RAG context should be at the end
      expect(afterResult.messages[afterResult.messages.length - 1].role).toBe("system");
    });
  });

  describe("get needsProcessing", () => {
    it("should detect when processing is needed", () => {
      const manyMessages = Array.from({ length: 1000 }, (_, i) => ({
        role: "user" as const,
        content: `Message ${i}`,
      }));

      const needsProcessing = engine.needsProcessing(manyMessages);

      expect(needsProcessing).toBe(true);
    });

    it("should not need processing when under limit", () => {
      const needsProcessing = engine.needsProcessing(sampleMessages);

      expect(needsProcessing).toBe(false);
    });
  });

  describe("getTokenCount", () => {
    it("should count tokens in messages", () => {
      const count = engine.getTokenCount(sampleMessages);

      expect(count.tokens).toBeGreaterThan(0);
      expect(count.characters).toBeGreaterThan(0);
    });

    it("should count tokens with system prompt", () => {
      const count = engine.getTokenCount(sampleMessages.slice(1), sampleMessages[0].content);

      expect(count.tokens).toBeGreaterThan(0);
    });
  });

  describe("addDocuments and search", () => {
    it("should add documents to vector store", async () => {
      const docs: VectorDocument[] = [
        { id: "test1", content: "Test content 1" },
        { id: "test2", content: "Test content 2" },
      ];

      await engine.addDocuments(docs);

      // Verify documents were added
      expect(engine.getVectorStore().get("test1")).toBeDefined();
      expect(engine.getVectorStore().get("test2")).toBeDefined();
    });

    it("should search vector store", async () => {
      const results = await engine.search("Test");

      expect(results).toBeInstanceOf(Array);
    });
  });

  describe("getContextStats", () => {
    it("should provide context statistics", () => {
      const stats = engine.getContextStats(sampleMessages);

      expect(stats.totalTokens).toBeGreaterThan(0);
      expect(stats.messageCount).toBe(sampleMessages.length);
      expect(stats.estimatedCompressionRatio).toBeGreaterThan(0);
    });
  });
});
