/**
 * In-Memory Vector Store
 *
 * Simple vector storage for semantic search and RAG.
 */

/**
 * Vector document
 */
export interface VectorDocument {
  id: string;
  content: string;
  embedding?: number[];
  metadata?: Record<string, unknown>;
}

/**
 * Search result with similarity score
 */
export interface SearchResult {
  document: VectorDocument;
  score: number;
}

/**
 * Embedding function
 */
export type EmbeddingFunction = (text: string) => Promise<number[]>;

/**
 * Simple string-based similarity function
 */
export type SimilarityFunction = (a: string, b: string) => number;

/**
 * Vector store options
 */
export interface VectorStoreOptions {
  maxDocuments?: number;
  embeddingFn?: EmbeddingFunction;
  similarityFn?: SimilarityFunction;
}

/**
 * Default options
 */
const defaultOptions: Required<VectorStoreOptions> = {
  maxDocuments: 1000,
  embeddingFn: async (text: string) => {
    // Simple character-based embedding (fallback)
    // In production, use a real embedding model
    const tokens = text.toLowerCase().split(/\s+/);
    const vector = new Array(128).fill(0);

    for (let i = 0; i < tokens.length; i++) {
      const hash = simpleHash(tokens[i]);
      const idx = hash % 128;
      vector[idx] = (vector[idx] || 0) + 1;
    }

    // Normalize
    const magnitude = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
    return vector.map((v) => (magnitude > 0 ? v / magnitude : 0));
  },
  similarityFn: (a: string, b: string) => {
    // Jaccard similarity for word overlap
    const wordsA = new Set(a.toLowerCase().split(/\s+/));
    const wordsB = new Set(b.toLowerCase().split(/\s+/));
    const intersection = new Set([...wordsA].filter((x) => wordsB.has(x)));
    const union = new Set([...wordsA, ...wordsB]);
    return union.size > 0 ? intersection.size / union.size : 0;
  },
};

/**
 * Simple string hash for embedding
 */
function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

/**
 * Cosine similarity for embeddings
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error("Embedding dimensions must match");
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
  return magnitude > 0 ? dotProduct / magnitude : 0;
}

/**
 * In-memory vector store
 */
export class InMemoryVectorStore {
  private documents: Map<string, VectorDocument> = new Map();
  private options: Required<VectorStoreOptions>;

  constructor(options?: VectorStoreOptions) {
    this.options = { ...defaultOptions, ...options };
  }

  /**
   * Add a document to the store
   */
  async add(document: VectorDocument): Promise<void> {
    // Check max documents limit
    if (this.documents.size >= this.options.maxDocuments) {
      // Remove oldest document (simple FIFO)
      const firstKey = this.documents.keys().next().value;
      if (firstKey) {
        this.documents.delete(firstKey);
      }
    }

    // Generate embedding if not provided
    if (!document.embedding) {
      document.embedding = await this.options.embeddingFn(document.content);
    }

    this.documents.set(document.id, { ...document });
  }

  /**
   * Add multiple documents
   */
  async addMany(documents: VectorDocument[]): Promise<void> {
    for (const doc of documents) {
      await this.add(doc);
    }
  }

  /**
   * Get a document by ID
   */
  get(id: string): VectorDocument | undefined {
    return this.documents.get(id);
  }

  /**
   * Remove a document
   */
  delete(id: string): boolean {
    return this.documents.delete(id);
  }

  /**
   * Update a document
   */
  async update(id: string, updates: Partial<VectorDocument>): Promise<boolean> {
    const existing = this.documents.get(id);
    if (!existing) {
      return false;
    }

    const updated: VectorDocument = {
      ...existing,
      ...updates,
      id, // Preserve ID
    };

    // Regenerate embedding if content changed
    if (updates.content && updates.content !== existing.content) {
      updated.embedding = await this.options.embeddingFn(updates.content);
    }

    this.documents.set(id, updated);
    return true;
  }

  /**
   * Clear all documents
   */
  clear(): void {
    this.documents.clear();
  }

  /**
   * Get document count
   */
  get size(): number {
    return this.documents.size;
  }

  /**
   * Search for similar documents
   */
  async search(
    query: string,
    options?: {
      limit?: number;
      threshold?: number;
    }
  ): Promise<SearchResult[]> {
    const limit = options?.limit ?? 10;
    const threshold = options?.threshold ?? 0;
    const results: SearchResult[] = [];

    // Generate query embedding
    const queryEmbedding = await this.options.embeddingFn(query);

    for (const doc of this.documents.values()) {
      let score = 0;

      if (doc.embedding && queryEmbedding) {
        // Use cosine similarity on embeddings
        score = cosineSimilarity(queryEmbedding, doc.embedding);
      } else {
        // Fall back to string similarity
        score = this.options.similarityFn(query, doc.content);
      }

      if (score >= threshold) {
        results.push({ document: doc, score });
      }
    }

    // Sort by score descending and limit
    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  /**
   * Find documents by metadata
   */
  findByMetadata(
    predicate: (metadata: Record<string, unknown>) => boolean
  ): VectorDocument[] {
    const results: VectorDocument[] = [];

    for (const doc of this.documents.values()) {
      if (doc.metadata && predicate(doc.metadata)) {
        results.push(doc);
      }
    }

    return results;
  }

  /**
   * List all document IDs
   */
  list(): string[] {
    return Array.from(this.documents.keys());
  }
}
