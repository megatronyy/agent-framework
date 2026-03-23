/**
 * Basic Usage Example
 *
 * This example demonstrates the simplest way to use the agent framework
 * to create a conversational AI agent.
 */

import { createTextAgent } from "@megatronyy/agent-framework";

async function main() {
  // Create a simple agent with an API key
  const agent = createTextAgent({
    apiKey: process.env.ANTHROPIC_API_KEY || "your-api-key-here",
    model: "claude-3-5-sonnet-20241022",
    provider: "anthropic",
    systemPrompt: "You are a helpful assistant that provides clear and concise answers.",
  });

  // Run the agent with a message
  const result = await agent.run({
    message: "What is the capital of France?",
    onProgress: (token) => {
      process.stdout.write(token); // Stream tokens as they arrive
    },
  });

  console.log("\n---");
  console.log("Response:", result.response);
  console.log("Session ID:", result.metadata?.sessionId);

  // Continue the conversation in the same session
  const followUp = await agent.run({
    sessionId: result.metadata?.sessionId as string,
    message: "And what's its population?",
  });

  console.log("\nFollow-up:", followUp.response);
}

main().catch(console.error);
