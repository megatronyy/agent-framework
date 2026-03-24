/**
 * Context Engine Module
 *
 * Provides context management, token counting, summarization, and RAG capabilities.
 */

// Core Context Engine (existing implementation)
export {
  ContextEngine,
  SimpleTokenCounter,
} from "./ContextEngine.js";

// Additional/new components
export { SimpleTokenCounter as NewSimpleTokenCounter } from "./token-counter.js";
export type { Message, TokenCount } from "./token-counter.js";

export { SimpleContextSummarizer } from "./summarizer.js";
export type { SummarySection, SummaryResult, SummarizerOptions } from "./summarizer.js";

export { InMemoryVectorStore, cosineSimilarity } from "./vector-store.js";
export type { VectorDocument, SearchResult, EmbeddingFunction } from "./vector-store.js";

export { createRAGTool, createRAGContextTool, createDocumentLookupTool } from "./rag-tool.js";
export type { RAGToolOptions } from "./rag-tool.js";

export { ContextEngine as NewContextEngine } from "./engine.js";
export type { ContextEngineOptions, ContextState, ContextEngineResult } from "./engine.js";

// Legacy exports from VectorStore
export { createRAGTool as legacyCreateRAGTool } from "./VectorStore.js";
