/**
 * Code Execution Tool
 *
 * Tool for executing shell commands with safety checks.
 */

import { exec } from "node:child_process";
import { promisify } from "node:util";
import type { Tool } from "../../types.js";

const execAsync = promisify(exec);

/**
 * Dangerous command patterns that should be blocked
 */
const dangerousPatterns = [
  /\brm\s+-rf\s+/, // rm -rf
  /\brm\s+-rf/, // rm -rf (without space after)
  /dd\s+if=/, // dd (disk destroyer)
  />\s*\/dev\/(sd|hd|xv)d/, // Overwriting disk devices
  /mkfs\./, // Filesystem creation
  /fdisk/, // Partition manipulation
  /format\s+[a-z]:/, // Windows format command
  /del\s+\/[sq]/, // Windows dangerous delete
  /shutdown\s+\/[s]/, // Windows shutdown
  /reboot\s*\//, // Reboot command
  /halt/, // Halt command
  /poweroff/, // Poweroff command
  /\>:$/, // Redirect to file with colon (truncation)
  /kill\s+-9\s+1/, // Kill init
];

/**
 * Check if a command contains dangerous patterns
 */
function isDangerousCommand(command: string): boolean {
  return dangerousPatterns.some((pattern) => pattern.test(command));
}

/**
 * Code execution tool
 */
export const codeExecuteTool: Tool = {
  name: "execute_code",
  description: "Execute shell commands and return the output",
  inputSchema: {
    type: "object",
    properties: {
      command: {
        type: "string",
        description: "Shell command to execute",
      },
      timeout: {
        type: "number",
        description: "Execution timeout in milliseconds (default: 30000)",
        default: 30000,
      },
      workingDir: {
        type: "string",
        description: "Working directory for command execution",
      },
    },
    required: ["command"],
  },
  handler: async ({ input }) => {
    const command = input.command as string;
    const timeout = (input.timeout as number) ?? 30000;
    const cwd = input.workingDir as string | undefined;

    if (!command) {
      return {
        isError: true,
        content: JSON.stringify({
          success: false,
          error: "Command is required",
        }),
      };
    }

    // Safety check for dangerous commands
    if (isDangerousCommand(command)) {
      return {
        isError: true,
        content: JSON.stringify({
          success: false,
          error: "Command contains dangerous patterns and was blocked for safety",
          command,
        }),
      };
    }

    try {
      const startTime = Date.now();
      const { stdout, stderr } = await execAsync(command, {
        timeout,
        cwd,
        maxBuffer: 10 * 1024 * 1024, // 10MB buffer
      });
      const duration = Date.now() - startTime;

      return {
        content: JSON.stringify({
          success: true,
          exitCode: 0,
          stdout: stdout.trim(),
          stderr: stderr.trim(),
          duration: `${duration}ms`,
        }),
      };
    } catch (error) {
      const err = error as { code?: string | number; stdout?: string; stderr?: string; message: string; killed?: boolean };

      // Handle timeout
      if (err.killed) {
        return {
          isError: true,
          content: JSON.stringify({
            success: false,
            error: "Command execution timed out",
            timeout,
          }),
        };
      }

      return {
        isError: true,
        content: JSON.stringify({
          success: false,
          exitCode: err.code || 1,
          error: err.message,
          stdout: err.stdout || "",
          stderr: err.stderr || "",
        }),
      };
    }
  },
};
