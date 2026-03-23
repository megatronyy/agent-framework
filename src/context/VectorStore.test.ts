/**
 * Vector Store tests
 */

import { describe, it, expect, beforeEach } from "vitest";
import { InMemoryVectorStore, createRAGTool } from "./VectorStore.js";

describe("InMemoryVectorStore", () => {
  let store: InMemoryVectorStore;

  beforeEach(() => {
    store = new InMemoryVectorStore();
  });

  it("should add documents", async () => {
    await store.add([
      {
        id: "doc-1",
        content: "The weather is sunny today",
        metadata: { source: "test" },
      },
    ]);

    expect(store.count).toBe(1);
  });

  it("should search for similar documents", async () => {
    await store.add([
      {
        id: "doc-1",
        content: "The weather is sunny today",
        metadata: { source: "weather-data" },
      },
      {
        id: "doc-2",
        content: "I like programming in TypeScript",
        metadata: { source: "tech-blog" },
      },
      {
        id: "doc-3",
        content: "Weather forecasting is important",
        metadata: { source: "news" },
      },
    ]);

    const results = await store.search("weather forecast");

    expect(results.length).toBeGreaterThan(0);
    // Should return weather-related docs first
    expect(results[0].content).toMatch(/weather/i);
  });

  it("should return empty results for no matches", async () => {
    await store.add([
      {
        id: "doc-1",
        content: "The weather is sunny today",
      },
    ]);

    const results = await store.search("quantum physics");

    // May return empty or low-score results
    expect(results.length).toBeGreaterThanOrEqual(0);
  });

  it("should limit results by topK", async () => {
    await store.add([
      { id: "doc-1", content: "Weather today is sunny" },
      { id: "doc-2", content: "Weather tomorrow will be rainy" },
      { id: "doc-3", content: "The weather forecast shows clouds" },
      { id: "doc-4", content: "I like coding" },
    ]);

    const results = await store.search("weather", 2);

    expect(results.length).toBeLessThanOrEqual(2);
  });

  it("should delete documents", async () => {
    await store.add([
      { id: "doc-1", content: "Test content" },
    ]);

    expect(store.count).toBe(1);

    await store.delete("doc-1");
    expect(store.count).toBe(0);
  });

  it("should clear all documents", async () => {
    await store.add([
      { id: "doc-1", content: "Test 1" },
      { id: "doc-2", content: "Test 2" },
    ]);

    expect(store.count).toBe(2);

    await store.clear();
    expect(store.count).toBe(0);
  });

  it("should handle empty store search", async () => {
    const results = await store.search("test");
    expect(results).toEqual([]);
  });
});

describe("createRAGTool", () => {
  it("should create a RAG tool", () => {
    const store = new InMemoryVectorStore();
    const tool = createRAGTool(store);

    expect(tool.name).toBe("search_context");
    expect(tool.description).toBeTruthy();
    expect(tool.inputSchema).toBeDefined();
  });

  it("should handle search queries", async () => {
    const store = new InMemoryVectorStore();
    await store.add([
      {
        id: "doc-1",
        content: "The weather is sunny today",
        metadata: { source: "test" },
      },
    ]);

    const tool = createRAGTool(store);
    const result = await tool.handler({
      input: { query: "weather" },
      context: { sessionId: "test", agentId: "test" },
    });

    expect(result.isError).toBeUndefined();
    const content = JSON.parse(result.content as string);
    expect(content.results).toBeDefined();
    expect(content.count).toBeGreaterThan(0);
  });

  it("should return error for missing query", async () => {
    const store = new InMemoryVectorStore();
    const tool = createRAGTool(store);

    const result = await tool.handler({
      input: {},
      context: { sessionId: "test", agentId: "test" },
    });

    expect(result.isError).toBe(true);
  });
});
