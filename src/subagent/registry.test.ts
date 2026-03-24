/**
 * Subagent Registry Tests
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { SubagentRegistry } from "./registry.js";
import type { Agent } from "../core/Agent.js";

describe("SubagentRegistry", () => {
  let registry: SubagentRegistry;
  let mockAgent: Agent;

  beforeEach(() => {
    registry = new SubagentRegistry();
    mockAgent = {
      id: "test-agent",
      name: "Test Agent",
    } as unknown as Agent;
  });

  afterEach(() => {
    registry.clear();
  });

  describe("registration", () => {
    it("should register a subagent", () => {
      registry.register({
        id: "subagent-1",
        name: "Subagent 1",
        description: "Test subagent",
        agent: mockAgent,
      });

      expect(registry.has("subagent-1")).toBe(true);
      expect(registry.get("subagent-1")).toBeDefined();
      expect(registry.get("subagent-1")?.name).toBe("Subagent 1");
    });

    it("should reject duplicate IDs by default", () => {
      registry.register({
        id: "subagent-1",
        name: "Subagent 1",
        description: "Test subagent",
        agent: mockAgent,
      });

      expect(() => {
        registry.register({
          id: "subagent-1",
          name: "Subagent 1 Duplicate",
          description: "Duplicate subagent",
          agent: mockAgent,
        });
      }).toThrow("already exists");
    });

    it("should allow duplicate IDs when configured", () => {
      const allowDuplicatesRegistry = new SubagentRegistry({
        allowDuplicateIds: true,
      });

      allowDuplicatesRegistry.register({
        id: "subagent-1",
        name: "Subagent 1",
        description: "Test subagent",
        agent: mockAgent,
      });

      expect(() => {
        allowDuplicatesRegistry.register({
          id: "subagent-1",
          name: "Subagent 1 Duplicate",
          description: "Duplicate subagent",
          agent: mockAgent,
        });
      }).not.toThrow();
    });

    it("should enforce max subagents limit", () => {
      const limitedRegistry = new SubagentRegistry({ maxSubagents: 2 });

      limitedRegistry.register({
        id: "subagent-1",
        name: "Subagent 1",
        description: "Test subagent",
        agent: mockAgent,
      });

      limitedRegistry.register({
        id: "subagent-2",
        name: "Subagent 2",
        description: "Test subagent",
        agent: mockAgent,
      });

      expect(() => {
        limitedRegistry.register({
          id: "subagent-3",
          name: "Subagent 3",
          description: "Test subagent",
          agent: mockAgent,
        });
      }).toThrow("Maximum subagents limit reached");
    });
  });

  describe("lookup", () => {
    it("should get a subagent by ID", () => {
      registry.register({
        id: "subagent-1",
        name: "Subagent 1",
        description: "Test subagent",
        agent: mockAgent,
      });

      const subagent = registry.get("subagent-1");
      expect(subagent).toBeDefined();
      expect(subagent?.id).toBe("subagent-1");
      expect(subagent?.name).toBe("Subagent 1");
    });

    it("should return undefined for non-existent subagent", () => {
      expect(registry.get("non-existent")).toBeUndefined();
    });

    it("should get agent instance", () => {
      registry.register({
        id: "subagent-1",
        name: "Subagent 1",
        description: "Test subagent",
        agent: mockAgent,
      });

      const agent = registry.getAgent("subagent-1");
      expect(agent).toBeDefined();
      expect(agent?.id).toBe("test-agent");
    });

    it("should list all subagent IDs", () => {
      registry.register({
        id: "subagent-1",
        name: "Subagent 1",
        description: "Test subagent",
        agent: mockAgent,
      });

      registry.register({
        id: "subagent-2",
        name: "Subagent 2",
        description: "Test subagent",
        agent: mockAgent,
      });

      const ids = registry.list();
      expect(ids).toHaveLength(2);
      expect(ids).toContain("subagent-1");
      expect(ids).toContain("subagent-2");
    });

    it("should list all subagent metadata", () => {
      registry.register({
        id: "subagent-1",
        name: "Subagent 1",
        description: "Test subagent",
        agent: mockAgent,
        parentId: "parent-1",
      });

      const metadata = registry.listMetadata();
      expect(metadata).toHaveLength(1);
      expect(metadata[0].id).toBe("subagent-1");
      expect(metadata[0].parentId).toBe("parent-1");
    });

    it("should get subagents by parent ID", () => {
      registry.register({
        id: "child-1",
        name: "Child 1",
        description: "Child subagent",
        agent: mockAgent,
        parentId: "parent-1",
      });

      registry.register({
        id: "child-2",
        name: "Child 2",
        description: "Another child",
        agent: mockAgent,
        parentId: "parent-1",
      });

      registry.register({
        id: "orphan",
        name: "Orphan",
        description: "No parent",
        agent: mockAgent,
      });

      const children = registry.getByParent("parent-1");
      expect(children).toHaveLength(2);
      expect(children.map((c) => c.id)).toContain("child-1");
      expect(children.map((c) => c.id)).toContain("child-2");
    });
  });

  describe("unregistration", () => {
    it("should unregister a subagent", () => {
      registry.register({
        id: "subagent-1",
        name: "Subagent 1",
        description: "Test subagent",
        agent: mockAgent,
      });

      expect(registry.has("subagent-1")).toBe(true);

      const result = registry.unregister("subagent-1");

      expect(result).toBe(true);
      expect(registry.has("subagent-1")).toBe(false);
    });

    it("should return false when unregistering non-existent subagent", () => {
      const result = registry.unregister("non-existent");
      expect(result).toBe(false);
    });
  });

  describe("registry management", () => {
    it("should clear all subagents", () => {
      registry.register({
        id: "subagent-1",
        name: "Subagent 1",
        description: "Test subagent",
        agent: mockAgent,
      });

      registry.register({
        id: "subagent-2",
        name: "Subagent 2",
        description: "Test subagent",
        agent: mockAgent,
      });

      expect(registry.size).toBe(2);

      registry.clear();

      expect(registry.size).toBe(0);
      expect(registry.has("subagent-1")).toBe(false);
      expect(registry.has("subagent-2")).toBe(false);
    });

    it("should report correct size", () => {
      expect(registry.size).toBe(0);

      registry.register({
        id: "subagent-1",
        name: "Subagent 1",
        description: "Test subagent",
        agent: mockAgent,
      });

      expect(registry.size).toBe(1);

      registry.register({
        id: "subagent-2",
        name: "Subagent 2",
        description: "Test subagent",
        agent: mockAgent,
      });

      expect(registry.size).toBe(2);

      registry.unregister("subagent-1");

      expect(registry.size).toBe(1);
    });
  });
});
