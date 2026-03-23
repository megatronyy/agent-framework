/**
 * Extended Tools Example
 *
 * This example demonstrates the extended tools available in the agent-framework:
 * - web_fetch: Fetch and extract content from web pages
 * - web_search: Search the web for information
 * - file_read: Read files from the filesystem
 * - file_write: Write files to the filesystem
 * - file_list: List directory contents
 * - pdf_extract: Extract text from PDF files
 * - cron: Manage scheduled periodic tasks
 * - execute_code: Execute shell commands
 */

import { createAgent, allTools } from "@megatronyy/agent-framework";

async function main() {
  const agent = createAgent({
    id: "extended-tools-agent",
    name: "Extended Tools Agent",
    model: {
      provider: "anthropic",
      model: "claude-3-5-sonnet-20241022",
      apiKey: process.env.ANTHROPIC_API_KEY || "your-api-key-here",
    },
    systemPrompt: `You are a helpful assistant with access to various tools.
Use tools when they can help accomplish the user's task more effectively.`,
    tools: allTools,
    skills: true,
  });

  console.log("=== Extended Tools Demo ===\n");

  // Example 1: Calculator
  console.log("1. Calculator Tool");
  const calcResult = await agent.run({
    message: "Calculate 248 * 156 + 1024",
  });
  console.log(calcResult.response);
  console.log();

  // Example 2: File operations
  console.log("2. File Operations");
  const fileResult = await agent.run({
    message: "Create a file named example.txt with the content 'Hello from agent-framework!'",
  });
  console.log(fileResult.response);
  console.log();

  // Example 3: Cron job
  console.log("3. Cron Job");
  const cronResult = await agent.run({
    message: "Add a cron job that runs every day at 9am with the message 'Good morning!'",
  });
  console.log(cronResult.response);
  console.log();

  // List all cron jobs
  const listCronResult = await agent.run({
    message: "List all cron jobs",
  });
  console.log(listCronResult.response);
  console.log();

  // Example 4: Memory
  console.log("4. Memory Tool");
  const sessionId = listCronResult.metadata?.sessionId as string;

  await agent.run({
    sessionId,
    message: "Remember that my favorite color is purple",
  });

  const memoryResult = await agent.run({
    sessionId,
    message: "What's my favorite color?",
  });
  console.log(memoryResult.response);
  console.log();

  // Example 5: DateTime
  console.log("5. DateTime Tool");
  const dateTimeResult = await agent.run({
    sessionId,
    message: "What's the current date and time?",
  });
  console.log(dateTimeResult.response);
}

main().catch(console.error);
