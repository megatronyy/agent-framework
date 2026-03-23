/**
 * Web fetch tool - Fetch and extract content from web pages
 */

import type { Tool, ToolResult, ToolContext } from "../../types.js";

/**
 * Simplified markdown extraction from HTML
 */
function htmlToMarkdown(html: string, maxChars: number = 50000): string {
  let markdown = html;

  // Remove script and style tags
  markdown = markdown
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "");

  // Convert headers
  markdown = markdown.replace(/<h1[^>]*>([^<]*)<\/h1>/gi, "# $1\n\n");
  markdown = markdown.replace(/<h2[^>]*>([^<]*)<\/h2>/gi, "## $1\n\n");
  markdown = markdown.replace(/<h3[^>]*>([^<]*)<\/h3>/gi, "### $1\n\n");
  markdown = markdown.replace(/<h4[^>]*>([^<]*)<\/h4>/gi, "#### $1\n\n");

  // Convert bold and italic
  markdown = markdown.replace(/<strong[^>]*>([^<]*)<\/strong>/gi, "**$1**");
  markdown = markdown.replace(/<b[^>]*>([^<]*)<\/b>/gi, "**$1**");
  markdown = markdown.replace(/<em[^>]*>([^<]*)<\/em>/gi, "*$1*");
  markdown = markdown.replace(/<i[^>]*>([^<]*)<\/i>/gi, "*$1*");

  // Convert code blocks
  markdown = markdown.replace(/<pre[^>]*><code[^>]*>([^<]*)<\/code><\/pre>/gi, "```\n$1\n```");
  markdown = markdown.replace(/<code[^>]*>([^<]*)<\/code>/gi, "`$1`");

  // Convert links
  markdown = markdown.replace(/<a[^>]*href="([^"]*)"[^>]*>([^<]*)<\/a>/gi, "[$2]($1)");

  // Convert lists
  markdown = markdown.replace(/<li[^>]*>/gi, "- ");
  markdown = markdown.replace(/<\/li>/gi, "\n");

  // Convert paragraphs
  markdown = markdown.replace(/<p[^>]*>/gi, "");
  markdown = markdown.replace(/<\/p>/gi, "\n\n");

  // Convert line breaks
  markdown = markdown.replace(/<br\s*\/?>/gi, "\n");

  // Remove remaining tags
  markdown = markdown.replace(/<[^>]+>/g, "");

  // Clean up whitespace
  markdown = markdown
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]+/g, " ")
    .trim();

  // Truncate if needed
  if (markdown.length > maxChars) {
    markdown = markdown.slice(0, maxChars) + "...";
  }

  return markdown;
}

/**
 * Web fetch tool
 */
export const webFetchTool: Tool = {
  name: "web_fetch",
  description: "Fetch and extract content from web pages. Returns the page content as markdown or plain text.",
  inputSchema: {
    type: "object",
    properties: {
      url: {
        type: "string",
        description: "The HTTP or HTTPS URL to fetch",
      },
      extractMode: {
        type: "string",
        enum: ["markdown", "text"],
        description: "Extraction mode (markdown or text)",
        default: "markdown",
      },
      maxChars: {
        type: "number",
        description: "Maximum characters to return (truncates when exceeded)",
        default: 50000,
      },
    },
    required: ["url"],
  },
  handler: async ({ input }: { input: Record<string, unknown>; context: ToolContext }): Promise<ToolResult> => {
    const url = input.url as string;
    const extractMode = (input.extractMode as string) || "markdown";
    const maxChars = (input.maxChars as number) || 50000;

    // Validate URL
    try {
      new URL(url);
    } catch {
      return {
        content: JSON.stringify({ error: "Invalid URL format" }),
        isError: true,
      };
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      const response = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; Agent-Framework/1.0)",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        return {
          content: JSON.stringify({
            error: `HTTP ${response.status}: ${response.statusText}`,
            url,
            statusCode: response.status,
          }),
          isError: true,
        };
      }

      const html = await response.text();

      // Extract title
      const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
      const title = titleMatch ? titleMatch[1].trim() : "";

      // Convert based on mode
      const content = extractMode === "markdown"
        ? htmlToMarkdown(html, maxChars)
        : html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, maxChars);

      return {
        content: JSON.stringify({
          url,
          title,
          content,
          extractMode,
          statusCode: response.status,
        }, null, 2),
        metadata: { url, title, statusCode: response.status, contentLength: content.length },
      };
    } catch (error) {
      return {
        content: JSON.stringify({
          error: error instanceof Error ? error.message : String(error),
          url,
        }),
        isError: true,
        metadata: { url },
      };
    }
  },
};
