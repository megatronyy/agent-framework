/**
 * File tools tests
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { fileReadTool, fileWriteTool, fileListTool } from "./file-tool.js";
import * as fs from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";

describe("File Tools", () => {
  let testDir: string;

  beforeEach(async () => {
    // Use process.cwd() to ensure it's within allowedBaseDirectories
    // tmpdir() on some systems (e.g., macOS) returns /var/folders/... which isn't in the allowed list
    testDir = join(process.cwd(), ".tmp-test-" + Date.now());
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

    it("should reject path traversal attempts", async () => {
      const result = await fileWriteTool.handler({
        input: {
          path: "../../etc/passwd",
          content: "malicious",
        },
        context: { sessionId: "test", agentId: "test-agent" },
      });

      expect(result.isError).toBe(true);
      const parsed = JSON.parse(result.content as string);
      expect(parsed.code).toBe("SECURITY_ERROR");
      expect(parsed.error).toMatch(/path traversal/i); // Case-insensitive match
    });

    it("should reject null bytes in path", async () => {
      const result = await fileWriteTool.handler({
        input: {
          path: join(testDir, "test\0file.txt"),
          content: "test",
        },
        context: { sessionId: "test", agentId: "test-agent" },
      });

      expect(result.isError).toBe(true);
      const parsed = JSON.parse(result.content as string);
      expect(parsed.code).toBe("SECURITY_ERROR");
    });

    it("should reject paths outside allowed directories", async () => {
      const result = await fileWriteTool.handler({
        input: {
          path: "/etc/passwd",
          content: "malicious",
        },
        context: { sessionId: "test", agentId: "test-agent" },
      });

      expect(result.isError).toBe(true);
      const parsed = JSON.parse(result.content as string);
      expect(parsed.code).toBe("SECURITY_ERROR");
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

    it("should reject path traversal attempts", async () => {
      const result = await fileReadTool.handler({
        input: { path: "../../../etc/passwd" },
        context: { sessionId: "test", agentId: "test-agent" },
      });

      expect(result.isError).toBe(true);
      const parsed = JSON.parse(result.content as string);
      expect(parsed.code).toBe("SECURITY_ERROR");
    });

    it("should reject home directory access", async () => {
      const result = await fileReadTool.handler({
        input: { path: "~/.ssh/id_rsa" },
        context: { sessionId: "test", agentId: "test-agent" },
      });

      expect(result.isError).toBe(true);
      const parsed = JSON.parse(result.content as string);
      expect(parsed.code).toBe("SECURITY_ERROR");
      expect(parsed.error).toContain("Home directory");
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

    it("should reject path traversal attempts", async () => {
      const result = await fileListTool.handler({
        input: { path: "../../etc" },
        context: { sessionId: "test", agentId: "test-agent" },
      });

      expect(result.isError).toBe(true);
      const parsed = JSON.parse(result.content as string);
      expect(parsed.code).toBe("SECURITY_ERROR");
    });

    it("should skip hidden files", async () => {
      await fs.writeFile(join(testDir, ".hidden"), "hidden content");
      await fs.writeFile(join(testDir, "visible.txt"), "visible content");

      const result = await fileListTool.handler({
        input: { path: testDir },
        context: { sessionId: "test", agentId: "test-agent" },
      });

      const content = JSON.parse(result.content as string);
      expect(content.entries).toHaveLength(1);
      expect(content.entries[0].name).toBe("visible.txt");
    });

    it("should respect max depth in recursive listing", async () => {
      await fs.mkdir(join(testDir, "l1"), { recursive: true });
      await fs.mkdir(join(testDir, "l1", "l2"), { recursive: true });
      await fs.mkdir(join(testDir, "l1", "l2", "l3"), { recursive: true });
      await fs.writeFile(join(testDir, "l1", "l2", "l3", "deep.txt"), "deep");

      const result = await fileListTool.handler({
        input: { path: testDir, recursive: true, maxDepth: 2 },
        context: { sessionId: "test", agentId: "test-agent" },
      });

      const content = JSON.parse(result.content as string);
      // Should not include the deeply nested file
      const deepFile = content.entries.find((e: { path: string }) => e.path.includes("l3"));
      expect(deepFile).toBeUndefined();
    });
  });
});
