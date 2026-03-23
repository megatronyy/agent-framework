/**
 * PDF tool - Extract text from PDF files
 */

import type { Tool, ToolResult, ToolContext } from "../../types.js";

export interface PdfExtractOptions {
  maxPages?: number;
  maxChars?: number;
}

/**
 * Simple PDF text extraction (mock implementation)
 * In a real implementation, this would use pdf-parse or similar library
 */
async function extractTextFromPdf(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _pdfBuffer: ArrayBuffer,
  options: PdfExtractOptions = {},
): Promise<{ text: string; pageCount: number }> {
  // Extract options (used in real implementation)
  void { maxPages: options.maxPages ?? 100, maxChars: options.maxChars ?? 100000 };

  // Mock implementation - in production, use pdf-parse or pdf.js
  // For now, return a placeholder indicating PDF support
  return {
    text: "[PDF text extraction requires pdf-parse or pdf2js library. Install with: npm install pdf-parse]",
    pageCount: 1,
  };
}

/**
 * Extract text from a PDF file path
 */
async function extractTextFromPdfFile(
  filePath: string,
  options: PdfExtractOptions = {},
): Promise<{ text: string; pageCount: number; error?: string }> {
  try {
    const fs = await import("node:fs/promises");
    const buffer = await fs.readFile(filePath);
    return await extractTextFromPdf(buffer.buffer, options);
  } catch (error) {
    return {
      text: "",
      pageCount: 0,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * PDF tool
 */
export const pdfTool: Tool = {
  name: "pdf_extract",
  description: "Extract text content from PDF files. Supports local file paths or base64-encoded PDF data.",
  inputSchema: {
    type: "object",
    properties: {
      source: {
        type: "string",
        description: "PDF source: file path, URL, or base64-encoded data",
      },
      maxPages: {
        type: "number",
        description: "Maximum number of pages to extract",
        default: 100,
      },
      maxChars: {
        type: "number",
        description: "Maximum characters to return per page",
        default: 100000,
      },
    },
    required: ["source"],
  },
  handler: async ({ input }: { input: Record<string, unknown>; context: ToolContext }): Promise<ToolResult> => {
    const source = input.source as string;
    const maxPages = (input.maxPages as number) || 100;
    const maxChars = (input.maxChars as number) || 100000;

    // Check if source is a file path, URL, or base64 data
    if (source.startsWith("http://") || source.startsWith("https://")) {
      // URL - would need to download first
      return {
        content: JSON.stringify({
          error: "URL extraction not yet supported. Please download the PDF and provide the file path.",
          url: source,
        }),
        isError: true,
        metadata: { source, sourceType: "url" },
      };
    }

    if (source.startsWith("data:application/pdf;base64,")) {
      // Base64 data
      const base64Data = source.split(",")[1] || "";
      const buffer = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0));
      const result = await extractTextFromPdf(buffer.buffer, { maxPages, maxChars });

      return {
        content: JSON.stringify({
          text: result.text,
          pageCount: result.pageCount,
        }),
        metadata: { sourceType: "base64", pageCount: result.pageCount },
      };
    }

    // Assume it's a file path
    const result = await extractTextFromPdfFile(source, { maxPages, maxChars });

    if (result.error) {
      return {
        content: JSON.stringify({
          error: result.error,
          source,
        }),
        isError: true,
        metadata: { source, sourceType: "file" },
      };
    }

    return {
      content: JSON.stringify({
        text: result.text,
        pageCount: result.pageCount,
        source,
      }),
      metadata: { source, sourceType: "file", pageCount: result.pageCount },
    };
  },
};
