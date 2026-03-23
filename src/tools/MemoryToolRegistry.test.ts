/**
 * MemoryToolRegistry unit tests
 */

import { describe, it, expect, beforeEach } from "vitest";
import { MemoryToolRegistry } from "./MemoryToolRegistry.js";
import type { Tool } from "../types.js";

describe("MemoryToolRegistry", () => {
  let registry: MemoryToolRegistry;

  const mockTool: Tool = {
    name: "test_tool",
    description: "A test tool",
    inputSchema: { type: "object" },
    handler: async () => ({ content: "test" }),
  };

  const anotherTool: Tool = {
    name: "another_tool",
    description: "Another test tool",
    inputSchema: { type: "object" },
    handler: async () => ({ content: "another" }),
  };

  beforeEach(() => {
    registry = new MemoryToolRegistry();
  });

  describe("register", () => {
    it("should register a new tool", () => {
      registry.register(mockTool);
      expect(registry.has("test_tool")).toBe(true);
    });

    it("should throw when registering duplicate tool name", () => {
      registry.register(mockTool);

      expect(() => {
        registry.register(mockTool);
      }).toThrow("Tool already registered: test_tool");
    });
  });

  describe("unregister", () => {
    it("should remove a registered tool", () => {
      registry.register(mockTool);
      expect(registry.has("test_tool")).toBe(true);

      registry.unregister("test_tool");
      expect(registry.has("test_tool")).toBe(false);
    });

    it("should not throw when unregistering non-existent tool", () => {
      expect(() => {
        registry.unregister("non_existent");
      }).not.toThrow();
    });
  });

  describe("get", () => {
    it("should retrieve a registered tool", () => {
      registry.register(mockTool);
      const tool = registry.get("test_tool");

      expect(tool).toEqual(mockTool);
    });

    it("should return undefined for non-existent tool", () => {
      const tool = registry.get("non_existent");
      expect(tool).toBeUndefined();
    });
  });

  describe("list", () => {
    it("should return empty array when no tools registered", () => {
      const tools = registry.list();
      expect(tools).toEqual([]);
    });

    it("should return all registered tools", () => {
      registry.register(mockTool);
      registry.register(anotherTool);

      const tools = registry.list();
      expect(tools).toHaveLength(2);
      expect(tools).toContainEqual(mockTool);
      expect(tools).toContainEqual(anotherTool);
    });
  });

  describe("has", () => {
    it("should return true for registered tool", () => {
      registry.register(mockTool);
      expect(registry.has("test_tool")).toBe(true);
    });

    it("should return false for non-existent tool", () => {
      expect(registry.has("non_existent")).toBe(false);
    });
  });

  describe("clear", () => {
    it("should remove all tools", () => {
      registry.register(mockTool);
      registry.register(anotherTool);

      expect(registry.size()).toBe(2);

      registry.clear();
      expect(registry.size()).toBe(0);
      expect(registry.has("test_tool")).toBe(false);
      expect(registry.has("another_tool")).toBe(false);
    });
  });

  describe("size", () => {
    it("should return the number of registered tools", () => {
      expect(registry.size()).toBe(0);

      registry.register(mockTool);
      expect(registry.size()).toBe(1);

      registry.register(anotherTool);
      expect(registry.size()).toBe(2);

      registry.unregister("test_tool");
      expect(registry.size()).toBe(1);
    });
  });
});
