/**
 * File System Tools
 *
 * Tools for reading, writing, and listing files on the filesystem.
 */

import * as fs from "node:fs/promises";
import { join } from "node:path";
import type { Tool } from "../../types.js";

/**
 * File read tool - reads file contents
 */
export const fileReadTool: Tool = {
  name: "file_read",
  description: "Read the contents of a file from the filesystem",
  inputSchema: {
    type: "object",
    properties: {
      path: {
        type: "string",
        description: "Path to the file to read",
      },
      encoding: {
        type: "string",
        description: "File encoding (default: utf-8)",
        default: "utf-8",
      },
    },
    required: ["path"],
  },
  handler: async ({ input }) => {
    try {
      const encoding = (input.encoding as string || "utf-8") as BufferEncoding;
      const content = await fs.readFile(input.path as string, encoding);

      return {
        content: JSON.stringify({
          success: true,
          path: input.path,
          content: content.toString(),
          size: content.length,
        }),
      };
    } catch (error) {
      return {
        isError: true,
        content: JSON.stringify({
          success: false,
          error: (error as Error).message,
        }),
      };
    }
  },
};

/**
 * File write tool - writes content to a file
 */
export const fileWriteTool: Tool = {
  name: "file_write",
  description: "Write content to a file on the filesystem",
  inputSchema: {
    type: "object",
    properties: {
      path: {
        type: "string",
        description: "Path to the file to write",
      },
      content: {
        type: "string",
        description: "Content to write to the file",
      },
      encoding: {
        type: "string",
        description: "File encoding (default: utf-8)",
        default: "utf-8",
      },
    },
    required: ["path", "content"],
  },
  handler: async ({ input }) => {
    try {
      // Ensure directory exists
      const dir = join(input.path as string, "..");
      await fs.mkdir(dir, { recursive: true });

      const encoding = (input.encoding as string || "utf-8") as BufferEncoding;
      await fs.writeFile(
        input.path as string,
        input.content as string,
        encoding
      );

      return {
        content: JSON.stringify({
          success: true,
          path: input.path,
          bytesWritten: (input.content as string).length,
        }),
      };
    } catch (error) {
      return {
        isError: true,
        content: JSON.stringify({
          success: false,
          error: (error as Error).message,
        }),
      };
    }
  },
};

/**
 * File list tool - lists directory contents
 */
export const fileListTool: Tool = {
  name: "file_list",
  description: "List the contents of a directory",
  inputSchema: {
    type: "object",
    properties: {
      path: {
        type: "string",
        description: "Path to the directory to list",
      },
      recursive: {
        type: "boolean",
        description: "Whether to list recursively (default: false)",
        default: false,
      },
      pattern: {
        type: "string",
        description: "Optional glob pattern to filter entries",
      },
    },
    required: ["path"],
  },
  handler: async ({ input }) => {
    try {
      const path = input.path as string;
      const recursive = (input.recursive as boolean) ?? false;
      const pattern = input.pattern as string | undefined;

      const entries: Array<{
        name: string;
        path: string;
        type: string;
        size?: number;
      }> = [];

      const listDir = async (dirPath: string, baseRel = ""): Promise<void> => {
        const items = await fs.readdir(dirPath, { withFileTypes: true });

        for (const item of items) {
          const relPath = baseRel ? join(baseRel, item.name) : item.name;
          const fullPath = join(dirPath, item.name);

          // Apply pattern filter if specified
          if (pattern) {
            const regex = new RegExp(
              pattern.replace(/\*/g, ".*").replace(/\?/g, ".")
            );
            if (!regex.test(relPath)) {
              if (item.isDirectory() && recursive) {
                await listDir(fullPath, relPath);
              }
              continue;
            }
          }

          const entry: typeof entries[number] = {
            name: item.name,
            path: relPath,
            type: item.isDirectory() ? "directory" : "file",
          };

          if (item.isFile()) {
            try {
              const stats = await fs.stat(fullPath);
              entry.size = stats.size;
            } catch {
              // Ignore stat errors
            }
          }

          entries.push(entry);

          if (item.isDirectory() && recursive) {
            await listDir(fullPath, relPath);
          }
        }
      };

      await listDir(path);

      return {
        content: JSON.stringify({
          success: true,
          path,
          count: entries.length,
          entries,
        }),
      };
    } catch (error) {
      return {
        isError: true,
        content: JSON.stringify({
          success: false,
          error: (error as Error).message,
        }),
      };
    }
  },
};
