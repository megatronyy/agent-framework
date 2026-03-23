/**
 * Tools module exports
 */

export { MemoryToolRegistry } from "./MemoryToolRegistry.js";
export { builtinTools, calculatorTool, dateTimeTool, memoryTool } from "./builtins/index.js";

// Import tools for the extendedTools array
import { webFetchTool } from "./web/web-fetch.js";
import { webSearchTool } from "./web/web-search.js";
import { fileReadTool, fileWriteTool, fileListTool } from "./file/file-tool.js";
import { pdfTool } from "./pdf/pdf-tool.js";
import { cronTool } from "./cron/cron-tool.js";
import { codeExecuteTool } from "./code/code-tool.js";
import { builtinTools } from "./builtins/index.js";

// Web tools
export { webFetchTool } from "./web/web-fetch.js";
export { webSearchTool } from "./web/web-search.js";

// File tools
export { fileReadTool, fileWriteTool, fileListTool } from "./file/file-tool.js";

// PDF tools
export { pdfTool } from "./pdf/pdf-tool.js";

// Cron tools
export { cronTool } from "./cron/cron-tool.js";

// Code tools
export { codeExecuteTool } from "./code/code-tool.js";

// All extended tools
export const extendedTools = [
  webFetchTool,
  webSearchTool,
  fileReadTool,
  fileWriteTool,
  fileListTool,
  pdfTool,
  cronTool,
  codeExecuteTool,
];

// All tools (builtins + extended)
export const allTools = [...builtinTools, ...extendedTools];
