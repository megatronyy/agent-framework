/**
 * File System Tools
 *
 * Tools for reading, writing, and listing files on the filesystem.
 * Includes security features to prevent path traversal attacks.
 */

import * as fs from "node:fs/promises";
import { resolve, dirname, join, normalize } from "node:path";
import type { Tool } from "../../types.js";
import { ValidationError, SecurityError } from "../../errors/index.js";
import { logFileAccess, logSecurityEvent, logToolError } from "../../audit/index.js";

/**
 * Secure file operations configuration
 */
interface FileSecurityConfig {
  allowedBaseDirectories?: string[];
  allowRelativePaths?: boolean;
  allowAbsolutePath?: boolean;
  maxFileSize?: number;
  allowedExtensions?: string[];
}

/**
 * Default security configuration
 */
const defaultSecurityConfig: FileSecurityConfig = {
  allowedBaseDirectories: [process.cwd(), "/tmp"],
  allowRelativePaths: true,
  allowAbsolutePath: true, // Allow absolute paths - security enforced via allowedBaseDirectories
  maxFileSize: 10 * 1024 * 1024, // 10MB
};

/**
 * Validate and resolve a file path
 */
function validateFilePath(
  filePath: string,
  config: FileSecurityConfig = defaultSecurityConfig,
  context: { agentId: string; sessionId: string }
): string {
  // Check for null bytes
  if (filePath.includes("\0")) {
    logSecurityEvent({
      agentId: context.agentId,
      sessionId: context.sessionId,
      event: "null_byte_in_path",
      details: { path: filePath },
      severity: "critical",
    });
    throw new SecurityError(
      "Path contains null byte",
      "NULL_BYTE_DETECTED",
      { path: filePath }
    );
  }

  // Normalize the path
  const normalized = normalize(filePath);

  // Check for path traversal attempts
  if (normalized.includes("..")) {
    logSecurityEvent({
      agentId: context.agentId,
      sessionId: context.sessionId,
      event: "path_traversal_attempt",
      details: { path: filePath, normalized },
      severity: "warning",
    });
    throw new SecurityError(
      "Path traversal detected: '..' not allowed",
      "PATH_TRAVERSAL",
      { path: filePath }
    );
  }

  // Check for home directory access
  if (normalized.startsWith("~") || normalized.includes("/~/")) {
    logSecurityEvent({
      agentId: context.agentId,
      sessionId: context.sessionId,
      event: "home_directory_access",
      details: { path: filePath },
      severity: "warning",
    });
    throw new SecurityError(
      "Home directory access not allowed",
      "HOME_ACCESS_BLOCKED",
      { path: filePath }
    );
  }

  // Resolve to absolute path
  const resolved = resolve(filePath);

  // Check if absolute paths are allowed
  if (filePath.startsWith("/") && !config.allowAbsolutePath) {
    throw new SecurityError(
      "Absolute paths not allowed",
      "ABSOLUTE_PATH_BLOCKED",
      { path: filePath }
    );
  }

  // Check against allowed base directories
  if (config.allowedBaseDirectories && config.allowedBaseDirectories.length > 0) {
    const allowed = config.allowedBaseDirectories.some((base) => {
      const resolvedBase = resolve(base);
      return resolved.startsWith(resolvedBase);
    });

    if (!allowed) {
      logSecurityEvent({
        agentId: context.agentId,
        sessionId: context.sessionId,
        event: "path_outside_allowed_directories",
        details: { path: filePath, resolved, allowed: config.allowedBaseDirectories },
        severity: "warning",
      });
      throw new SecurityError(
        `Path not within allowed directories: ${config.allowedBaseDirectories.join(", ")}`,
        "PATH_NOT_ALLOWED",
        { path: filePath, resolved }
      );
    }
  }

  // Check file extension if required
  if (config.allowedExtensions && config.allowedExtensions.length > 0) {
    const ext = resolved.split(".").pop()?.toLowerCase();
    if (!ext || !config.allowedExtensions.includes(ext)) {
      throw new ValidationError(
        `File extension not allowed. Allowed: ${config.allowedExtensions.join(", ")}`,
        "path",
        { path: filePath, allowedExtensions: config.allowedExtensions }
      );
    }
  }

  return resolved;
}

/**
 * File read tool - reads file contents
 */
export const fileReadTool: Tool = {
  name: "file_read",
  description: "Read the contents of a file from the filesystem. Paths are validated for security.",
  inputSchema: {
    type: "object",
    properties: {
      path: {
        type: "string",
        description: "Path to the file to read (relative paths only, no '..' allowed)",
      },
      encoding: {
        type: "string",
        description: "File encoding (default: utf-8)",
        default: "utf-8",
      },
      maxLength: {
        type: "number",
        description: "Maximum file size in bytes to read (default: 1MB)",
      },
    },
    required: ["path"],
  },
  handler: async ({ input, context }) => {
    const agentId = context.agentId;
    const sessionId = context.sessionId;

    try {
      // Validate path
      const validatedPath = validateFilePath(input.path as string, defaultSecurityConfig, { agentId, sessionId });

      // Check file size if stats available
      try {
        const stats = await fs.stat(validatedPath);
        const maxSize = (input.maxLength as number) || (defaultSecurityConfig.maxFileSize || 10 * 1024 * 1024);
        if (stats.size > maxSize) {
          throw new ValidationError(
            `File too large: ${stats.size} bytes (max: ${maxSize})`,
            "path",
            { size: stats.size, maxSize }
          );
        }
      } catch {
        // File might not exist, continue to read attempt
      }

      const encoding = (input.encoding as string || "utf-8") as BufferEncoding;
      const content = await fs.readFile(validatedPath, encoding);

      logFileAccess({
        agentId,
        sessionId,
        operation: "read",
        filePath: validatedPath,
        success: true,
      });

      return {
        content: JSON.stringify({
          success: true,
          path: validatedPath,
          content: content.toString(),
          size: content.length,
        }),
      };
    } catch (error) {
      if (error instanceof SecurityError || error instanceof ValidationError) {
        logSecurityEvent({
          agentId,
          sessionId,
          event: "file_read_blocked",
          details: { path: input.path, error: error.message },
          severity: "warning",
        });
      } else {
        logToolError({
          agentId,
          sessionId,
          toolName: "file_read",
          error: error as Error,
        });
      }

      return {
        isError: true,
        content: JSON.stringify({
          success: false,
          error: error instanceof Error ? error.message : String(error),
          code: error instanceof ValidationError ? "VALIDATION_ERROR" :
                error instanceof SecurityError ? "SECURITY_ERROR" : "READ_ERROR",
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
  description: "Write content to a file on the filesystem. Paths are validated for security.",
  inputSchema: {
    type: "object",
    properties: {
      path: {
        type: "string",
        description: "Path to the file to write (relative paths only, no '..' allowed)",
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
      createDirs: {
        type: "boolean",
        description: "Create parent directories if they don't exist (default: true)",
        default: true,
      },
    },
    required: ["path", "content"],
  },
  handler: async ({ input, context }) => {
    const agentId = context.agentId;
    const sessionId = context.sessionId;

    try {
      // Validate content size
      const content = input.content as string;
      const maxSize = defaultSecurityConfig.maxFileSize || 10 * 1024 * 1024;
      if (content.length > maxSize) {
        throw new ValidationError(
          `Content too large: ${content.length} bytes (max: ${maxSize})`,
          "content",
          { size: content.length, maxSize }
        );
      }

      // Validate path
      const validatedPath = validateFilePath(input.path as string, defaultSecurityConfig, { agentId, sessionId });

      // Ensure directory exists if requested
      const createDirs = (input.createDirs as boolean) !== false;
      if (createDirs) {
        const dir = dirname(validatedPath);
        await fs.mkdir(dir, { recursive: true });
      }

      const encoding = (input.encoding as string || "utf-8") as BufferEncoding;
      await fs.writeFile(validatedPath, content, encoding);

      logFileAccess({
        agentId,
        sessionId,
        operation: "write",
        filePath: validatedPath,
        success: true,
      });

      return {
        content: JSON.stringify({
          success: true,
          path: validatedPath,
          bytesWritten: content.length,
        }),
      };
    } catch (error) {
      if (error instanceof SecurityError || error instanceof ValidationError) {
        logSecurityEvent({
          agentId,
          sessionId,
          event: "file_write_blocked",
          details: { path: input.path, error: error.message },
          severity: "warning",
        });
      } else {
        logToolError({
          agentId,
          sessionId,
          toolName: "file_write",
          error: error as Error,
        });
      }

      return {
        isError: true,
        content: JSON.stringify({
          success: false,
          error: error instanceof Error ? error.message : String(error),
          code: error instanceof ValidationError ? "VALIDATION_ERROR" :
                error instanceof SecurityError ? "SECURITY_ERROR" : "WRITE_ERROR",
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
  description: "List the contents of a directory. Paths are validated for security.",
  inputSchema: {
    type: "object",
    properties: {
      path: {
        type: "string",
        description: "Path to the directory to list (relative paths only, no '..' allowed)",
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
      maxDepth: {
        type: "number",
        description: "Maximum recursion depth (default: 5)",
      },
    },
    required: ["path"],
  },
  handler: async ({ input, context }) => {
    const agentId = context.agentId;
    const sessionId = context.sessionId;

    try {
      const targetPath = input.path as string;

      // Validate path (allow directory listing in allowed bases)
      const validatedPath = validateFilePath(targetPath, defaultSecurityConfig, { agentId, sessionId });

      // Check if it's a directory
      const stats = await fs.stat(validatedPath);
      if (!stats.isDirectory()) {
        throw new ValidationError(
          "Path is not a directory",
          "path",
          { path: validatedPath }
        );
      }

      const recursive = (input.recursive as boolean) ?? false;
      const pattern = input.pattern as string | undefined;
      const maxDepth = (input.maxDepth as number) || 5;

      const entries: Array<{
        name: string;
        path: string;
        type: string;
        size?: number;
      }> = [];

      const listDir = async (dirPath: string, baseRel = "", depth = 0): Promise<void> => {
        // Check depth limit (don't recurse if we've reached the limit)
        if (depth >= maxDepth) {
          return;
        }

        const items = await fs.readdir(dirPath, { withFileTypes: true });

        for (const item of items) {
          const relPath = baseRel ? join(baseRel, item.name) : item.name;
          const fullPath = join(dirPath, item.name);

          // Skip hidden files
          if (item.name.startsWith(".")) {
            if (item.isDirectory()) {
              // Still recurse into hidden dirs if pattern matches
              if (recursive) {
                await listDir(fullPath, relPath, depth + 1);
              }
            }
            continue;
          }

          // Apply pattern filter if specified
          if (pattern) {
            const regex = new RegExp(
              pattern.replace(/\*/g, ".*").replace(/\?/g, ".")
            );
            if (!regex.test(relPath)) {
              if (item.isDirectory() && recursive) {
                await listDir(fullPath, relPath, depth + 1);
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
              const fileStats = await fs.stat(fullPath);
              entry.size = fileStats.size;
            } catch {
              // Ignore stat errors
            }
          }

          entries.push(entry);

          if (item.isDirectory() && recursive) {
            await listDir(fullPath, relPath, depth + 1);
          }
        }
      };

      await listDir(validatedPath);

      logFileAccess({
        agentId,
        sessionId,
        operation: "read",
        filePath: validatedPath,
        success: true,
      });

      return {
        content: JSON.stringify({
          success: true,
          path: validatedPath,
          count: entries.length,
          entries,
        }),
      };
    } catch (error) {
      if (error instanceof SecurityError || error instanceof ValidationError) {
        logSecurityEvent({
          agentId,
          sessionId,
          event: "file_list_blocked",
          details: { path: input.path, error: error.message },
          severity: "warning",
        });
      } else {
        logToolError({
          agentId,
          sessionId,
          toolName: "file_list",
          error: error as Error,
        });
      }

      return {
        isError: true,
        content: JSON.stringify({
          success: false,
          error: error instanceof Error ? error.message : String(error),
          code: error instanceof ValidationError ? "VALIDATION_ERROR" :
                error instanceof SecurityError ? "SECURITY_ERROR" : "LIST_ERROR",
        }),
      };
    }
  },
};
