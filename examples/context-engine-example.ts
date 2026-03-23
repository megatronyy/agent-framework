/**
 * Context Engine Example
 *
 * Demonstrates how to use the ContextEngine for intelligent context management.
 */

import { createAgent, ContextEngine, SimpleTokenCounter, InMemoryVectorStore } from "@megatronyy/agent-framework";

async function main() {
  console.log("=== Context Engine Example ===\n");

  // Create a context engine with different strategies
  const strategies: Array<{ name: string; config: any }> = [
    {
      name: "Oldest First (FIFO)",
      config: {
        maxTokens: 1000,
        reserveForResponse: 200,
        pruneStrategy: "oldest" as const,
      },
    },
    {
      name: "Smart Pruning",
      config: {
        maxTokens: 1000,
        reserveForResponse: 200,
        pruneStrategy: "smart" as const,
      },
    },
    {
      name: "Summarization",
      config: {
        maxTokens: 1000,
        reserveForResponse: 200,
        pruneStrategy: "summarize" as const,
      },
    },
  ];

  for (const { name, config } of strategies) {
    console.log(`1. ${name}`);
    console.log("=".repeat(50));

    const engine = new ContextEngine(config);

    // Add many messages to simulate a long conversation
    console.log("Adding 50 messages to context...");

    for (let i = 0; i < 50; i++) {
      engine.addMessage({
        role: i % 2 === 0 ? "user" : "assistant",
        content: `Message ${i + 1}: ${[
          "Hello, how are you?",
          "What's the weather like?",
          "Can you help me with coding?",
          "Tell me a joke",
          "What time is it?",
          "I need to schedule a meeting",
          "How do I use this API?",
          "What's for lunch?",
        ][i % 8]}`,
        timestamp: Date.now() - (50 - i) * 1000,
      });
    }

    // Query context
    const result = engine.query({
      maxTokens: 500,
      query: "meeting schedule API",
    });

    console.log(`  Total tokens: ${engine.getTotalTokens()}`);
    console.log(`  After pruning: ${result.totalTokens}`);
    console.log(`  Entries kept: ${result.entries.length}/50`);
    console.log(`  Was pruned: ${result.wasPruned}`);
    console.log(`  Was summarized: ${result.wasSummarized}`);
    console.log();
  }

  // RAG Example
  console.log("2. RAG (Retrieval-Augmented Generation)");
  console.log("=".repeat(50));

  const vectorStore = new InMemoryVectorStore();

  // Add knowledge base documents
  const knowledgeBase = [
    {
      id: "kb-1",
      content: "The API rate limit is 1000 requests per minute for paid accounts.",
      metadata: { source: "api-docs", category: "limits" },
    },
    {
      id: "kb-2",
      content: "To reset your password, go to Settings > Security > Reset Password.",
      metadata: { source: "user-guide", category: "security" },
    },
    {
      id: "kb-3",
      content: "The company offers free shipping on orders over $50.",
      metadata: { source: "shipping-policy", category: "shipping" },
    },
    {
      id: "kb-4",
      content: "API endpoints are available at https://api.example.com/v1/",
      metadata: { source: "api-docs", category: "endpoints" },
    },
    {
      id: "kb-5",
      content: "Refunds are processed within 5-7 business days.",
      metadata: { source: "refund-policy", category: "billing" },
    },
  ];

  await vectorStore.add(knowledgeBase);

  console.log(`Knowledge base: ${knowledgeBase.length} documents added\n`);

  // Search queries
  const queries = [
    "What is the API rate limit?",
    "How do I reset my password?",
    "Where can I find API endpoints?",
  ];

  for (const query of queries) {
    console.log(`Query: "${query}"`);
    const results = await vectorStore.search(query, 2);

    for (const result of results) {
      console.log(`  [${result.metadata.score.toFixed(2)}] ${result.content}`);
    }
    console.log();
  }

  // Token counting example
  console.log("3. Token Counter");
  console.log("=".repeat(50));

  const tokenCounter = new SimpleTokenCounter();

  const texts = [
    "Hello, world!",
    "The quick brown fox jumps over the lazy dog.",
    "Lorem ipsum dolor sit amet, consectetur adipiscing elit.",
  ];

  console.log("Approximate token counts:");
  for (const text of texts) {
    const tokens = tokenCounter.count(text);
    console.log(`  "${text.slice(0, 30)}..." → ${tokens} tokens`);
  }

  console.log("\n=== Example Complete ===");
}

main().catch(console.error);
