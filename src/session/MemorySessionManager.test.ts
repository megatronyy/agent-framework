/**
 * MemorySessionManager unit tests
 */

import { describe, it, expect, beforeEach } from "vitest";
import { MemorySessionManager } from "./MemorySessionManager.js";
import type { Session, Message } from "../types.js";

describe("MemorySessionManager", () => {
  let manager: MemorySessionManager;

  beforeEach(() => {
    manager = new MemorySessionManager();
  });

  describe("create", () => {
    it("should create a new session with unique ID", () => {
      const session1 = manager.create({ agentId: "agent-1" });
      const session2 = manager.create({ agentId: "agent-1" });

      expect(session1.id).toBeDefined();
      expect(session2.id).toBeDefined();
      expect(session1.id).not.toBe(session2.id);
    });

    it("should set agentId from params", () => {
      const session = manager.create({ agentId: "agent-1" });
      expect(session.agentId).toBe("agent-1");
    });

    it("should initialize with empty messages", () => {
      const session = manager.create({ agentId: "agent-1" });
      expect(session.messages).toEqual([]);
    });

    it("should set timestamps", () => {
      const now = Date.now();
      const session = manager.create({ agentId: "agent-1" });

      expect(session.createdAt).toBeGreaterThanOrEqual(now);
      expect(session.updatedAt).toBeGreaterThanOrEqual(now);
    });

    it("should store metadata", () => {
      const metadata = { userId: "user-1", tags: ["test"] };
      const session = manager.create({ agentId: "agent-1", metadata });

      expect(session.metadata).toEqual(metadata);
    });
  });

  describe("get", () => {
    it("should retrieve an existing session", () => {
      const created = manager.create({ agentId: "agent-1" });
      const retrieved = manager.get(created.id);

      expect(retrieved).toEqual(created);
    });

    it("should return undefined for non-existent session", () => {
      const retrieved = manager.get("non-existent");
      expect(retrieved).toBeUndefined();
    });
  });

  describe("update", () => {
    it("should update an existing session", () => {
      const session = manager.create({ agentId: "agent-1" });
      const updated = manager.update(session.id, { metadata: { foo: "bar" } });

      expect(updated?.metadata).toEqual({ foo: "bar" });
      expect(updated?.id).toBe(session.id);
      expect(updated?.createdAt).toBe(session.createdAt);
    });

    it("should update updatedAt timestamp", async () => {
      const session = manager.create({ agentId: "agent-1" });
      const originalUpdatedAt = session.updatedAt;

      // Wait a bit to ensure timestamp difference
      await new Promise((resolve) => setTimeout(resolve, 10));

      const updated = manager.update(session.id, {});
      expect(updated?.updatedAt).toBeGreaterThan(originalUpdatedAt);
    });

    it("should return undefined for non-existent session", () => {
      const updated = manager.update("non-existent", { metadata: {} });
      expect(updated).toBeUndefined();
    });
  });

  describe("delete", () => {
    it("should delete an existing session", () => {
      const session = manager.create({ agentId: "agent-1" });
      const deleted = manager.delete(session.id);

      expect(deleted).toBe(true);
      expect(manager.get(session.id)).toBeUndefined();
    });

    it("should return false for non-existent session", () => {
      const deleted = manager.delete("non-existent");
      expect(deleted).toBe(false);
    });
  });

  describe("list", () => {
    beforeEach(() => {
      manager.create({ agentId: "agent-1" });
      manager.create({ agentId: "agent-1" });
      manager.create({ agentId: "agent-2" });
    });

    it("should list all sessions when no agentId specified", () => {
      const sessions = manager.list();
      expect(sessions).toHaveLength(3);
    });

    it("should filter by agentId when specified", () => {
      const agent1Sessions = manager.list("agent-1");
      const agent2Sessions = manager.list("agent-2");

      expect(agent1Sessions).toHaveLength(2);
      expect(agent2Sessions).toHaveLength(1);
      expect(agent1Sessions.every((s) => s.agentId === "agent-1")).toBe(true);
      expect(agent2Sessions.every((s) => s.agentId === "agent-2")).toBe(true);
    });
  });

  describe("addMessage", () => {
    it("should add a message to the session", () => {
      const session = manager.create({ agentId: "agent-1" });
      const message: Message = {
        role: "user",
        content: "Hello, world!",
      };

      manager.addMessage(session.id, message);
      const updated = manager.get(session.id);

      expect(updated?.messages).toHaveLength(1);
      expect(updated?.messages[0]).toEqual(message);
    });

    it("should update the timestamp when adding a message", async () => {
      const session = manager.create({ agentId: "agent-1" });
      const originalUpdatedAt = session.updatedAt;

      await new Promise((resolve) => setTimeout(resolve, 10));

      manager.addMessage(session.id, { role: "user", content: "test" });
      const updated = manager.get(session.id);

      expect(updated?.updatedAt).toBeGreaterThan(originalUpdatedAt);
    });

    it("should throw for non-existent session", () => {
      expect(() => {
        manager.addMessage("non-existent", { role: "user", content: "test" });
      }).toThrow("Session not found");
    });
  });

  describe("clear", () => {
    it("should remove all sessions", () => {
      manager.create({ agentId: "agent-1" });
      manager.create({ agentId: "agent-2" });

      expect(manager.size()).toBe(2);

      manager.clear();
      expect(manager.size()).toBe(0);
    });
  });

  describe("size", () => {
    it("should return the number of sessions", () => {
      expect(manager.size()).toBe(0);

      manager.create({ agentId: "agent-1" });
      expect(manager.size()).toBe(1);

      manager.create({ agentId: "agent-2" });
      expect(manager.size()).toBe(2);

      manager.delete(manager.list()[0].id);
      expect(manager.size()).toBe(1);
    });
  });
});
