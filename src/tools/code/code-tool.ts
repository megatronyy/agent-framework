/**
 * Code Execution Tool
 *
 * Tool for executing shell commands with safety checks and audit logging.
 */

import { exec } from "node:child_process";
import { promisify } from "node:util";
import { resolve } from "node:path";
import type { Tool } from "../../types.js";
import { SecurityError, ValidationError } from "../../errors/index.js";
import { CommandValidator } from "../../validation/index.js";
import { logSecurityEvent, logCodeExecution, logToolError } from "../../audit/index.js";

const execAsync = promisify(exec);

/**
 * Code execution configuration
 */
interface CodeExecutionConfig {
  allowedCommands?: string[];
  allowArguments?: boolean;
  maxTimeout?: number;
  maxOutputSize?: number;
  workingDirectory?: string;
  envVars?: Record<string, string>;
}

/**
 * Default execution configuration (restrictive)
 */
const defaultConfig: CodeExecutionConfig = {
  allowArguments: true,
  maxTimeout: 30000,
  maxOutputSize: 10 * 1024 * 1024, // 10MB
  envVars: {
    PATH: process.env.PATH || "",
    HOME: process.env.HOME || "",
    LANG: "en_US.UTF-8",
  },
};

/**
 * Expanded dangerous command patterns
 */
const dangerousPatterns = [
  // Command injection
  /\$\(/, // Command substitution $(...)
  /`/, // Backtick command substitution
  /\${/, // Variable expansion with possible command sub

  // Pipe and chaining
  /\|/, // Pipe to another command
  /;/, // Command separator
  /&/, // Background command / command separator
  /\n/, // Newline command separator
  /\r/, // Carriage return

  // Redirection
  /</, // Input redirection
  />/, // Output redirection

  // System commands
  /\brm\s+/, // rm any form
  /dd\s+if=/, // dd (disk destroyer)
  />\s*\/dev\/(sd|hd|xv)d/, // Overwriting disk devices
  /mkfs\./, // Filesystem creation
  /fdisk/, // Partition manipulation
  /format\s+[a-z]:/, // Windows format
  /\bdel\s+/, // Windows delete

  // System control
  /shutdown\s/, // Shutdown
  /reboot\s/, // Reboot
  /halt/, // Halt
  /poweroff/, // Poweroff
  /init\s+0/, // Switch to runlevel 0
  /kill\s+-9\s+1/, // Kill init

  // Package management (can be destructive)
  /\bapt-get\s+(remove|purge|--purge)/,
  /\brpm\s+-e/,
  /\byum\s+(remove|erase)/,

  // Network attacks
  /\bnc\s+/, // Netcat
  /\bnmap\s+/,
  /\btcpdump\s+/,

  // Data destruction
  />\s*\/dev\/(sd|hd|xv)d/,
  /shred\s+/,
  /wipe\s+/,
];

/**
 * Check if a command contains dangerous patterns
 */
function isDangerousCommand(command: string): { dangerous: boolean; pattern?: RegExp; reason?: string } {
  for (const pattern of dangerousPatterns) {
    if (pattern.test(command)) {
      return { dangerous: true, pattern, reason: pattern.source };
    }
  }
  return { dangerous: false };
}

/**
 * Validate command for execution
 */
function validateCommand(
  command: string,
  config: CodeExecutionConfig,
  context: { agentId: string; sessionId: string }
): void {
  // Trim command
  const trimmed = command.trim();

  if (!trimmed) {
    throw new ValidationError("Command cannot be empty", "command");
  }

  // Check for null bytes
  if (trimmed.includes("\0")) {
    logSecurityEvent({
      agentId: context.agentId,
      sessionId: context.sessionId,
      event: "null_byte_in_command",
      details: { command },
      severity: "critical",
    });
    throw new SecurityError("Command contains null byte", "NULL_BYTE_DETECTED");
  }

  // Use command validator if allowed commands specified
  if (config.allowedCommands && config.allowedCommands.length > 0) {
    const validator = new CommandValidator({
      allowedCommands: config.allowedCommands,
      allowArguments: config.allowArguments,
    });

    const result = validator.validate(trimmed);
    if (!result.success) {
      logSecurityEvent({
        agentId: context.agentId,
        sessionId: context.sessionId,
        event: "command_not_allowed",
        details: { command, errors: result.errors },
        severity: "warning",
      });
      throw new SecurityError(
        `Command not allowed: ${result.errors.join(", ")}`,
        "COMMAND_NOT_ALLOWED",
        { command, errors: result.errors }
      );
    }
  }

  // Check dangerous patterns
  const dangerCheck = isDangerousCommand(trimmed);
  if (dangerCheck.dangerous) {
    logSecurityEvent({
      agentId: context.agentId,
      sessionId: context.sessionId,
      event: "dangerous_command_blocked",
      details: {
        command,
        pattern: dangerCheck.pattern?.source,
        reason: dangerCheck.reason,
      },
      severity: "warning",
    });
    throw new SecurityError(
      `Command contains dangerous pattern: ${dangerCheck.reason}`,
      "DANGEROUS_COMMAND",
      { command, pattern: dangerCheck.reason }
    );
  }

  // Check command length
  const maxLength = 10000;
  if (trimmed.length > maxLength) {
    throw new ValidationError(
      `Command too long: ${trimmed.length} characters (max: ${maxLength})`,
      "command"
    );
  }
}

/**
 * Sanitize command output
 */
function sanitizeOutput(output: string, maxSize: number): string {
  if (output.length > maxSize) {
    return output.slice(0, maxSize) + `\n[Output truncated, was ${output.length} bytes]`;
  }
  return output;
}

/**
 * Code execution tool
 */
export const codeExecuteTool: Tool = {
  name: "execute_code",
  description: "Execute shell commands and return the output. Commands are validated for security.",
  inputSchema: {
    type: "object",
    properties: {
      command: {
        type: "string",
        description: "Shell command to execute",
      },
      timeout: {
        type: "number",
        description: "Execution timeout in milliseconds (default: 30000, max: 60000)",
        default: 30000,
      },
      workingDir: {
        type: "string",
        description: "Working directory for command execution (default: current directory)",
      },
      env: {
        type: "object",
        description: "Environment variables to set for the command",
      },
    },
    required: ["command"],
  },
  handler: async ({ input, context }) => {
    const startTime = Date.now();
    const agentId = context.agentId;
    const sessionId = context.sessionId;

    try {
      const command = input.command as string;

      // Validate command
      validateCommand(command, defaultConfig, { agentId, sessionId });

      // Parse timeout
      let timeout = (input.timeout as number) ?? defaultConfig.maxTimeout!;
      const maxTimeout = 60000;
      if (timeout > maxTimeout) {
        timeout = maxTimeout;
      }

      // Parse working directory
      let cwd = input.workingDir as string | undefined;
      if (cwd) {
        // Check for path traversal BEFORE resolving
        if (cwd.includes("..")) {
          logSecurityEvent({
            agentId,
            sessionId,
            event: "path_traversal_in_working_dir",
            details: { workingDir: cwd },
            severity: "warning",
          });
          throw new SecurityError(
            "Working directory cannot contain '..'",
            "PATH_TRAVERSAL",
            { workingDir: cwd }
          );
        }

        // Resolve and validate working directory
        try {
          cwd = resolve(cwd);
        } catch (error) {
          throw new ValidationError(
            `Invalid working directory: ${cwd}`,
            "workingDir"
          );
        }
      }

      // Prepare environment variables
      const env = {
        ...defaultConfig.envVars,
        ...(input.env as Record<string, string> || {}),
      };

      // Remove dangerous environment variables
      delete env.PATH; // Use restricted PATH
      env.PATH = "/usr/bin:/bin:/usr/local/bin"; // Restricted PATH

      // Execute command
      const { stdout, stderr } = await execAsync(command, {
        timeout,
        cwd,
        maxBuffer: defaultConfig.maxOutputSize,
        env: env as Record<string, string>,
      });

      const duration = Date.now() - startTime;

      // Sanitize output
      const sanitizedStdout = sanitizeOutput(stdout || "", defaultConfig.maxOutputSize!);
      const sanitizedStderr = sanitizeOutput(stderr || "", defaultConfig.maxOutputSize!);

      logCodeExecution({
        agentId,
        sessionId,
        command,
        success: true,
        duration,
        output: sanitizedStdout,
      });

      return {
        content: JSON.stringify({
          success: true,
          exitCode: 0,
          stdout: sanitizedStdout.trim(),
          stderr: sanitizedStderr.trim(),
          duration: `${duration}ms`,
        }),
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      const err = error as {
        code?: string | number;
        stdout?: string;
        stderr?: string;
        message: string;
        killed?: boolean;
        signal?: string;
      };

      // Handle timeout
      if (err.killed || err.signal === "SIGTERM" || err.code === "ETIMEDOUT") {
        logCodeExecution({
          agentId,
          sessionId,
          command: input.command as string,
          success: false,
          duration,
          error: "Command execution timed out",
        });

        return {
          isError: true,
          content: JSON.stringify({
            success: false,
            error: "Command execution timed out",
            timeout: (input.timeout as number) ?? defaultConfig.maxTimeout,
            duration: `${duration}ms`,
          }),
        };
      }

      // Handle validation/security errors
      if (error instanceof SecurityError || error instanceof ValidationError) {
        logSecurityEvent({
          agentId,
          sessionId,
          event: "code_execution_blocked",
          details: { command: input.command, error: err.message },
          severity: "warning",
        });

        return {
          isError: true,
          content: JSON.stringify({
            success: false,
            error: err.message,
            code: error instanceof SecurityError ? "SECURITY_ERROR" : "VALIDATION_ERROR",
          }),
        };
      }

      // Handle other errors
      logToolError({
        agentId,
        sessionId,
        toolName: "execute_code",
        error: err as Error,
        duration,
      });

      return {
        isError: true,
        content: JSON.stringify({
          success: false,
          exitCode: err.code || 1,
          error: err.message,
          stdout: sanitizeOutput(err.stdout || "", defaultConfig.maxOutputSize!),
          stderr: sanitizeOutput(err.stderr || "", defaultConfig.maxOutputSize!),
          duration: `${duration}ms`,
        }),
      };
    }
  },
};
