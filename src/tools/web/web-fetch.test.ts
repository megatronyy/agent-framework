/**
 * Web fetch tool tests
 */

import { describe, it, expect, beforeEach } from "vitest";
import { webFetchTool } from "./web-fetch.js";

describe("Web Fetch Tool", () => {
  it("should have correct structure", () => {
    expect(webFetchTool.name).toBe("web_fetch");
    expect(webFetchTool.description).toBeTruthy();
    expect(webFetchTool.inputSchema).toBeDefined();
  });

  it("should validate schema", () => {
    const schema = webFetchTool.inputSchema;
    expect(schema.type).toBe("object");
    expect(schema.required).toContain("url");
    expect(schema.properties?.url).toBeDefined();
  });

  it("should handle missing URL in handler", async () => {
    const result = await webFetchTool.handler({
      input: {},
      context: { sessionId: "test", agentId: "test-agent" },
    });

    expect(result.isError).toBe(true);
    const content = JSON.parse(result.content as string);
    expect(content.error).toBeTruthy();
  });
});
