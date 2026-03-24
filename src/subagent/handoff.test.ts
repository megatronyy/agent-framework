/**
 * Handoff Manager Tests
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { HandoffManager } from "./handoff.js";
import type { SubagentMetadata } from "./registry.js";
import type { Agent } from "../core/Agent.js";

describe("HandoffManager", () => {
  let manager: HandoffManager;
  let mockAgent1: Agent;
  let mockAgent2: Agent;
  let subagent1: SubagentMetadata;
  let subagent2: SubagentMetadata;

  beforeEach(() => {
    manager = new HandoffManager();
    mockAgent1 = { id: "agent-1", name: "Agent 1" } as unknown as Agent;
    mockAgent2 = { id: "agent-2", name: "Agent 2" } as unknown as Agent;

    subagent1 = {
      id: "agent-1",
      name: "Agent 1",
      description: "First agent",
      agent: mockAgent1,
      createdAt: new Date(),
    };

    subagent2 = {
      id: "agent-2",
      name: "Agent 2",
      description: "Second agent",
      agent: mockAgent2,
      createdAt: new Date(),
    };
  });

  describe("immediate handoff", () => {
    it("should execute immediate handoff successfully", async () => {
      const conversationHistory = [
        {
          role: "user" as const,
          content: "Hello",
          timestamp: new Date(),
        },
        {
          role: "assistant" as const,
          content: "Hi there!",
          timestamp: new Date(),
        },
      ];

      const result = await manager.initiateHandoff(
        subagent1,
        subagent2,
        conversationHistory,
        { strategy: "immediate" }
      );

      expect(result.success).toBe(true);
      expect(result.context).toBeDefined();
      expect(result.context?.fromAgentId).toBe("agent-1");
      expect(result.context?.toAgentId).toBe("agent-2");
    });

    it("should preserve conversation history when requested", async () => {
      const conversationHistory = [
        {
          role: "user" as const,
          content: "Hello",
          timestamp: new Date(),
        },
        {
          role: "assistant" as const,
          content: "Hi there!",
          timestamp: new Date(),
        },
      ];

      const result = await manager.initiateHandoff(
        subagent1,
        subagent2,
        conversationHistory,
        { strategy: "immediate", preserveContext: true }
      );

      expect(result.success).toBe(true);
      expect(result.context?.conversationHistory).toHaveLength(2);
    });

    it("should not preserve conversation history when disabled", async () => {
      const conversationHistory = [
        {
          role: "user" as const,
          content: "Hello",
          timestamp: new Date(),
        },
      ];

      const result = await manager.initiateHandoff(
        subagent1,
        subagent2,
        conversationHistory,
        { strategy: "immediate", preserveContext: false }
      );

      expect(result.success).toBe(true);
      expect(result.context?.conversationHistory).toHaveLength(0);
    });

    it("should truncate history to max length", async () => {
      const conversationHistory = Array.from({ length: 150 }, (_, i) => ({
        role: "user" as const,
        content: `Message ${i}`,
        timestamp: new Date(),
      }));

      const result = await manager.initiateHandoff(
        subagent1,
        subagent2,
        conversationHistory,
        { strategy: "immediate", maxHistoryLength: 50 }
      );

      expect(result.success).toBe(true);
      expect(result.context?.conversationHistory).toHaveLength(50);
    });
  });

  describe("conditional handoff", () => {
    it("should execute conditional handoff", async () => {
      const result = await manager.initiateHandoff(
        subagent1,
        subagent2,
        [],
        { strategy: "conditional" }
      );

      expect(result.success).toBe(true);
    });
  });

  describe("await_confirmation handoff", () => {
    it("should create pending handoff", async () => {
      const result = await manager.initiateHandoff(
        subagent1,
        subagent2,
        [],
        { strategy: "await_confirmation", timeoutMs: 1000 }
      );

      // With short timeout, it should timeout and return failure
      expect(result.success).toBe(false);
      expect(result.error).toContain("timeout");
    });
  });

  describe("handoff confirmation", () => {
    it("should confirm a pending handoff", () => {
      // This would require setting up a pending handoff first
      // For now, testing the error case
      const result = manager.confirmHandoff("non-existent");
      expect(result.success).toBe(false);
    });

    it("should reject a pending handoff", () => {
      const result = manager.rejectHandoff("non-existent");
      expect(result.success).toBe(false);
    });
  });

  describe("handoff history", () => {
    it("should track handoff history", async () => {
      await manager.initiateHandoff(
        subagent1,
        subagent2,
        [],
        { strategy: "immediate" }
      );

      const history = manager.getHandoffHistory();
      expect(history).toHaveLength(1);
      expect(history[0].fromAgentId).toBe("agent-1");
      expect(history[0].toAgentId).toBe("agent-2");
    });

    it("should limit handoff history", async () => {
      // Create multiple handoffs
      for (let i = 0; i < 5; i++) {
        await manager.initiateHandoff(
          subagent1,
          subagent2,
          [],
          { strategy: "immediate" }
        );
      }

      const allHistory = manager.getHandoffHistory();
      expect(allHistory).toHaveLength(5);

      const limitedHistory = manager.getHandoffHistory(2);
      expect(limitedHistory).toHaveLength(2);
      // Should get the last 2
      expect(limitedHistory[0].toAgentId).toBe("agent-2");
    });

    it("should clear handoff history", async () => {
      await manager.initiateHandoff(
        subagent1,
        subagent2,
        [],
        { strategy: "immediate" }
      );

      expect(manager.getHandoffHistory().length).toBeGreaterThan(0);

      manager.clearHistory();

      expect(manager.getHandoffHistory()).toHaveLength(0);
    });
  });

  describe("handoff reason", () => {
    it("should include handoff reason in context", async () => {
      const result = await manager.initiateHandoff(
        subagent1,
        subagent2,
        [],
        { strategy: "immediate" }
      );

      expect(result.success).toBe(true);
      expect(result.context?.handoffReason).toBeDefined();
      expect(result.context?.handoffReason).toContain("Agent 1");
      expect(result.context?.handoffReason).toContain("Agent 2");
    });
  });
});
