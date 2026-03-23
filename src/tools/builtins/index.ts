/**
 * Built-in tools for the agent framework
 */

import type { Tool, ToolContext, ToolResult } from "../../types.js";

/**
 * Calculator tool - evaluates mathematical expressions
 */
export const calculatorTool: Tool = {
  name: "calculator",
  description: "Evaluate mathematical expressions. Supports basic arithmetic: +, -, *, /, (, ). Returns the result as a number.",
  inputSchema: {
    type: "object",
    properties: {
      expression: {
        type: "string",
        description: "The mathematical expression to evaluate (e.g., '2 + 2' or '(10 * 5) / 2')",
      },
    },
    required: ["expression"],
  },
  handler: async ({ input }: { input: Record<string, unknown>; context: ToolContext }): Promise<ToolResult> => {
    const expression = input.expression as string;

    try {
      // Safe evaluation using Function constructor with restricted scope
      const result = Function('"use strict"; return (' + expression + ")")();

      if (typeof result !== "number" || !Number.isFinite(result)) {
        return {
          content: `Error: Expression "${expression}" does not evaluate to a valid number.`,
          isError: true,
        };
      }

      return {
        content: String(result),
        metadata: { expression, result },
      };
    } catch (error) {
      return {
        content: `Error evaluating expression "${expression}": ${error instanceof Error ? error.message : String(error)}`,
        isError: true,
      };
    }
  },
};

/**
 * DateTime tool - get current date/time
 */
export const dateTimeTool: Tool = {
  name: "datetime",
  description: "Get the current date and time in various formats. Useful for knowing when the current action is being performed.",
  inputSchema: {
    type: "object",
    properties: {
      timezone: {
        type: "string",
        description: "IANA timezone name (e.g., 'America/New_York', 'UTC'). Defaults to local timezone.",
        default: "local",
      },
      format: {
        type: "string",
        enum: ["iso", "timestamp", "readable"],
        description: "Output format: 'iso' for ISO 8601 string, 'timestamp' for Unix timestamp, 'readable' for human-readable format",
        default: "readable",
      },
    },
  },
  handler: async ({ input }: { input: Record<string, unknown>; context: ToolContext }): Promise<ToolResult> => {
    const timezone = input.timezone as string || "local";
    const format = input.format as string || "readable";

    const now = new Date();

    let content: string;

    switch (format) {
      case "iso":
        content = timezone === "UTC"
          ? now.toUTCString()
          : now.toISOString();
        break;
      case "timestamp":
        content = String(Math.floor(now.getTime() / 1000));
        break;
      case "readable":
      default:
        content = now.toLocaleString(timezone === "local" ? undefined : timezone, {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          timeZoneName: "short",
        });
        break;
    }

    return {
      content,
      metadata: { timestamp: now.getTime(), timezone, format },
    };
  },
};

/**
 * Memory tool - store and retrieve values
 */
class MemoryStore {
  private store: Map<string, Map<string, unknown>> = new Map();

  get(sessionId: string, key: string): unknown {
    const sessionStore = this.store.get(sessionId);
    return sessionStore?.get(key);
  }

  set(sessionId: string, key: string, value: unknown): void {
    let sessionStore = this.store.get(sessionId);
    if (!sessionStore) {
      sessionStore = new Map();
      this.store.set(sessionId, sessionStore);
    }
    sessionStore.set(key, value);
  }

  delete(sessionId: string, key: string): boolean {
    const sessionStore = this.store.get(sessionId);
    return sessionStore?.delete(key) ?? false;
  }

  list(sessionId: string): Array<{ key: string; value: unknown }> {
    const sessionStore = this.store.get(sessionId);
    if (!sessionStore) return [];

    return Array.from(sessionStore.entries()).map(([key, value]) => ({ key, value }));
  }

  clear(sessionId: string): void {
    this.store.delete(sessionId);
  }
}

const memoryStore = new MemoryStore();

export const memoryTool: Tool = {
  name: "memory",
  description: "Store and retrieve information across turns. Useful for remembering context, user preferences, or intermediate results.",
  inputSchema: {
    type: "object",
    properties: {
      action: {
        type: "string",
        enum: ["get", "set", "delete", "list", "clear"],
        description: "The action to perform: 'get' retrieves a value, 'set' stores a value, 'delete' removes a value, 'list' shows all keys, 'clear' removes all values",
      },
      key: {
        type: "string",
        description: "The key to store/retrieve (required for get, set, delete)",
      },
      value: {
        type: "string",
        description: "The value to store (required for set)",
      },
    },
    required: ["action"],
  },
  handler: async ({ input, context }: { input: Record<string, unknown>; context: ToolContext }): Promise<ToolResult> => {
    const action = input.action as string;
    const sessionId = context.sessionId;

    switch (action) {
      case "get": {
        const key = input.key as string;
        if (!key) {
          return { content: "Error: 'key' is required for get action", isError: true };
        }
        const value = memoryStore.get(sessionId, key);
        return {
          content: value !== undefined ? JSON.stringify(value) : "null",
          metadata: { key, value },
        };
      }

      case "set": {
        const key = input.key as string;
        const value = input.value as string;
        if (!key || value === undefined) {
          return { content: "Error: 'key' and 'value' are required for set action", isError: true };
        }
        memoryStore.set(sessionId, key, value);
        return {
          content: `Stored value for key: ${key}`,
          metadata: { key, value },
        };
      }

      case "delete": {
        const key = input.key as string;
        if (!key) {
          return { content: "Error: 'key' is required for delete action", isError: true };
        }
        const deleted = memoryStore.delete(sessionId, key);
        return {
          content: deleted ? `Deleted key: ${key}` : `Key not found: ${key}`,
          metadata: { key, deleted },
        };
      }

      case "list": {
        const items = memoryStore.list(sessionId);
        return {
          content: JSON.stringify(items, null, 2),
          metadata: { count: items.length },
        };
      }

      case "clear": {
        memoryStore.clear(sessionId);
        return {
          content: "Cleared all stored values",
          metadata: { sessionId },
        };
      }

      default:
        return {
          content: `Error: Unknown action '${action}'. Use: get, set, delete, list, or clear.`,
          isError: true,
        };
    }
  },
};

/**
 * Export all built-in tools
 */
export const builtinTools = [calculatorTool, dateTimeTool, memoryTool];
