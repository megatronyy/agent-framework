/**
 * Context Engine tests
 */

import { describe, it, expect, beforeEach } from "vitest";
import { ContextEngine, SimpleTokenCounter, SimpleContextSummarizer } from "./ContextEngine.js";
import type { ContextEntry, ContextWindowConfig } from "../types.js";

describe("ContextEngine", () => {
  let engine: ContextEngine;
  let config: ContextWindowConfig;

  beforeEach(() => {
    config = {
      maxTokens: 1000,
      reserveForResponse: 200,
      pruneStrategy: "oldest",
    };
    engine = new ContextEngine(config);
  });

  it("should add entries to context", () => {
    const entry: ContextEntry = {
      id: "test-1",
      type: "message",
      content: "Hello, world!",
    };

    engine.add(entry);

    const all = engine.getAll();
    expect(all).toHaveLength(1);
    expect(all[0]).toEqual(entry);
  });

  it("should add messages to context", () => {
    engine.addMessage({
      role: "user",
      content: "Test message",
      timestamp: Date.now(),
    });

    const all = engine.getAll();
    expect(all).toHaveLength(1);
    expect(all[0].type).toBe("message");
  });

  it("should calculate token count", () => {
    engine.addMessage({
      role: "user",
      content: "This is a test message with some text",
    });

    const tokens = engine.getTotalTokens();
    expect(tokens).toBeGreaterThan(0);
  });

  it("should query context entries", () => {
    for (let i = 0; i < 5; i++) {
      engine.addMessage({
        role: "user",
        content: `Message ${i}`,
      });
    }

    const result = engine.query({ maxTokens: 500 });
    expect(result.entries.length).toBeGreaterThan(0);
    expect(result.totalTokens).toBeLessThanOrEqual(500);
  });

  it("should prune oldest entries when over limit", () => {
    // Add entries that exceed the token limit
    for (let i = 0; i < 20; i++) {
      engine.addMessage({
        role: "user",
        content: `A`.repeat(100), // Each message is ~25 tokens
      });
    }

    const result = engine.query({ maxTokens: 200 });
    expect(result.wasPruned).toBe(true);
    expect(result.totalTokens).toBeLessThanOrEqual(200);
  });

  it("should filter by relevance when query provided", () => {
    engine.addMessage({
      role: "user",
      content: "The weather is sunny today",
    });
    engine.addMessage({
      role: "user",
      content: "I like programming",
    });
    engine.addMessage({
      role: "user",
      content: "What's the weather like?",
    });

    const result = engine.query({
      query: "weather forecast",
      relevanceThreshold: 0.1,
    });

    // Should include messages with "weather"
    expect(result.entries.some((e) => e.content.includes("weather"))).toBe(true);
  });

  it("should remove entry by ID", () => {
    engine.add({
      id: "test-1",
      type: "message",
      content: "Test",
    });

    expect(engine.getAll()).toHaveLength(1);

    const removed = engine.remove("test-1");
    expect(removed).toBe(true);
    expect(engine.getAll()).toHaveLength(0);
  });

  it("should clear all entries", () => {
    engine.addMessage({ role: "user", content: "Test 1" });
    engine.addMessage({ role: "user", content: "Test 2" });

    expect(engine.getAll()).toHaveLength(2);

    engine.clear();
    expect(engine.getAll()).toHaveLength(0);
  });
});

describe("SimpleTokenCounter", () => {
  it("should count tokens in text", () => {
    const counter = new SimpleTokenCounter();
    const tokens = counter.count("Hello world, this is a test");
    expect(tokens).toBeGreaterThan(0);
  });

  it("should count tokens in messages", () => {
    const counter = new SimpleTokenCounter();
    const messages = [
      { role: "user" as const, content: "Hello" },
      { role: "assistant" as const, content: "Hi there!" },
    ];
    const tokens = counter.countMessages(messages);
    expect(tokens).toBeGreaterThan(0);
  });
});

describe("SimpleContextSummarizer", () => {
  it("should summarize entries", async () => {
    const summarizer = new SimpleContextSummarizer();
    const entries = [
      {
        id: "1",
        type: "message" as const,
        content: "Hello",
        metadata: { timestamp: Date.now() },
      },
      {
        id: "2",
        type: "message" as const,
        content: "How are you?",
        metadata: { timestamp: Date.now() },
      },
    ];

    const summary = await summarizer.summarize(entries);
    expect(summary).toContain("Conversation Summary");
    expect(summary).toContain("2");
  });

  it("should return empty string for empty entries", async () => {
    const summarizer = new SimpleContextSummarizer();
    const summary = await summarizer.summarize([]);
    expect(summary).toBe("");
  });
});
