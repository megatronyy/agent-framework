/**
 * Vector Store Tests
 */

import { describe, it, expect, beforeEach } from "vitest";
import { InMemoryVectorStore, cosineSimilarity } from "./vector-store.js";

describe("InMemoryVectorStore", () => {
  let store: InMemoryVectorStore;

  beforeEach(() => {
    store = new InMemoryVectorStore({ maxDocuments: 5 });
  });

  describe("add and get", () => {
    it("should add a document", async () => {
      const doc = {
        id: "doc1",
        content: "Python is a programming language",
      };

      await store.add(doc);

      expect(store.size).toBe(1);
    });

    it("should retrieve a document by ID", async () => {
      const doc = {
        id: "doc1",
        content: "Python is a programming language",
      };

      await store.add(doc);
      const retrieved = store.get("doc1");

      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe("doc1");
      expect(retrieved?.content).toBe("Python is a programming language");
    });

    it("should return undefined for non-existent document", () => {
      const result = store.get("non-existent");
      expect(result).toBeUndefined();
    });

    it("should add multiple documents", async () => {
      await store.addMany([
        { id: "doc1", content: "First document" },
        { id: "doc2", content: "Second document" },
        { id: "doc3", content: "Third document" },
      ]);

      expect(store.size).toBe(3);
    });

    it("should enforce max documents limit", async () => {
      for (let i = 1; i <= 6; i++) {
        await store.add({
          id: `doc${i}`,
          content: `Document ${i}`,
        });
      }

      // Should only keep 5 (maxDocuments)
      expect(store.size).toBe(5);
    });
  });

  describe("delete and update", () => {
    it("should delete a document", async () => {
      await store.add({ id: "doc1", content: "Test" });

      const deleted = store.delete("doc1");

      expect(deleted).toBe(true);
      expect(store.size).toBe(0);
    });

    it("should return false when deleting non-existent", () => {
      const deleted = store.delete("non-existent");
      expect(deleted).toBe(false);
    });

    it("should update a document", async () => {
      await store.add({ id: "doc1", content: "Original content" });

      const updated = await store.update("doc1", {
        content: "Updated content",
      });

      expect(updated).toBe(true);
      expect(store.get("doc1")?.content).toBe("Updated content");
    });

    it("should return false when updating non-existent", async () => {
      const updated = await store.update("non-existent", {
        content: "New content",
      });

      expect(updated).toBe(false);
    });
  });

  describe("search", () => {
    beforeEach(async () => {
      await store.addMany([
        { id: "python", content: "Python is a high-level programming language" },
        { id: "javascript", content: "JavaScript is used for web development" },
        { id: "rust", content: "Rust is a systems programming language" },
        { id: "java", content: "Java is widely used in enterprise" },
      ]);
    });

    it("should search for similar documents", async () => {
      const results = await store.search("programming language", {
        limit: 3,
        threshold: 0,
      });

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].score).toBeGreaterThanOrEqual(0);
    });

    it("should respect search limit", async () => {
      const results = await store.search("language", { limit: 2 });

      expect(results.length).toBeLessThanOrEqual(2);
    });

    it("should respect threshold", async () => {
      const results = await store.search("xyz", { threshold: 0.9 });

      expect(results.length).toBe(0);
    });

    it("should return results sorted by score", async () => {
      const results = await store.search("programming language", {
        threshold: 0,
      });

      for (let i = 0; i < results.length - 1; i++) {
        expect(results[i].score).toBeGreaterThanOrEqual(results[i + 1].score);
      }
    });
  });

  describe("findByMetadata", () => {
    it("should find documents by metadata predicate", async () => {
      await store.add({
        id: "doc1",
        content: "Content 1",
        metadata: { category: "tech", tags: ["python"] },
      });

      await store.add({
        id: "doc2",
        content: "Content 2",
        metadata: { category: "food", tags: ["pizza"] },
      });

      const techDocs = store.findByMetadata((m) => m.category === "tech");

      expect(techDocs).toHaveLength(1);
      expect(techDocs[0].id).toBe("doc1");
    });

    it("should return empty array when no matches", async () => {
      await store.add({
        id: "doc1",
        content: "Content",
        metadata: { category: "tech" },
      });

      const results = store.findByMetadata((m) => m.category === "nonexistent");

      expect(results).toHaveLength(0);
    });
  });

  describe("list and clear", () => {
    it("should list all document IDs", async () => {
      await store.addMany([
        { id: "doc1", content: "Content 1" },
        { id: "doc2", content: "Content 2" },
        { id: "doc3", content: "Content 3" },
      ]);

      const ids = store.list();

      expect(ids).toHaveLength(3);
      expect(ids).toContain("doc1");
      expect(ids).toContain("doc2");
      expect(ids).toContain("doc3");
    });

    it("should clear all documents", async () => {
      await store.addMany([
        { id: "doc1", content: "Content 1" },
        { id: "doc2", content: "Content 2" },
      ]);

      expect(store.size).toBe(2);

      store.clear();

      expect(store.size).toBe(0);
    });
  });
});

describe("cosineSimilarity", () => {
  it("should calculate cosine similarity", () => {
    const vec1 = [1, 2, 3];
    const vec2 = [1, 2, 3];

    const similarity = cosineSimilarity(vec1, vec2);

    expect(similarity).toBe(1);
  });

  it("should return 0 for orthogonal vectors", () => {
    const vec1 = [1, 0, 0];
    const vec2 = [0, 1, 0];

    const similarity = cosineSimilarity(vec1, vec2);

    expect(similarity).toBe(0);
  });

  it("should handle different dimensions", () => {
    const vec1 = [1, 2, 3];
    const vec2 = [1, 2];

    expect(() => cosineSimilarity(vec1, vec2)).toThrow();
  });
});
