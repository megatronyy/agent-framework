/**
 * Subagent Example
 *
 * Demonstrates how to use subagents for task delegation and specialization.
 */

import { createAgent, SubagentRegistry, createSubagentTool, createHandoffTool } from "@megatronyy/agent-framework";

async function main() {
  console.log("=== Subagent Example ===\n");

  // Create the main coordinator agent
  const coordinator = createAgent({
    id: "coordinator",
    name: "Coordinator",
    description: "Main agent that coordinates tasks among subagents",
    model: {
      provider: "anthropic",
      model: "claude-3-5-sonnet-20241022",
      apiKey: process.env.ANTHROPIC_API_KEY || "your-api-key-here",
    },
    systemPrompt: `You are a coordinator agent. Your job is to:
1. Understand the user's request
2. Delegate tasks to appropriate specialized subagents
3. Combine results from subagents into a coherent response

Use the delegate_to_subagent tool to assign tasks to specialists.`,
    tools: [],
  });

  // Create a subagent registry
  const registry = new SubagentRegistry();

  // Create specialized subagents
  const coderAgent = createAgent({
    id: "coder",
    name: "Coder",
    description: "Specialist in writing and debugging code",
    model: {
      provider: "anthropic",
      model: "claude-3-5-sonnet-20241022",
      apiKey: process.env.ANTHROPIC_API_KEY || "your-api-key-here",
    },
    systemPrompt: "You are a coding specialist. Write clean, well-documented code.",
    tools: [],
  });

  const writerAgent = createAgent({
    id: "writer",
    name: "Writer",
    description: "Specialist in writing and editing content",
    model: {
      provider: "anthropic",
      model: "claude-3-5-sonnet-20241022",
      apiKey: process.env.ANTHROPIC_API_KEY || "your-api-key-here",
    },
    systemPrompt: "You are a writing specialist. Create clear, engaging content.",
    tools: [],
  });

  const researcherAgent = createAgent({
    id: "researcher",
    name: "Researcher",
    description: "Specialist in finding and summarizing information",
    model: {
      provider: "anthropic",
      model: "claude-3-5-sonnet-20241022",
      apiKey: process.env.ANTHROPIC_API_KEY || "your-api-key-here",
    },
    systemPrompt: "You are a research specialist. Find and summarize information accurately.",
    tools: [],
  });

  // Register subagents
  registry.register({
    id: "coder",
    name: "Coder",
    description: "Coding specialist",
    agentConfig: coderAgent.config,
    handoff: [
      {
        keywords: ["code", "programming", "debug", "function", "api"],
        targetSubagentId: "coder",
      },
    ],
  });

  registry.register({
    id: "writer",
    name: "Writer",
    description: "Writing specialist",
    agentConfig: writerAgent.config,
    handoff: [
      {
        keywords: ["write", "edit", "content", "blog", "article"],
        targetSubagentId: "writer",
      },
    ],
  });

  registry.register({
    id: "researcher",
    name: "Researcher",
    description: "Research specialist",
    agentConfig: researcherAgent.config,
    handoff: [
      {
        keywords: ["find", "search", "lookup", "research", "information"],
        targetSubagentId: "researcher",
      },
    ],
  });

  // Create and add delegation tools to coordinator
  const subagentTool = createSubagentTool(coordinator);
  const handoffTool = createHandoffTool(coordinator);

  // Example: Single task delegation
  console.log("1. Single Task Delegation");
  console.log("-----------------------------------");
  console.log("User: Write a TypeScript function to calculate fibonacci numbers\n");

  // The coordinator would delegate to the coder agent
  // In a real implementation, you'd use SubagentExecutor
  // This is a simplified example

  console.log("\n2. Parallel Task Delegation");
  console.log("-----------------------------------");
  console.log("Tasks: [Code review, Documentation writing]\n");
  console.log("Coordinator delegates both tasks simultaneously...");

  console.log("\n3. Sequential Task Delegation");
  console.log("-----------------------------------");
  console.log("Tasks: [Research topic → Write article → Review content]\n");
  console.log("Coordinator delegates tasks in sequence, passing context...");

  console.log("\n4. Handoff");
  console.log("-----------------------------------");
  console.log("User: I need help with billing\n");
  console.log("Coordinator detects 'billing' keyword and hands off to billing agent...");

  console.log("\n=== Example Complete ===");
}

main().catch(console.error);
