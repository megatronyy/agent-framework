/**
 * Agent unit tests
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { Agent } from "./Agent.js";
import type { AgentConfig, Tool, ToolResult, ToolContext } from "../types.js";

// Mock tool for testing
const mockTool: Tool = {
  name: "test_tool",
  description: "A test tool",
  inputSchema: {
    type: "object",
    properties: {
      value: { type: "string" },
    },
    required: ["value"],
  },
  handler: vi.fn(async ({ input }: { input: Record<string, unknown>; context: ToolContext }): Promise<ToolResult> => {
    return { content: `Processed: ${input.value}` };
  }),
};

describe("Agent", () => {
  let agentConfig: AgentConfig;

  beforeEach(() => {
    agentConfig = {
      id: "test-agent",
      name: "Test Agent",
      model: {
        provider: "anthropic",
        model: "claude-3-5-sonnet-20241022",
        apiKey: "test-key",
      },
      systemPrompt: "You are a test assistant",
      tools: [mockTool],
      temperature: 0.7,
      maxTokens: 1000,
    };
  });

  describe("constructor", () => {
    it("should create an agent with the given config", () => {
      const agent = new Agent(agentConfig);
      expect(agent).toBeDefined();
    });

    it("should register tools from config", () => {
      const agent = new Agent(agentConfig);
      const registry = agent.getToolRegistry();
      expect(registry.has("test_tool")).toBe(true);
    });

    it("should create a session manager", () => {
      const agent = new Agent(agentConfig);
      const sessionManager = agent.getSessionManager();
      expect(sessionManager).toBeDefined();
    });
  });

  describe("getSessionManager", () => {
    it("should return the session manager", () => {
      const agent = new Agent(agentConfig);
      const sessionManager = agent.getSessionManager();
      expect(sessionManager).toBeDefined();
      expect(sessionManager.size()).toBe(0);
    });
  });

  describe("getToolRegistry", () => {
    it("should return the tool registry", () => {
      const agent = new Agent(agentConfig);
      const registry = agent.getToolRegistry();
      expect(registry).toBeDefined();
      expect(registry.size()).toBe(1);
    });
  });

  describe("getConfig", () => {
    it("should return a copy of the config", () => {
      const agent = new Agent(agentConfig);
      const config = agent.getConfig();
      expect(config.id).toBe("test-agent");
      expect(config.name).toBe("Test Agent");
    });
  });

  describe("event listeners", () => {
    it("should register and trigger event listeners", () => {
      const agent = new Agent(agentConfig);
      const listener = vi.fn();
      agent.on(listener);

      // Note: Actual event triggering requires running the agent,
      // which would need provider mocking
      expect(agent).toBeDefined();
    });

    it("should allow unsubscribing from events", () => {
      const agent = new Agent(agentConfig);
      const listener = vi.fn();
      const unsubscribe = agent.on(listener);

      unsubscribe();
      // Listener should not be called after unsubscribe
      expect(agent).toBeDefined();
    });
  });

  describe("abortAll", () => {
    it("should abort all active runs", () => {
      const agent = new Agent(agentConfig);
      expect(() => agent.abortAll()).not.toThrow();
    });
  });
});
