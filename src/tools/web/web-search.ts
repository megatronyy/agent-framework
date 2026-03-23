/**
 * Web Search Tool
 *
 * Tool for searching the web using various search providers.
 */

import type { Tool } from "../../types.js";

/**
 * Web search result interface
 */
interface WebSearchResult {
  query: string;
  results: Array<{
    title: string;
    url: string;
    snippet: string;
  }>;
  provider: string;
  error?: string;
}

/**
 * Web search options
 */
interface WebSearchOptions {
  provider?: "brave" | "google" | "bing";
  count?: number;
  offset?: number;
}

/**
 * Search the web using the configured provider
 */
async function searchWeb(
  query: string,
  options: WebSearchOptions = {}
): Promise<WebSearchResult> {
  const provider = options.provider || "brave";
  const apiKey = process.env.WEB_SEARCH_API_KEY || process.env.BRAVE_API_KEY;

  if (!apiKey) {
    // Return mock results when no API key is available
    return {
      query,
      results: [
        {
          title: "Mock Search Result 1",
          url: "https://example.com/1",
          snippet: `This is a mock result for "${query}". Configure WEB_SEARCH_API_KEY to get real results.`,
        },
        {
          title: "Mock Search Result 2",
          url: "https://example.com/2",
          snippet: "Configure WEB_SEARCH_API_KEY or BRAVE_API_KEY environment variable for real web search.",
        },
      ],
      provider: "mock",
    };
  }

  try {
    // Brave Search API
    if (provider === "brave") {
      const response = await fetch(
        `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=${options.count || 10}&offset=${options.offset || 0}`,
        {
          headers: {
            "Accept": "application/json",
            "Accept-Encoding": "gzip",
            "X-Subscription-Token": apiKey,
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Brave Search API error: ${response.status}`);
      }

      const data = (await response.json()) as { web?: { results?: unknown[] } };

      return {
        query,
        results: (data.web?.results || []).map((r: unknown) => {
          const result = r as { title?: string; url?: string; description?: string };
          return {
            title: result.title || "",
            url: result.url || "",
            snippet: result.description || "",
          };
        }),
        provider: "brave",
      };
    }

    // Google Custom Search API
    if (provider === "google") {
      const response = await fetch(
        `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${process.env.GOOGLE_SEARCH_ENGINE_ID || ""}&q=${encodeURIComponent(query)}&num=${options.count || 10}`
      );

      if (!response.ok) {
        throw new Error(`Google Search API error: ${response.status}`);
      }

      const data = (await response.json()) as { items?: unknown[] };

      return {
        query,
        results: (data.items || []).map((item: unknown) => {
          const i = item as { title?: string; link?: string; snippet?: string };
          return {
            title: i.title || "",
            url: i.link || "",
            snippet: i.snippet || "",
          };
        }),
        provider: "google",
      };
    }

    // Bing Search API
    if (provider === "bing") {
      const response = await fetch(
        `https://api.bing.microsoft.com/v7.0/search?q=${encodeURIComponent(query)}&count=${options.count || 10}&offset=${options.offset || 0}`,
        {
          headers: {
            "Ocp-Apim-Subscription-Key": apiKey,
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Bing Search API error: ${response.status}`);
      }

      const data = (await response.json()) as { webPages?: { value?: unknown[] } };

      return {
        query,
        results: (data.webPages?.value || []).map((item: unknown) => {
          const i = item as { name?: string; url?: string; snippet?: string };
          return {
            title: i.name || "",
            url: i.url || "",
            snippet: i.snippet || "",
          };
        }),
        provider: "bing",
      };
    }

    throw new Error(`Unsupported search provider: ${provider}`);
  } catch (error) {
    return {
      query,
      results: [],
      provider,
      error: (error as Error).message,
    };
  }
}

/**
 * Web search tool
 */
export const webSearchTool: Tool = {
  name: "web_search",
  description: "Search the web for information using various search providers",
  inputSchema: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "Search query",
      },
      provider: {
        type: "string",
        enum: ["brave", "google", "bing"],
        description: "Search provider to use (default: brave)",
      },
      count: {
        type: "number",
        description: "Number of results to return (default: 10)",
      },
    },
    required: ["query"],
  },
  handler: async ({ input }) => {
    const query = input.query as string;
    const provider = (input.provider as WebSearchOptions["provider"]) || "brave";
    const count = input.count as number | undefined;

    if (!query) {
      return {
        isError: true,
        content: JSON.stringify({
          success: false,
          error: "Query is required",
        }),
      };
    }

    const result = await searchWeb(query, { provider, count });

    return {
      content: JSON.stringify({
        success: true,
        query: result.query,
        provider: result.provider,
        count: result.results.length,
        results: result.results,
      }),
    };
  },
};
