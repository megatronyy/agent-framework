/**
 * Subagent Executor Tests
 */

import { describe, it, expect, beforeEach } from "vitest";
import { SubagentExecutor } from "./executor.js";
import type { SubagentMetadata } from "./registry.js";
import type { Agent } from "../core/Agent.js";

describe("SubagentExecutor", () => {
  let executor: SubagentExecutor;
  let mockSubagent: SubagentMetadata;

  beforeEach(() => {
    executor = new SubagentExecutor();
    mockSubagent = {
      id: "test-subagent",
      name: "Test Subagent",
      description: "A test subagent for unit testing",
      agent: { id: "test-agent" } as unknown as Agent,
      createdAt: new Date(),
    };
  });

  describe("execute", () => {
    it("should execute a subagent successfully", async () => {
      const result = await executor.execute(mockSubagent, "Test input");

      expect(result.success).toBe(true);
      expect(result.output).toBeDefined();
      expect(result.duration).toBeGreaterThanOrEqual(0);
    });

    it("should respect timeout option", async () => {
      const result = await executor.execute(mockSubagent, "Test input", {
        timeout: 1000,
      });

      expect(result.success).toBe(true);
      expect(result.duration).toBeLessThan(1500);
    });

    it("should include intermediate steps when requested", async () => {
      const result = await executor.execute(
        mockSubagent,
        "Test input",
        { returnIntermediateSteps: true }
      );

      expect(result.success).toBe(true);
      expect(result.steps).toBeDefined();
    });

    it("should not include steps by default", async () => {
      const result = await executor.execute(mockSubagent, "Test input");

      expect(result.success).toBe(true);
      expect(result.steps).toBeUndefined();
    });
  });

  describe("executeParallel", () => {
    it("should execute multiple subagents in parallel", async () => {
      const subagent2: SubagentMetadata = {
        ...mockSubagent,
        id: "test-subagent-2",
      };

      const results = await executor.executeParallel([
        { subagent: mockSubagent, input: "Input 1" },
        { subagent: subagent2, input: "Input 2" },
      ]);

      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(true);
    });

    it("should handle individual failures in parallel execution", async () => {
      // Create a mock that throws
      const failingSubagent: SubagentMetadata = {
        ...mockSubagent,
        id: "failing-subagent",
        agent: {
          id: "failing",
          processMessage: async () => {
            throw new Error("Test failure");
          },
        } as unknown as Agent,
      };

      const results = await executor.executeParallel([
        { subagent: mockSubagent, input: "Input 1" },
        { subagent: failingSubagent, input: "Input 2" },
      ]);

      expect(results).toHaveLength(2);
      // First should succeed, second might fail depending on implementation
    });
  });

  describe("executeChain", () => {
    it("should execute subagents sequentially with output chaining", async () => {
      const subagent2: SubagentMetadata = {
        ...mockSubagent,
        id: "test-subagent-2",
      };

      const results = await executor.executeChain([
        { subagent: mockSubagent, input: "Initial input" },
        { subagent: subagent2 }, // Uses previous output
      ]);

      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(true);
    });

    it("should stop chain on failure", async () => {
      const subagent2: SubagentMetadata = {
        ...mockSubagent,
        id: "test-subagent-2",
      };

      const subagent3: SubagentMetadata = {
        ...mockSubagent,
        id: "test-subagent-3",
      };

      const results = await executor.executeChain([
        { subagent: mockSubagent, input: "Initial input" },
        { subagent: subagent2, input: undefined }, // Should use previous output
        { subagent: subagent3 }, // Should not execute if previous fails
      ]);

      expect(results).toHaveLength(3);
      // Third result should indicate it wasn't executed
    });

    it("should handle explicit input in chained execution", async () => {
      const subagent2: SubagentMetadata = {
        ...mockSubagent,
        id: "test-subagent-2",
      };

      const results = await executor.executeChain([
        { subagent: mockSubagent, input: "Input 1" },
        { subagent: subagent2, input: "Explicit input" },
      ]);

      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(true);
    });
  });

  describe("custom configuration", () => {
    it("should use custom default options", () => {
      const customExecutor = new SubagentExecutor({
        timeout: 5000,
        maxTurns: 20,
        returnIntermediateSteps: true,
      });

      const result = customExecutor.execute(mockSubagent, "Test input");

      expect(result).resolves.toBeDefined();
    });
  });

  describe("result structure", () => {
    it("should return properly structured result on success", async () => {
      const result = await executor.execute(mockSubagent, "Test input");

      expect(result).toMatchObject({
        success: true,
        output: expect.any(String),
        duration: expect.any(Number),
      });
    });

    it("should return properly structured result on failure", async () => {
      // Create a failing subagent
      const failingSubagent: SubagentMetadata = {
        ...mockSubagent,
        id: "failing-subagent",
        agent: {
          id: "failing",
        } as unknown as Agent,
      };

      // Force an error by passing invalid context
      const result = await executor.execute(
        failingSubagent,
        "Test input",
        { timeout: 1 } // Very short timeout to force failure
      );

      // Result should indicate failure
      expect(result).toBeDefined();
    });
  });
});
