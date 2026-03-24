/**
 * Error types tests
 */

import { describe, it, expect } from "vitest";
import {
  AgentError,
  ToolExecutionError,
  ValidationError,
  ContextOverflowError,
  SubagentHandoffError,
  ConfigurationError,
  ProviderError,
  SecurityError,
  RateLimitError,
  TimeoutError,
  isErrorType,
  getErrorCode,
  getErrorMessage,
} from "./index.js";

describe("AgentError", () => {
  it("should create base error with code and details", () => {
    const error = new AgentError("Something went wrong", "TEST_ERROR", { id: 123 });

    expect(error.message).toBe("Something went wrong");
    expect(error.code).toBe("TEST_ERROR");
    expect(error.details).toEqual({ id: 123 });
    expect(error.name).toBe("AgentError");
  });

  it("should serialize to JSON", () => {
    const error = new AgentError("Test error", "TEST", { key: "value" });
    const json = error.toJSON();

    expect(json).toEqual({
      name: "AgentError",
      message: "Test error",
      code: "TEST",
      details: { key: "value" },
    });
  });
});

describe("ToolExecutionError", () => {
  it("should create tool execution error", () => {
    const error = new ToolExecutionError("Tool failed", "myTool", { input: "test" });

    expect(error.message).toBe("Tool failed");
    expect(error.code).toBe("TOOL_EXECUTION_ERROR");
    expect(error.details?.toolName).toBe("myTool");
  });
});

describe("ValidationError", () => {
  it("should create validation error with field", () => {
    const error = new ValidationError("Invalid input", "email", { value: "bad-email" });

    expect(error.code).toBe("VALIDATION_ERROR");
    expect(error.details?.field).toBe("email");
  });
});

describe("ContextOverflowError", () => {
  it("should create context overflow error", () => {
    const error = new ContextOverflowError("Too many tokens", 100000, 150000);

    expect(error.code).toBe("CONTEXT_OVERFLOW");
    expect(error.details?.maxTokens).toBe(100000);
    expect(error.details?.actualTokens).toBe(150000);
  });
});

describe("SubagentHandoffError", () => {
  it("should create subagent handoff error", () => {
    const error = new SubagentHandoffError("Handoff failed", "agent1", "agent2");

    expect(error.code).toBe("SUBAGENT_HANDOFF_ERROR");
    expect(error.details?.fromAgent).toBe("agent1");
    expect(error.details?.toAgent).toBe("agent2");
  });
});

describe("SecurityError", () => {
  it("should create security error", () => {
    const error = new SecurityError("Security breach", "path_traversal", { path: "/etc/passwd" });

    expect(error.code).toBe("SECURITY_ERROR");
    expect(error.details?.reason).toBe("path_traversal");
  });
});

describe("Error helpers", () => {
  it("should check if error is specific type", () => {
    const error = new ValidationError("Invalid", "field");
    const genericError = new Error("Generic");

    expect(isErrorType(error, ValidationError)).toBe(true);
    expect(isErrorType(genericError, ValidationError)).toBe(false);
  });

  it("should get error code from typed error", () => {
    const error = new SecurityError("Security issue", "xss");
    expect(getErrorCode(error)).toBe("SECURITY_ERROR");
  });

  it("should get error code from generic error", () => {
    const error = new Error("Generic error");
    expect(getErrorCode(error)).toBe("Error");
  });

  it("should get error code from string", () => {
    expect(getErrorCode("string error")).toBe("UNKNOWN_ERROR");
  });

  it("should get error message from Error", () => {
    const error = new Error("Test message");
    expect(getErrorMessage(error)).toBe("Test message");
  });

  it("should get error message from string", () => {
    expect(getErrorMessage("string message")).toBe("string message");
  });

  it("should get error message from unknown", () => {
    expect(getErrorMessage(null)).toBe("Unknown error occurred");
  });
});
