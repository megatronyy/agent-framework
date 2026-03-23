/**
 * Built-in tools tests
 */

import { describe, it, expect, beforeEach } from "vitest";
import { calculatorTool, dateTimeTool, memoryTool } from "./index.js";
import type { ToolContext } from "../../types.js";

describe("Built-in Tools", () => {
  describe("calculatorTool", () => {
    it("should evaluate basic arithmetic", async () => {
      const result = await calculatorTool.handler({
        input: { expression: "2 + 2" },
        context: {} as ToolContext,
      });

      expect(result.content).toBe("4");
      expect(result.isError).toBeUndefined();
    });

    it("should handle complex expressions", async () => {
      const result = await calculatorTool.handler({
        input: { expression: "(10 * 5) / 2 + 3" },
        context: {} as ToolContext,
      });

      expect(result.content).toBe("28");
    });

    it("should return error for invalid expressions", async () => {
      const result = await calculatorTool.handler({
        input: { expression: "2 +" },
        context: {} as ToolContext,
      });

      expect(result.isError).toBe(true);
      expect(result.content).toContain("Error");
    });
  });

  describe("dateTimeTool", () => {
    it("should return readable date time by default", async () => {
      const result = await dateTimeTool.handler({
        input: {},
        context: {} as ToolContext,
      });

      expect(result.content).toBeTruthy();
      expect(result.isError).toBeUndefined();
    });

    it("should return ISO format when requested", async () => {
      const result = await dateTimeTool.handler({
        input: { format: "iso" },
        context: {} as ToolContext,
      });

      expect(result.content).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it("should return timestamp when requested", async () => {
      const result = await dateTimeTool.handler({
        input: { format: "timestamp" },
        context: {} as ToolContext,
      });

      expect(Number.parseInt(result.content)).toBeGreaterThan(0);
    });
  });

  describe("memoryTool", () => {
    const sessionId = "test-session";
    const context: ToolContext = {
      sessionId,
      agentId: "test-agent",
    };

    it("should store and retrieve values", async () => {
      // Set a value
      const setResult = await memoryTool.handler({
        input: { action: "set", key: "favorite_color", value: "blue" },
        context,
      });

      expect(setResult.isError).toBeUndefined();

      // Get the value
      const getResult = await memoryTool.handler({
        input: { action: "get", key: "favorite_color" },
        context,
      });

      expect(getResult.content).toBe('"blue"');
    });

    it("should list all stored values", async () => {
      // Store multiple values
      await memoryTool.handler({
        input: { action: "set", key: "name", value: "Alice" },
        context,
      });
      await memoryTool.handler({
        input: { action: "set", key: "age", value: "30" },
        context,
      });

      // List values
      const result = await memoryTool.handler({
        input: { action: "list" },
        context,
      });

      expect(result.content).toContain("name");
      expect(result.content).toContain("age");
    });

    it("should delete values", async () => {
      // Set a value
      await memoryTool.handler({
        input: { action: "set", key: "temp", value: "value" },
        context,
      });

      // Delete it
      const deleteResult = await memoryTool.handler({
        input: { action: "delete", key: "temp" },
        context,
      });

      expect(deleteResult.content).toContain("Deleted");

      // Verify it's gone
      const getResult = await memoryTool.handler({
        input: { action: "get", key: "temp" },
        context,
      });

      expect(getResult.content).toBe("null");
    });

    it("should clear all values", async () => {
      // Store some values
      await memoryTool.handler({
        input: { action: "set", key: "test1", value: "value1" },
        context,
      });
      await memoryTool.handler({
        input: { action: "set", key: "test2", value: "value2" },
        context,
      });

      // Clear all
      const clearResult = await memoryTool.handler({
        input: { action: "clear" },
        context,
      });

      expect(clearResult.content).toContain("Cleared");

      // List should be empty
      const listResult = await memoryTool.handler({
        input: { action: "list" },
        context,
      });

      expect(listResult.content).toBe("[]");
    });

    it("should return error for missing required parameters", async () => {
      const result = await memoryTool.handler({
        input: { action: "get" }, // Missing key
        context,
      });

      expect(result.isError).toBe(true);
    });
  });
});
