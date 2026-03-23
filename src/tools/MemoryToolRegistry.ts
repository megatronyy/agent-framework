/**
 * In-memory tool registry implementation
 */

import type { Tool, ToolRegistry } from "../types.js";

export class MemoryToolRegistry implements ToolRegistry {
  private tools: Record<string, Tool>;

  constructor() {
    this.tools = Object.create(null) as Record<string, Tool>;
  }

  register(tool: Tool): void {
    if (this.tools[tool.name]) {
      throw new Error(`Tool already registered: ${tool.name}`);
    }
    this.tools[tool.name] = tool;
  }

  unregister(name: string): void {
    delete this.tools[name];
  }

  get(name: string): Tool | undefined {
    return this.tools[name];
  }

  list(): Tool[] {
    return Object.values(this.tools);
  }

  has(name: string): boolean {
    return name in this.tools;
  }

  clear(): void {
    this.tools = Object.create(null) as Record<string, Tool>;
  }

  size(): number {
    return Object.keys(this.tools).length;
  }
}
