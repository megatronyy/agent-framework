/**
 * In-Memory Vector Store for RAG
 *
 * Simple embedding-based retrieval using TF-IDF and cosine similarity.
 * For production use, consider using a proper vector database like Pinecone, Weaviate, or pgvector.
 */

import type { ContextChunk, VectorStore as IVectorStore } from "../types.js";

/**
 * Document with embedding
 */
interface Document {
  id: string;
  content: string;
  embedding: number[];
  metadata?: Record<string, unknown>;
}

/**
 * TF-IDF vectorizer
 */
class TFIDFVectorizer {
  private vocabulary: Map<string, number> = new Map();
  private idf: Map<number, number> = new Map();
  private docCount = 0;

  /**
   * Tokenize text
   */
  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2);
  }

  /**
   * Fit on documents
   */
  fit(documents: string[]): void {
    this.docCount = documents.length;
    const docFrequency: Map<number, number> = new Map();

    // Build vocabulary
    for (const doc of documents) {
      const tokens = new Set(this.tokenize(doc));
      for (const _token of tokens) {
        if (!this.vocabulary.has(_token)) {
          this.vocabulary.set(_token, this.vocabulary.size);
        }
        const idx = this.vocabulary.get(_token)!;
        docFrequency.set(idx, (docFrequency.get(idx) || 0) + 1);
      }
    }

    // Calculate IDF
    for (const [, idx] of this.vocabulary) {
      const df = docFrequency.get(idx) || 0;
      this.idf.set(idx, Math.log(this.docCount / (1 + df)));
    }
  }

  /**
   * Transform text to TF-IDF vector
   */
  transform(text: string): number[] {
    const tokens = this.tokenize(text);
    const termFreq: Map<number, number> = new Map();

    // Count term frequency
    for (const token of tokens) {
      const idx = this.vocabulary.get(token);
      if (idx !== undefined) {
        termFreq.set(idx, (termFreq.get(idx) || 0) + 1);
      }
    }

    // Normalize TF
    const maxTf = Math.max(...termFreq.values(), 1);

    // Create vector
    const vector = new Array(this.vocabulary.size).fill(0);
    for (const [idx, tf] of termFreq) {
      vector[idx] = (tf / maxTf) * (this.idf.get(idx) || 0);
    }

    return vector;
  }

  /**
   * Get vocabulary size
   */
  get size(): number {
    return this.vocabulary.size;
  }
}

/**
 * Cosine similarity calculator
 */
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error("Vector dimensions must match");
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  normA = Math.sqrt(normA);
  normB = Math.sqrt(normB);

  if (normA === 0 || normB === 0) {
    return 0;
  }

  return dotProduct / (normA * normB);
}

/**
 * In-memory vector store implementation
 */
export class InMemoryVectorStore implements IVectorStore {
  private documents: Map<string, Document> = new Map();
  private vectorizer?: TFIDFVectorizer;
  private fitted = false;

  /**
   * Add documents to the store
   */
  async add(documents: Array<{ id: string; content: string; metadata?: Record<string, unknown> }>): Promise<void> {
    // Add new documents first (without embeddings for now)
    for (const doc of documents) {
      this.documents.set(doc.id, {
        id: doc.id,
        content: doc.content,
        embedding: [], // Will be regenerated below
        metadata: doc.metadata,
      });
    }

    // Refit vectorizer with ALL documents
    const allDocs = Array.from(this.documents.values());
    const contents = allDocs.map((d) => d.content);

    this.vectorizer = new TFIDFVectorizer();
    this.vectorizer.fit(contents);
    this.fitted = true;

    // Regenerate embeddings for ALL documents
    for (const doc of allDocs) {
      doc.embedding = this.vectorizer!.transform(doc.content);
    }
  }

  /**
   * Search for similar documents
   */
  async search(query: string, topK = 5): Promise<ContextChunk[]> {
    if (!this.fitted || !this.vectorizer) {
      // Fit on existing documents if not fitted
      const docs = Array.from(this.documents.values());
      if (docs.length === 0) {
        return [];
      }
      const contents = docs.map((d) => d.content);
      this.vectorizer = new TFIDFVectorizer();
      this.vectorizer.fit(contents);
      this.fitted = true;
    }

    const queryEmbedding = this.vectorizer.transform(query);

    // Calculate similarities
    const results = Array.from(this.documents.values())
      .map((doc) => ({
        content: doc.content,
        metadata: {
          source: doc.metadata?.source as string || doc.id,
          score: cosineSimilarity(queryEmbedding, doc.embedding),
          timestamp: doc.metadata?.timestamp as number | undefined,
          ...doc.metadata,
        },
      }))
      .filter((r) => r.metadata.score >= 0) // Include non-negative scores
      .sort((a, b) => b.metadata.score - a.metadata.score)
      .slice(0, topK);

    return results;
  }

  /**
   * Delete a document by ID
   */
  async delete(id: string): Promise<void> {
    this.documents.delete(id);

    // Refit vectorizer if documents exist
    if (this.documents.size > 0) {
      const docs = Array.from(this.documents.values());
      const contents = docs.map((d) => d.content);

      this.vectorizer = new TFIDFVectorizer();
      this.vectorizer.fit(contents);
    } else {
      this.vectorizer = undefined;
      this.fitted = false;
    }
  }

  /**
   * Clear all documents
   */
  async clear(): Promise<void> {
    this.documents.clear();
    this.vectorizer = undefined;
    this.fitted = false;
  }

  /**
   * Get document count
   */
  get count(): number {
    return this.documents.size;
  }
}

/**
 * Create a RAG tool for context retrieval
 */
export function createRAGTool(vectorStore: IVectorStore) {
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
        topK: {
          type: "number",
          description: "Number of results to return (default: 3)",
          default: 3,
        },
      },
      required: ["query"],
    },
    handler: async ({ input }: { input: Record<string, unknown> }) => {
      const query = input.query as string;
      const topK = (input.topK as number) || 3;

      if (!query) {
        return {
          isError: true,
          content: JSON.stringify({ error: "Query is required" }),
        };
      }

      const results = await vectorStore.search(query, topK);

      return {
        content: JSON.stringify({
          query,
          results: results.map((r) => ({
            content: r.content,
            score: r.metadata.score,
            source: r.metadata.source,
          })),
          count: results.length,
        }, null, 2),
      };
    },
  };
}
