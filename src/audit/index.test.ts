/**
 * Audit logging tests
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  InMemoryAuditLogger,
  FileAuditLogger,
  CompositeAuditLogger,
  createAuditEvent,
  logAudit,
  getAuditLogger,
  setAuditLogger,
  logToolCall,
  logToolSuccess,
  logToolError,
  logSecurityEvent,
  logFileAccess,
  logCodeExecution,
} from "./index.js";

describe("InMemoryAuditLogger", () => {
  let logger: InMemoryAuditLogger;

  beforeEach(() => {
    logger = new InMemoryAuditLogger();
  });

  it("should log events", () => {
    const event = createAuditEvent({
      type: "tool_call",
      agentId: "agent-1",
      sessionId: "session-1",
      action: "test_action",
      details: {},
      success: true,
    });

    logger.log(event);

    const events = logger.getEvents();
    expect(events).toHaveLength(1);
    expect(events[0]).toEqual(event);
  });

  it("should filter events by agent ID", () => {
    logger.log(
      createAuditEvent({
        type: "tool_call",
        agentId: "agent-1",
        sessionId: "session-1",
        action: "action1",
        details: {},
        success: true,
      })
    );

    logger.log(
      createAuditEvent({
        type: "tool_call",
        agentId: "agent-2",
        sessionId: "session-1",
        action: "action2",
        details: {},
        success: true,
      })
    );

    const agent1Events = logger.getEvents({ agentId: "agent-1" });
    expect(agent1Events).toHaveLength(1);
    expect(agent1Events[0].agentId).toBe("agent-1");
  });

  it("should filter events by type", () => {
    logger.log(
      createAuditEvent({
        type: "tool_call",
        agentId: "agent-1",
        sessionId: "session-1",
        action: "action1",
        details: {},
        success: true,
      })
    );

    logger.log(
      createAuditEvent({
        type: "security_event",
        agentId: "agent-1",
        sessionId: "session-1",
        action: "action2",
        details: {},
        success: false,
        severity: "warning",
      })
    );

    const securityEvents = logger.getEvents({ type: "security_event" });
    expect(securityEvents).toHaveLength(1);
  });

  it("should filter events by time range", () => {
    const now = Date.now();

    logger.log(
      createAuditEvent({
        type: "tool_call",
        agentId: "agent-1",
        sessionId: "session-1",
        action: "action1",
        details: {},
        success: true,
      })
    );

    const futureEvents = logger.getEvents({ since: now + 10000 });
    expect(futureEvents).toHaveLength(0);
  });

  it("should limit results", () => {
    for (let i = 0; i < 10; i++) {
      logger.log(
        createAuditEvent({
          type: "tool_call",
          agentId: "agent-1",
          sessionId: "session-1",
          action: `action${i}`,
          details: {},
          success: true,
        })
      );
    }

    const limited = logger.getEvents({ limit: 5 });
    expect(limited).toHaveLength(5);
  });

  it("should count events", () => {
    logger.log(
      createAuditEvent({
        type: "tool_call",
        agentId: "agent-1",
        sessionId: "session-1",
        action: "action1",
        details: {},
        success: true,
      })
    );

    logger.log(
      createAuditEvent({
        type: "tool_call",
        agentId: "agent-1",
        sessionId: "session-1",
        action: "action2",
        details: {},
        success: true,
      })
    );

    expect(logger.getCount()).toBe(2);
    expect(logger.getCount({ type: "tool_call" })).toBe(2);
  });

  it("should clear events", () => {
    logger.log(
      createAuditEvent({
        type: "tool_call",
        agentId: "agent-1",
        sessionId: "session-1",
        action: "action1",
        details: {},
        success: true,
      })
    );

    expect(logger.getCount()).toBe(1);

    logger.clear();

    expect(logger.getCount()).toBe(0);
  });
});

describe("createAuditEvent", () => {
  it("should create audit event with required fields", () => {
    const event = createAuditEvent({
      type: "tool_call",
      agentId: "agent-1",
      sessionId: "session-1",
      action: "test_action",
      details: { key: "value" },
      success: true,
    });

    expect(event.type).toBe("tool_call");
    expect(event.agentId).toBe("agent-1");
    expect(event.sessionId).toBe("session-1");
    expect(event.action).toBe("test_action");
    expect(event.details).toEqual({ key: "value" });
    expect(event.success).toBe(true);
    expect(event.severity).toBe("info");
    expect(event.timestamp).toBeGreaterThan(0);
    expect(event.isoTimestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("should set error severity when success is false", () => {
    const event = createAuditEvent({
      type: "tool_error",
      agentId: "agent-1",
      sessionId: "session-1",
      action: "test_action",
      details: {},
      success: false,
    });

    expect(event.severity).toBe("error");
  });

  it("should use custom severity", () => {
    const event = createAuditEvent({
      type: "security_event",
      agentId: "agent-1",
      sessionId: "session-1",
      action: "test_action",
      details: {},
      success: false,
      severity: "critical",
    });

    expect(event.severity).toBe("critical");
  });
});

describe("CompositeAuditLogger", () => {
  it("should log to multiple loggers", () => {
    const composite = new CompositeAuditLogger();
    const logger1 = new InMemoryAuditLogger();
    const logger2 = new InMemoryAuditLogger();

    composite.register(logger1);
    composite.register(logger2);

    const event = createAuditEvent({
      type: "tool_call",
      agentId: "agent-1",
      sessionId: "session-1",
      action: "test_action",
      details: {},
      success: true,
    });

    composite.log(event);

    expect(logger1.getEvents()).toHaveLength(1);
    expect(logger2.getEvents()).toHaveLength(1);
  });

  it("should handle logger errors gracefully", () => {
    const composite = new CompositeAuditLogger();
    const goodLogger = new InMemoryAuditLogger();

    const badLogger = {
      log: () => {
        throw new Error("Logger error");
      },
    };

    composite.register(goodLogger);
    composite.register(badLogger);

    const event = createAuditEvent({
      type: "tool_call",
      agentId: "agent-1",
      sessionId: "session-1",
      action: "test_action",
      details: {},
      success: true,
    });

    // Should not throw
    expect(() => composite.log(event)).not.toThrow();

    // Good logger should still have the event
    expect(goodLogger.getEvents()).toHaveLength(1);
  });
});

describe("Helper functions", () => {
  beforeEach(() => {
    // Reset global logger
    setAuditLogger(new CompositeAuditLogger());
  });

  it("should log tool call", () => {
    const logger = new InMemoryAuditLogger();
    getAuditLogger().register(logger);

    logToolCall({
      agentId: "agent-1",
      sessionId: "session-1",
      toolName: "calculator",
      input: { expression: "2+2" },
    });

    const events = logger.getEvents({ type: "tool_call" });
    expect(events).toHaveLength(1);
    expect(events[0].action).toBe("tool_call:calculator");
  });

  it("should log tool success", () => {
    const logger = new InMemoryAuditLogger();
    getAuditLogger().register(logger);

    logToolSuccess({
      agentId: "agent-1",
      sessionId: "session-1",
      toolName: "calculator",
      result: 4,
      duration: 100,
    });

    const events = logger.getEvents({ type: "tool_success" });
    expect(events).toHaveLength(1);
    expect(events[0].action).toBe("tool_success:calculator");
    expect(events[0].duration).toBe(100);
  });

  it("should log tool error", () => {
    const logger = new InMemoryAuditLogger();
    getAuditLogger().register(logger);

    logToolError({
      agentId: "agent-1",
      sessionId: "session-1",
      toolName: "calculator",
      error: "Division by zero",
      duration: 50,
    });

    const events = logger.getEvents({ type: "tool_error" });
    expect(events).toHaveLength(1);
    expect(events[0].success).toBe(false);
    expect(events[0].error).toBe("Division by zero");
  });

  it("should log security event", () => {
    const logger = new InMemoryAuditLogger();
    getAuditLogger().register(logger);

    logSecurityEvent({
      agentId: "agent-1",
      sessionId: "session-1",
      event: "path_traversal_attempt",
      details: { path: "../../etc/passwd" },
      severity: "warning",
    });

    const events = logger.getEvents({ type: "security_event" });
    expect(events).toHaveLength(1);
    expect(events[0].action).toBe("security:path_traversal_attempt");
    expect(events[0].severity).toBe("warning");
  });

  it("should log file access", () => {
    const logger = new InMemoryAuditLogger();
    getAuditLogger().register(logger);

    logFileAccess({
      agentId: "agent-1",
      sessionId: "session-1",
      operation: "read",
      filePath: "/tmp/test.txt",
      success: true,
    });

    const events = logger.getEvents({ type: "file_access" });
    expect(events).toHaveLength(1);
    expect(events[0].action).toBe("file_read");
  });

  it("should log code execution", () => {
    const logger = new InMemoryAuditLogger();
    getAuditLogger().register(logger);

    logCodeExecution({
      agentId: "agent-1",
      sessionId: "session-1",
      command: "ls -la",
      success: true,
      duration: 150,
      output: "file1.txt\nfile2.txt",
    });

    const events = logger.getEvents({ type: "code_execution" });
    expect(events).toHaveLength(1);
    expect(events[0].action).toBe("code_execute");
    expect(events[0].details?.output).toBe("file1.txt\nfile2.txt");
  });
});

describe("Global audit logger", () => {
  it("should return same logger instance", () => {
    const logger1 = getAuditLogger();
    const logger2 = getAuditLogger();

    expect(logger1).toBe(logger2);
  });

  it("should allow setting custom logger", () => {
    const customLogger = new CompositeAuditLogger();
    setAuditLogger(customLogger);

    expect(getAuditLogger()).toBe(customLogger);
  });
});
