/**
 * Audit Logging System
 *
 * Provides security event logging for compliance and debugging.
 */

import { appendFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

/**
 * Audit event types
 */
export type AuditEventType =
  | "agent_start"
  | "agent_end"
  | "agent_error"
  | "tool_call"
  | "tool_success"
  | "tool_error"
  | "file_access"
  | "file_read"
  | "file_write"
  | "code_execution"
  | "security_event"
  | "handoff"
  | "session_start"
  | "session_end";

/**
 * Audit event severity
 */
export type AuditSeverity = "info" | "warning" | "error" | "critical";

/**
 * Audit event
 */
export interface AuditEvent {
  timestamp: number;
  isoTimestamp: string;
  severity: AuditSeverity;
  type: AuditEventType;
  agentId: string;
  sessionId: string;
  userId?: string;
  action: string;
  details: Record<string, unknown>;
  success: boolean;
  duration?: number;
  error?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Audit logger configuration
 */
export interface AuditLoggerConfig {
  logToFile?: boolean;
  logDirectory?: string;
  logToConsole?: boolean;
  includeStackTrace?: boolean;
  minSeverity?: AuditSeverity;
  bufferSize?: number;
  flushInterval?: number;
}

/**
 * In-memory audit logger
 */
export class InMemoryAuditLogger {
  private events: AuditEvent[] = [];
  private maxSize: number;

  constructor(maxSize = 10000) {
    this.maxSize = maxSize;
  }

  log(event: AuditEvent): void {
    this.events.push(event);

    // Keep only the most recent events
    if (this.events.length > this.maxSize) {
      this.events.shift();
    }
  }

  getEvents(filter?: {
    agentId?: string;
    sessionId?: string;
    type?: AuditEventType;
    since?: number;
    until?: number;
    limit?: number;
  }): AuditEvent[] {
    let filtered = [...this.events];

    if (filter) {
      if (filter.agentId) {
        filtered = filtered.filter((e) => e.agentId === filter.agentId);
      }
      if (filter.sessionId) {
        filtered = filtered.filter((e) => e.sessionId === filter.sessionId);
      }
      if (filter.type) {
        filtered = filtered.filter((e) => e.type === filter.type);
      }
      if (filter.since) {
        filtered = filtered.filter((e) => e.timestamp >= filter.since!);
      }
      if (filter.until) {
        filtered = filtered.filter((e) => e.timestamp <= filter.until!);
      }
      if (filter.limit) {
        filtered = filtered.slice(-filter.limit);
      }
    }

    return filtered.sort((a, b) => a.timestamp - b.timestamp);
  }

  clear(): void {
    this.events = [];
  }

  getCount(filter?: { agentId?: string; sessionId?: string; type?: AuditEventType }): number {
    return this.getEvents(filter).length;
  }
}

/**
 * File-based audit logger
 */
export class FileAuditLogger {
  private buffer: AuditEvent[] = [];
  private flushTimer?: ReturnType<typeof setInterval>;

  constructor(private config: AuditLoggerConfig = {}) {
    this.config = {
      logDirectory: config.logDirectory || "./logs/audit",
      logToConsole: config.logToConsole ?? false,
      includeStackTrace: config.includeStackTrace ?? false,
      minSeverity: config.minSeverity || "info",
      bufferSize: config.bufferSize || 100,
      flushInterval: config.flushInterval || 5000,
    };

    // Ensure log directory exists
    if (this.config.logToFile && this.config.logDirectory) {
      if (!existsSync(this.config.logDirectory)) {
        mkdirSync(this.config.logDirectory, { recursive: true });
      }
    }

    // Start flush timer
    if (this.config.flushInterval && this.config.flushInterval > 0) {
      this.flushTimer = setInterval(() => this.flush(), this.config.flushInterval);
    }
  }

  private shouldLog(severity: AuditSeverity): boolean {
    const levels: Record<AuditSeverity, number> = { info: 0, warning: 1, error: 2, critical: 3 };
    const minLevel = this.config.minSeverity || "info";
    return levels[severity] >= levels[minLevel];
  }

  private getCurrentLogFile(): string {
    const date = new Date().toISOString().split("T")[0];
    return join(this.config.logDirectory!, `audit-${date}.log`);
  }

  log(event: AuditEvent): void {
    if (!this.shouldLog(event.severity)) {
      return;
    }

    // Add stack trace if configured
    if (this.config.includeStackTrace && event.success === false) {
      event.metadata = event.metadata || {};
      event.metadata.stackTrace = new Error().stack;
    }

    // Log to console if configured
    if (this.config.logToConsole) {
      const consoleMethod = {
        info: console.log,
        warning: console.warn,
        error: console.error,
        critical: console.error,
      }[event.severity];

      consoleMethod(
        `[${event.isoTimestamp}] [${event.severity.toUpperCase()}] [${event.type}]`,
        {
          agentId: event.agentId,
          sessionId: event.sessionId,
          action: event.action,
          success: event.success,
          ...event.details,
        }
      );
    }

    // Buffer for file writing
    if (this.config.logToFile) {
      this.buffer.push(event);

      if (this.buffer.length >= (this.config.bufferSize || 100)) {
        this.flush();
      }
    }
  }

  flush(): void {
    if (this.buffer.length === 0) {
      return;
    }

    const logFile = this.getCurrentLogFile();

    try {
      // Write events to file
      for (const event of this.buffer) {
        appendFileSync(logFile, JSON.stringify(event) + "\n");
      }

      this.buffer = [];
    } catch (error) {
      console.error("Failed to write audit log:", error);
    }
  }

  shutdown(): void {
    this.flush();
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }
  }
}

/**
 * Composite audit logger - logs to multiple destinations
 */
export class CompositeAuditLogger {
  private loggers: Array<{ log: (event: AuditEvent) => void }> = [];

  register(logger: { log: (event: AuditEvent) => void }): void {
    this.loggers.push(logger);
  }

  log(event: AuditEvent): void {
    for (const logger of this.loggers) {
      try {
        logger.log(event);
      } catch (error) {
        console.error("Audit logger error:", error);
      }
    }
  }
}

/**
 * Global audit logger instance
 */
let globalLogger: CompositeAuditLogger | null = null;

/**
 * Get or create global audit logger
 */
export function getAuditLogger(): CompositeAuditLogger {
  if (!globalLogger) {
    globalLogger = new CompositeAuditLogger();
  }
  return globalLogger;
}

/**
 * Set global audit logger
 */
export function setAuditLogger(logger: CompositeAuditLogger): void {
  globalLogger = logger;
}

/**
 * Create an audit event
 */
export function createAuditEvent(params: {
  type: AuditEventType;
  agentId: string;
  sessionId: string;
  action: string;
  details: Record<string, unknown>;
  success: boolean;
  severity?: AuditSeverity;
  duration?: number;
  error?: Error | string;
  userId?: string;
  metadata?: Record<string, unknown>;
}): AuditEvent {
  const now = Date.now();
  const severity = params.severity || (params.success ? "info" : "error");

  return {
    timestamp: now,
    isoTimestamp: new Date(now).toISOString(),
    severity,
    type: params.type,
    agentId: params.agentId,
    sessionId: params.sessionId,
    userId: params.userId,
    action: params.action,
    details: params.details,
    success: params.success,
    duration: params.duration,
    error: params.error instanceof Error ? params.error.message : params.error,
    metadata: params.metadata,
  };
}

/**
 * Log an audit event
 */
export function logAudit(event: AuditEvent): void {
  getAuditLogger().log(event);
}

/**
 * Helper: Log tool call
 */
export function logToolCall(params: {
  agentId: string;
  sessionId: string;
  toolName: string;
  input: Record<string, unknown>;
  userId?: string;
}): void {
  logAudit(
    createAuditEvent({
      type: "tool_call",
      agentId: params.agentId,
      sessionId: params.sessionId,
      action: `tool_call:${params.toolName}`,
      details: { toolName: params.toolName, input: params.input },
      success: true,
      severity: "info",
      userId: params.userId,
    })
  );
}

/**
 * Helper: Log tool success
 */
export function logToolSuccess(params: {
  agentId: string;
  sessionId: string;
  toolName: string;
  result: unknown;
  duration: number;
  userId?: string;
}): void {
  logAudit(
    createAuditEvent({
      type: "tool_success",
      agentId: params.agentId,
      sessionId: params.sessionId,
      action: `tool_success:${params.toolName}`,
      details: { toolName: params.toolName, result: params.result },
      success: true,
      severity: "info",
      duration: params.duration,
      userId: params.userId,
    })
  );
}

/**
 * Helper: Log tool error
 */
export function logToolError(params: {
  agentId: string;
  sessionId: string;
  toolName: string;
  error: Error | string;
  duration?: number;
  userId?: string;
}): void {
  logAudit(
    createAuditEvent({
      type: "tool_error",
      agentId: params.agentId,
      sessionId: params.sessionId,
      action: `tool_error:${params.toolName}`,
      details: { toolName: params.toolName },
      success: false,
      severity: "error",
      error: params.error,
      duration: params.duration,
      userId: params.userId,
    })
  );
}

/**
 * Helper: Log security event
 */
export function logSecurityEvent(params: {
  agentId: string;
  sessionId: string;
  event: string;
  details: Record<string, unknown>;
  severity?: AuditSeverity;
  userId?: string;
}): void {
  logAudit(
    createAuditEvent({
      type: "security_event",
      agentId: params.agentId,
      sessionId: params.sessionId,
      action: `security:${params.event}`,
      details: params.details,
      success: false,
      severity: params.severity || "warning",
      userId: params.userId,
    })
  );
}

/**
 * Helper: Log file access
 */
export function logFileAccess(params: {
  agentId: string;
  sessionId: string;
  operation: "read" | "write" | "delete";
  filePath: string;
  success: boolean;
  error?: Error | string;
  userId?: string;
}): void {
  logAudit(
    createAuditEvent({
      type: params.success ? "file_access" : "security_event",
      agentId: params.agentId,
      sessionId: params.sessionId,
      action: `file_${params.operation}`,
      details: { operation: params.operation, filePath: params.filePath },
      success: params.success,
      severity: params.success ? "info" : "warning",
      error: params.error,
      userId: params.userId,
    })
  );
}

/**
 * Helper: Log code execution
 */
export function logCodeExecution(params: {
  agentId: string;
  sessionId: string;
  command: string;
  success: boolean;
  duration: number;
  output?: string;
  error?: Error | string;
  userId?: string;
}): void {
  logAudit(
    createAuditEvent({
      type: "code_execution",
      agentId: params.agentId,
      sessionId: params.sessionId,
      action: "code_execute",
      details: { command: params.command, output: params.output },
      success: params.success,
      severity: params.success ? "info" : "warning",
      error: params.error,
      duration: params.duration,
      userId: params.userId,
    })
  );
}
