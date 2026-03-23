/**
 * In-memory session manager implementation
 */

import type { Session, SessionManager, Message } from "../types.js";

export class MemorySessionManager implements SessionManager {
  private sessions: Record<string, Session>;

  constructor() {
    this.sessions = Object.create(null) as Record<string, Session>;
  }

  create(params: { agentId: string; metadata?: Record<string, unknown> }): Session {
    const session: Session = {
      id: this.generateId(),
      agentId: params.agentId,
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      metadata: params.metadata,
    };

    this.sessions[session.id] = session;
    return session;
  }

  get(id: string): Session | undefined {
    return this.sessions[id];
  }

  update(id: string, updates: Partial<Session>): Session | undefined {
    const session = this.sessions[id];
    if (!session) return undefined;

    const updated: Session = {
      ...session,
      ...updates,
      id: session.id,
      createdAt: session.createdAt,
      updatedAt: Date.now(),
    };

    this.sessions[id] = updated;
    return updated;
  }

  delete(id: string): boolean {
    const had = id in this.sessions;
    delete this.sessions[id];
    return had;
  }

  list(agentId?: string): Session[] {
    const allSessions = Object.values(this.sessions);

    if (agentId) {
      return allSessions.filter((s) => s.agentId === agentId);
    }

    return allSessions;
  }

  addMessage(sessionId: string, message: Message): void {
    const session = this.sessions[sessionId];
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    session.messages.push(message);
    session.updatedAt = Date.now();
  }

  clear(): void {
    this.sessions = Object.create(null) as Record<string, Session>;
  }

  size(): number {
    return Object.keys(this.sessions).length;
  }

  private generateId(): string {
    return `session-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }
}
