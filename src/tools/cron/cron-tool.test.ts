/**
 * Cron tool tests
 */

import { describe, it, expect, beforeEach } from "vitest";
import { cronTool } from "../cron/cron-tool.js";

describe("Cron Tool", () => {
  beforeEach(() => {
    // Clear cron jobs before each test
    // Note: This would need to be implemented if we had a clear method
  });

  it("should have correct structure", () => {
    expect(cronTool.name).toBe("cron");
    expect(cronTool.description).toBeTruthy();
  });

  it("should validate schema", () => {
    const schema = cronTool.inputSchema;
    expect(schema.type).toBe("object");
    expect(schema.properties?.action).toBeDefined();
    expect(schema.required).toContain("action");
  });

  it("should handle add action", async () => {
    const result = await cronTool.handler({
      input: {
        action: "add",
        id: "test-job",
        name: "Test Job",
        schedule: "0 9 * * *",
        message: "Good morning!",
      },
      context: { sessionId: "test", agentId: "test-agent" },
    });

    expect(result.isError).toBeUndefined();
    const content = JSON.parse(result.content as string);
    expect(content.success).toBe(true);
    expect(content.job.id).toBe("test-job");
  });

  it("should handle invalid cron expression", async () => {
    const result = await cronTool.handler({
      input: {
        action: "add",
        id: "test-job",
        name: "Test Job",
        schedule: "invalid-cron",
      },
      context: { sessionId: "test", agentId: "test-agent" },
    });

    expect(result.isError).toBe(true);
    const content = JSON.parse(result.content as string);
    expect(content.error).toBeTruthy();
  });

  it("should list jobs", async () => {
    // First add a job
    await cronTool.handler({
      input: {
        action: "add",
        id: "list-test",
        name: "List Test",
        schedule: "0 12 * * *",
      },
      context: { sessionId: "test", agentId: "test-agent" },
    });

    const result = await cronTool.handler({
      input: { action: "list" },
      context: { sessionId: "test", agentId: "test-agent" },
    });

    expect(result.isError).toBeUndefined();
    const content = JSON.parse(result.content as string);
    expect(content.jobs).toBeInstanceOf(Array);
    expect(content.jobs.length).toBeGreaterThan(0);
  });
});
