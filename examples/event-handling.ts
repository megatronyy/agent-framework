/**
 * Event Handling Example
 *
 * This example demonstrates how to listen to and handle
 * agent lifecycle events.
 */

import { createAgent, builtinTools } from "@megatronyy/agent-framework";
import type { AgentEvent } from "@megatronyy/agent-framework";

async function main() {
  const agent = createAgent({
    id: "demo-agent",
    name: "Demo Agent",
    model: {
      provider: "anthropic",
      model: "claude-3-5-sonnet-20241022",
      apiKey: process.env.ANTHROPIC_API_KEY || "your-api-key-here",
    },
    systemPrompt: "You are a helpful assistant. Use tools when needed.",
    tools: builtinTools,
  });

  // Register event listeners
  const unsubscribe = agent.on((event: AgentEvent) => {
    switch (event.type) {
      case "session:start":
        console.log(`[${new Date(event.timestamp).toISOString()}] Session started`);
        break;

      case "session:end":
        console.log(`[${new Date(event.timestamp).toISOString()}] Session ended`);
        if (event.data?.usage) {
          console.log(`  Usage:`, event.data.usage);
        }
        break;

      case "tool:start":
        console.log(`Tool started: ${event.data?.tool}`);
        console.log(`  Input:`, event.data?.input);
        break;

      case "tool:end":
        console.log(`Tool completed: ${event.data?.tool} (${event.data?.durationMs}ms)`);
        break;

      case "tool:error":
        console.error(`Tool error: ${event.data?.tool}`);
        console.error(`  Error:`, event.data?.error);
        break;

      case "error":
        console.error(`Agent error:`, event.data);
        break;

      case "progress":
        console.log(`Progress: iteration ${event.data?.iteration}`);
        break;
    }
  });

  console.log("=== Running Agent with Event Monitoring ===\n");

  // Run the agent
  const result = await agent.run({
    message: "Calculate 15 * 27, then tell me the current time, and remember that my favorite color is blue.",
  });

  console.log("\n=== Final Response ===\n");
  console.log(result.response);

  // Check what's in memory
  const memoryResult = await agent.run({
    sessionId: result.metadata?.sessionId as string,
    message: "What's my favorite color?",
  });

  console.log("\n=== Memory Test ===\n");
  console.log(memoryResult.response);

  // Clean up
  unsubscribe();
}

main().catch(console.error);
