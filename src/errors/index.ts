/**
 * Standardized Error Types
 *
 * Provides a consistent error handling system across the framework.
 */

/**
 * Base error class for all framework errors
 */
export class AgentError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace?.(this, this.constructor);
  }

  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      details: this.details,
    };
  }
}

/**
 * Tool execution errors
 */
export class ToolExecutionError extends AgentError {
  constructor(
    message: string,
    toolName: string,
    details?: Record<string, unknown>
  ) {
    super(message, "TOOL_EXECUTION_ERROR", { toolName, ...details });
    this.name = "ToolExecutionError";
  }
}

/**
 * Input validation errors
 */
export class ValidationError extends AgentError {
  constructor(
    message: string,
    field?: string,
    details?: Record<string, unknown>
  ) {
    super(message, "VALIDATION_ERROR", { field, ...details });
    this.name = "ValidationError";
  }
}

/**
 * Context overflow errors
 */
export class ContextOverflowError extends AgentError {
  constructor(
    message: string,
    maxTokens: number,
    actualTokens: number,
    details?: Record<string, unknown>
  ) {
    super(message, "CONTEXT_OVERFLOW", {
      maxTokens,
      actualTokens,
      ...details,
    });
    this.name = "ContextOverflowError";
  }
}

/**
 * Subagent handoff errors
 */
export class SubagentHandoffError extends AgentError {
  constructor(
    message: string,
    fromAgent: string,
    toAgent: string,
    details?: Record<string, unknown>
  ) {
    super(message, "SUBAGENT_HANDOFF_ERROR", {
      fromAgent,
      toAgent,
      ...details,
    });
    this.name = "SubagentHandoffError";
  }
}

/**
 * Configuration errors
 */
export class ConfigurationError extends AgentError {
  constructor(
    message: string,
    configPath?: string,
    details?: Record<string, unknown>
  ) {
    super(message, "CONFIGURATION_ERROR", {
      configPath,
      ...details,
    });
    this.name = "ConfigurationError";
  }
}

/**
 * Provider errors
 */
export class ProviderError extends AgentError {
  constructor(
    message: string,
    provider: string,
    details?: Record<string, unknown>
  ) {
    super(message, "PROVIDER_ERROR", { provider, ...details });
    this.name = "ProviderError";
  }
}

/**
 * Security errors
 */
export class SecurityError extends AgentError {
  constructor(
    message: string,
    reason: string,
    details?: Record<string, unknown>
  ) {
    super(message, "SECURITY_ERROR", { reason, ...details });
    this.name = "SecurityError";
  }
}

/**
 * Rate limit errors
 */
export class RateLimitError extends AgentError {
  constructor(
    message: string,
    limit: number,
    windowMs: number,
    details?: Record<string, unknown>
  ) {
    super(message, "RATE_LIMIT_ERROR", {
      limit,
      windowMs,
      ...details,
    });
    this.name = "RateLimitError";
  }
}

/**
 * Timeout errors
 */
export class TimeoutError extends AgentError {
  constructor(
    message: string,
    timeout: number,
    details?: Record<string, unknown>
  ) {
    super(message, "TIMEOUT_ERROR", { timeout, ...details });
    this.name = "TimeoutError";
  }
}

/**
 * Helper function to check if an error is a specific type
 */
export function isErrorType<T extends new (...args: any[]) => AgentError>(
  error: unknown,
  errorType: T
): error is InstanceType<T> {
  return error instanceof errorType;
}

/**
 * Helper function to get error code from unknown error
 */
export function getErrorCode(error: unknown): string {
  if (error instanceof AgentError) {
    return error.code;
  }
  if (error instanceof Error) {
    return error.name;
  }
  return "UNKNOWN_ERROR";
}

/**
 * Helper function to get error message from unknown error
 */
export function getErrorMessage(error: unknown): string {
  if (typeof error === "string") {
    return error;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "Unknown error occurred";
}
