/**
 * Skills and Persona Example
 *
 * This example demonstrates how to use the skills system
 * and persona configuration to create a more personalized agent.
 */

import { createAgent, builtinTools } from "@megatronyy/agent-framework";
import type { Tool } from "@megatronyy/agent-framework";

// Define a custom tool for code review
const codeReviewTool: Tool = {
  name: "code_review",
  description: "Review code for style, security, performance, and best practices",
  inputSchema: {
    type: "object",
    properties: {
      code: {
        type: "string",
        description: "The code to review",
      },
      language: {
        type: "string",
        description: "The programming language (e.g., 'typescript', 'python')",
      },
    },
    required: ["code", "language"],
  },
  handler: async ({ input }) => {
    const { code, language } = input as { code: string; language: string };

    const issues: string[] = [];
    const suggestions: string[] = [];
    const positives: string[] = [];

    // Simple checks (in real use, you'd use a proper AST parser)
    if (code.includes("any")) {
      issues.push("Uses 'any' type - consider using specific types");
    }

    if (code.includes("console.log")) {
      issues.push("Contains console.log statements - remove for production");
    }

    if (code.includes("TODO") || code.includes("FIXME")) {
      suggestions.push("Contains TODO/FIXME comments - consider addressing");
    }

    if (code.length < 100) {
      positives.push("Code is concise and easy to read");
    }

    const review = {
      summary: `Code review for ${language} code`,
      issues,
      suggestions,
      positives,
    };

    return {
      content: JSON.stringify(review, null, 2),
      metadata: { language, codeLength: code.length },
    };
  },
};

async function main() {
  // Create an agent with skills and persona enabled
  const agent = createAgent({
    id: "code-reviewer",
    name: "Code Review Agent",
    model: {
      provider: "anthropic",
      model: "claude-3-5-sonnet-20241022",
      apiKey: process.env.ANTHROPIC_API_KEY || "your-api-key-here",
    },
    systemPrompt: "You are a helpful code reviewer. Use tools when available.",
    tools: [...builtinTools, codeReviewTool],
    skills: true, // Enable skills loading
    personaPath: process.cwd(), // Load persona from current directory
  });

  console.log("=== Skills and Persona Demo ===\n");

  // List available skills
  const skillRegistry = agent.getSkillRegistry();
  await agent.reloadSkills(); // Load skills from disk

  console.log("Available skills:");
  for (const skill of skillRegistry.list()) {
    console.log(`  - ${skill.name}: ${skill.description}`);
  }

  console.log("\n=== Running Agent ===\n");

  // Example 1: Use the code review tool
  const result1 = await agent.run({
    message: "Review this TypeScript code:\n```typescript\nfunction add(a: any, b: any): any {\n  console.log('Adding');\n  return a + b;\n}\n```",
  });

  console.log("Review Result:");
  console.log(result1.response);

  // Example 2: Calculator with skills
  const result2 = await agent.run({
    message: "Calculate 25 * 17 + 123",
  });

  console.log("\nCalculator Result:");
  console.log(result2.response);

  // Example 3: Memory across turns
  const sessionId = result2.metadata?.sessionId as string;

  await agent.run({
    sessionId,
    message: "Remember my favorite color is blue",
  });

  const result3 = await agent.run({
    sessionId,
    message: "What's my favorite color?",
  });

  console.log("\nMemory Test:");
  console.log(result3.response);
}

main().catch(console.error);
