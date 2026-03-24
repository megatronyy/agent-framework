/**
 * RAG Tool Factory
 *
 * Creates tools for retrieving context from vector stores.
 */

import type { Tool } from "../types.js";
import type { InMemoryVectorStore } from "./vector-store.js";
import type { Message } from "./token-counter.js";

/**
 * RAG tool options
 */
export interface RAGToolOptions {
  maxResults?: number;
  threshold?: number;
  maxContextLength?: number;
  formatResults?: "summary" | "detailed" | "ids";
}

/**
 * Create a RAG (Retrieval-Augmented Generation) tool
 */
export function createRAGTool(
  vectorStore: InMemoryVectorStore,
  options?: RAGToolOptions
): Tool {
  const opts = {
    maxResults: options?.maxResults ?? 5,
    threshold: options?.threshold ?? 0.1,
    maxContextLength: options?.maxContextLength ?? 2000,
    formatResults: options?.formatResults ?? "summary",
  };

  return {
    name: "search_context",
    description: "Search for relevant context from the knowledge base",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Search query",
        },
        limit: {
          type: "number",
          description: "Maximum number of results",
          default: opts.maxResults,
        },
        threshold: {
          type: "number",
          description: "Minimum similarity score (0-1)",
          default: opts.threshold,
        },
      },
      required: ["query"],
    },
    handler: async ({ input, context }) => {
      try {
        const results = await vectorStore.search(input.query as string, {
          limit: input.limit as number ?? opts.maxResults,
          threshold: input.threshold as number ?? opts.threshold,
        });

        if (results.length === 0) {
          return {
            content: JSON.stringify({
              success: true,
              query: input.query,
              results: [],
              message: "No relevant context found",
            }),
          };
        }

        // Format results based on format option
        const formatted = formatSearchResults(results, opts.formatResults);

        return {
          content: JSON.stringify({
            success: true,
            query: input.query,
            results: results.map((r) => ({
              id: r.document.id,
              score: r.score,
              content: r.document.content.slice(0, 200) + "...",
            })),
            context: formatted,
          }),
        };
      } catch (error) {
        return {
          isError: true,
          content: JSON.stringify({
            success: false,
            error: error instanceof Error ? error.message : String(error),
          }),
        };
      }
    },
  };
}

/**
 * Create a RAG tool that adds context to messages
 */
export function createRAGContextTool(
  vectorStore: InMemoryVectorStore,
  options?: RAGToolOptions
): Tool {
  const baseTool = createRAGTool(vectorStore, options);

  return {
    ...baseTool,
    name: "retrieve_context",
    description: "Retrieve relevant context from knowledge base and add to conversation",
    handler: async (args) => {
      const result = await baseTool.handler(args);

      // Enhance result with context injection instructions
      if (!result.isError) {
        const parsed = JSON.parse(result.content as string);
        parsed.instruction = "Use the retrieved context to inform your response";
        result.content = JSON.stringify(parsed);
      }

      return result;
    },
  };
}

/**
 * Create a RAG tool for document lookup
 */
export function createDocumentLookupTool(
  vectorStore: InMemoryVectorStore,
  options?: RAGToolOptions
): Tool {
  return {
    name: "lookup_document",
    description: "Look up specific documents from the knowledge base",
    inputSchema: {
      type: "object",
      properties: {
        documentId: {
          type: "string",
          description: "ID of the document to look up",
        },
      },
      required: ["documentId"],
    },
    handler: async ({ input }) => {
      try {
        const doc = vectorStore.get(input.documentId as string);

        if (!doc) {
          return {
            content: JSON.stringify({
              success: false,
              error: `Document not found: ${input.documentId}`,
            }),
          };
        }

        return {
          content: JSON.stringify({
            success: true,
            document: {
              id: doc.id,
              content: doc.content,
              metadata: doc.metadata,
            },
          }),
        };
      } catch (error) {
        return {
          isError: true,
          content: JSON.stringify({
            success: false,
            error: error instanceof Error ? error.message : String(error),
          }),
        };
      }
    },
  };
}

/**
 * Format search results based on format option
 */
function formatSearchResults(
  results: Array<{ document: { content: string; id: string }; score: number }>,
  format: "summary" | "detailed" | "ids"
): string {
  switch (format) {
    case "summary":
      return results
        .map(
          (r) =>
            `[${r.document.id}] (relevance: ${r.score.toFixed(2)}) ${r.document.content.slice(0, 150)}...`
        )
        .join("\n");

    case "detailed":
      return results
        .map(
          (r) =>
            `Document: ${r.document.id}\nScore: ${r.score.toFixed(4)}\nContent:\n${r.document.content}\n`
        )
        .join("\n---\n");

    case "ids":
      return results.map((r) => r.document.id).join(", ");

    default:
      return results.map((r) => r.document.content).join("\n");
  }
}
