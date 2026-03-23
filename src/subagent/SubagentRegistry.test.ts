/**
 * Subagent Registry tests
 */

import { describe, it, expect, beforeEach } from "vitest";
import { SubagentRegistry } from "./SubagentRegistry.js";
import type { SubagentConfig } from "../types.js";

describe("SubagentRegistry", () => {
  let registry: SubagentRegistry;
  let mockConfig: SubagentConfig;

  beforeEach(() => {
    registry = new SubagentRegistry();
    mockConfig = {
      id: "test-subagent",
      name: "Test Subagent",
      description: "A test subagent",
      agentConfig: {
        id: "test-agent",
        name: "Test Agent",
        model: {
          provider: "anthropic",
          model: "claude-3-5-sonnet-20241022",
        },
      },
    };
  });

  it("should register a subagent", () => {
    registry.register(mockConfig);

    expect(registry.has("test-subagent")).toBe(true);
    expect(registry.get("test-subagent")).toEqual(mockConfig);
  });

  it("should unregister a subagent", () => {
    registry.register(mockConfig);
    expect(registry.has("test-subagent")).toBe(true);

    const result = registry.unregister("test-subagent");
    expect(result).toBe(true);
    expect(registry.has("test-subagent")).toBe(false);
  });

  it("should return undefined for non-existent subagent", () => {
    expect(registry.get("non-existent")).toBeUndefined();
  });

  it("should list all registered subagents", () => {
    registry.register(mockConfig);

    const config2: SubagentConfig = {
      ...mockConfig,
      id: "test-subagent-2",
      name: "Test Subagent 2",
    };
    registry.register(config2);

    const list = registry.list();
    expect(list).toHaveLength(2);
    expect(list.map((s) => s.id)).toContain("test-subagent");
    expect(list.map((s) => s.id)).toContain("test-subagent-2");
  });

  it("should find subagent by name", () => {
    registry.register(mockConfig);

    const found = registry.findByName("Test Subagent");
    expect(found).toEqual(mockConfig);
  });

  it("should find handoff target based on keywords", () => {
    const configWithHandoff: SubagentConfig = {
      ...mockConfig,
      handoff: [
        {
          keywords: ["billing", "payment", "invoice"],
          targetSubagentId: "billing-agent",
        },
      ],
    };

    registry.register(configWithHandoff);

    const target = registry.findHandoffTarget("I need help with my billing");
    expect(target).toBeDefined();
    expect(target?.id).toBe("test-subagent");
  });

  it("should return null when no handoff target matches", () => {
    registry.register(mockConfig);

    const target = registry.findHandoffTarget("Hello world");
    expect(target).toBeNull();
  });

  it("should clear all subagents", () => {
    registry.register(mockConfig);

    registry.clear();
    expect(registry.list()).toHaveLength(0);
    expect(registry.has("test-subagent")).toBe(false);
  });
});
