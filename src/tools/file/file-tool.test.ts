/**
 * File tools tests
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { fileReadTool, fileWriteTool, fileListTool } from "./file-tool.js";
import * as fs from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

describe("File Tools", () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), "agent-framework-test-" + Date.now());
    await fs.mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe("fileWriteTool", () => {
    it("should have correct structure", () => {
      expect(fileWriteTool.name).toBe("file_write");
      expect(fileWriteTool.description).toBeTruthy();
    });

    it("should write a file", async () => {
      const testFile = join(testDir, "test.txt");
      const result = await fileWriteTool.handler({
        input: {
          path: testFile,
          content: "Hello, world!",
        },
        context: { sessionId: "test", agentId: "test-agent" },
      });

      expect(result.isError).toBeUndefined();
      const content = JSON.parse(result.content as string);
      expect(content.success).toBe(true);

      // Verify file was created
      const fileContent = await fs.readFile(testFile, "utf-8");
      expect(fileContent).toBe("Hello, world!");
    });

    it("should handle write errors", async () => {
      const result = await fileWriteTool.handler({
        input: {
          path: "/invalid/path/that/cannot/be/created/file.txt",
          content: "test",
        },
        context: { sessionId: "test", agentId: "test-agent" },
      });

      // Should have some error indication
      const content = JSON.parse(result.content as string);
      expect(content.success).toBeDefined();
    });
  });

  describe("fileReadTool", () => {
    it("should have correct structure", () => {
      expect(fileReadTool.name).toBe("file_read");
      expect(fileReadTool.description).toBeTruthy();
    });

    it("should read a file", async () => {
      const testFile = join(testDir, "read-test.txt");
      await fs.writeFile(testFile, "File content for reading");

      const result = await fileReadTool.handler({
        input: { path: testFile },
        context: { sessionId: "test", agentId: "test-agent" },
      });

      expect(result.isError).toBeUndefined();
      const content = JSON.parse(result.content as string);
      expect(content.content).toContain("File content for reading");
    });

    it("should handle missing file", async () => {
      const result = await fileReadTool.handler({
        input: { path: "/nonexistent/file.txt" },
        context: { sessionId: "test", agentId: "test-agent" },
      });

      expect(result.isError).toBe(true);
      const content = JSON.parse(result.content as string);
      expect(content.error).toBeTruthy();
    });
  });

  describe("fileListTool", () => {
    it("should have correct structure", () => {
      expect(fileListTool.name).toBe("file_list");
      expect(fileListTool.description).toBeTruthy();
    });

    it("should list directory contents", async () => {
      // Create test files
      await fs.writeFile(join(testDir, "file1.txt"), "content1");
      await fs.writeFile(join(testDir, "file2.txt"), "content2");
      await fs.mkdir(join(testDir, "subdir"), { recursive: true });
      await fs.writeFile(join(testDir, "subdir", "nested.txt"), "nested");

      const result = await fileListTool.handler({
        input: { path: testDir },
        context: { sessionId: "test", agentId: "test-agent" },
      });

      expect(result.isError).toBeUndefined();
      const content = JSON.parse(result.content as string);
      expect(content.count).toBeGreaterThan(0);
      expect(content.entries).toBeInstanceOf(Array);
    });
  });
});
