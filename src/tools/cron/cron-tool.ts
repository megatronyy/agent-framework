/**
 * Cron tool - Schedule periodic tasks
 */

import type { Tool, ToolResult, ToolContext } from "../../types.js";

export interface CronJob {
  id: string;
  name: string;
  schedule: string; // cron expression
  enabled: boolean;
  action?: string;
  message?: string;
  lastRun?: number;
  nextRun?: number;
}

export interface CronSchedule {
  minute: string;
  hour: string;
  dayOfMonth: string;
  month: string;
  dayOfWeek: string;
}

// Simple in-memory cron storage (in production, use a proper scheduler)
const cronJobs = new Map<string, CronJob>();
const cronJobHistory = new Map<string, Array<{ timestamp: number; result: string }>>();

/**
 * Parse cron expression
 * Format: minute hour day-of-month month day-of-week
 * Example: "0 9 * * *" = Every day at 9:00 AM
 */
function parseCronExpression(expression: string): CronSchedule | null {
  const parts = expression.trim().split(/\s+/);
  if (parts.length !== 5) {
    return null;
  }

  const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;

  // Validate basic format (simplified)
  if (!/^[\d*\/\-,]+$/.test(minute)) return null;
  if (!/^[\d*\/\-,]+$/.test(hour)) return null;

  return { minute, hour, dayOfMonth, month, dayOfWeek };
}

/**
 * Calculate next run time for a cron job
 */
function calculateNextRun(schedule: CronSchedule): number {
  const now = new Date();
  const next = new Date(now);

  // Simple implementation - set to next scheduled time
  // In production, use a proper cron library like node-cron

  const minute = schedule.minute === "*" ? now.getMinutes() : parseInt(schedule.minute);
  const hour = schedule.hour === "*" ? now.getHours() : parseInt(schedule.hour);

  next.setHours(hour, minute, 0, 0);

  if (next <= now) {
    next.setDate(next.getDate() + 1);
  }

  return next.getTime();
}

/**
 * Format cron expression to human-readable description
 */
function describeCronExpression(expression: string): string {
  const schedule = parseCronExpression(expression);
  if (!schedule) {
    return expression;
  }

  const parts: string[] = [];
  // Extract all schedule values for potential use in description
  void [schedule.minute, schedule.hour, schedule.dayOfMonth, schedule.month, schedule.dayOfWeek];

  if (schedule.dayOfWeek !== "*") {
    const days = schedule.dayOfWeek.split(",");
    if (days.includes("*")) {
      parts.push("every day of the week");
    } else if (days.length === 1) {
      parts.push(`on ${dayOfWeekToName(parseInt(schedule.dayOfWeek))}`);
    }
  } else {
    parts.push("every day");
  }

  if (schedule.hour !== "*" && schedule.minute !== "*") {
    parts.push(`at ${schedule.hour}:${schedule.minute.padStart(2, "0")}`);
  } else if (schedule.hour !== "*") {
    parts.push(`at ${schedule.hour}:00`);
  }

  return parts.join(" ");
}

function dayOfWeekToName(day: number): string {
  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  return days[day % 7];
}

/**
 * Cron tool - Manage scheduled tasks
 */
export const cronTool: Tool = {
  name: "cron",
  description: "Manage scheduled periodic tasks. Supports adding, listing, removing, and running cron jobs.",
  inputSchema: {
    type: "object",
    properties: {
      action: {
        type: "string",
        enum: ["add", "list", "remove", "run", "status"],
        description: "Action to perform: add a new job, list all jobs, remove a job, run a job manually, or check status",
      },
      id: {
        type: "string",
        description: "Job identifier (for add, remove, run, status actions)",
      },
      name: {
        type: "string",
        description: "Human-readable name for the job",
      },
      schedule: {
        type: "string",
        description: 'Cron expression (e.g., "0 9 * * *" for daily at 9:00 AM)',
      },
      message: {
        type: "string",
        description: "Message or command to execute when the job runs",
      },
      enabled: {
        type: "boolean",
        description: "Whether the job is enabled",
        default: true,
      },
    },
    required: ["action"],
  },
  handler: async ({ input }: { input: Record<string, unknown>; context: ToolContext }): Promise<ToolResult> => {
    const action = input.action as string;

    switch (action) {
      case "add": {
        const id = input.id as string;
        const name = input.name as string;
        const schedule = input.schedule as string;
        const message = input.message as string;
        const enabled = input.enabled !== false;

        if (!id || !name || !schedule) {
          return {
            content: JSON.stringify({
              error: "Missing required fields: id, name, schedule",
            }),
            isError: true,
          };
        }

        const parsedSchedule = parseCronExpression(schedule);
        if (!parsedSchedule) {
          return {
            content: JSON.stringify({
              error: "Invalid cron expression. Use format: minute hour day-of-month month day-of-week (e.g., '0 9 * * *')",
            }),
            isError: true,
          };
        }

        const job: CronJob = {
          id,
          name,
          schedule,
          enabled,
          message,
          nextRun: calculateNextRun(parsedSchedule),
        };

        cronJobs.set(id, job);

        return {
          content: JSON.stringify({
            success: true,
            job: {
              ...job,
              description: describeCronExpression(schedule),
            },
          }),
          metadata: { jobId: id },
        };
      }

      case "list": {
        const jobs = Array.from(cronJobs.values());
        return {
          content: JSON.stringify({
            jobs: jobs.map((j) => ({
              ...j,
              description: describeCronExpression(j.schedule),
            })),
            count: jobs.length,
          }),
          metadata: { count: jobs.length },
        };
      }

      case "status": {
        const id = input.id as string;
        if (!id) {
          return {
            content: JSON.stringify({
              error: "Job id is required for status check",
            }),
            isError: true,
          };
        }

        const job = cronJobs.get(id);
        if (!job) {
          return {
            content: JSON.stringify({
              error: `Job not found: ${id}`,
            }),
            isError: true,
          };
        }

        return {
          content: JSON.stringify({
            job: {
              ...job,
              description: describeCronExpression(job.schedule),
            },
            history: cronJobHistory.get(id) || [],
          }),
          metadata: { jobId: id },
        };
      }

      case "remove": {
        const id = input.id as string;
        if (!id) {
          return {
            content: JSON.stringify({
              error: "Job id is required for removal",
            }),
            isError: true,
          };
        }

        const deleted = cronJobs.delete(id);
        cronJobHistory.delete(id);

        return {
          content: JSON.stringify({
            success: deleted,
            message: deleted ? `Job ${id} removed` : `Job ${id} not found`,
          }),
        };
      }

      case "run": {
        const id = input.id as string;
        if (!id) {
          return {
            content: JSON.stringify({
              error: "Job id is required to run",
            }),
            isError: true,
          };
        }

        const job = cronJobs.get(id);
        if (!job) {
          return {
            content: JSON.stringify({
              error: `Job not found: ${id}`,
            }),
            isError: true,
          };
        }

        // Execute the job
        const result = `Executed job: ${job.name}\nMessage: ${job.message || "(no message)"}`;
        const timestamp = Date.now();

        // Update history
        const history = cronJobHistory.get(id) || [];
        history.push({ timestamp, result });
        cronJobHistory.set(id, history);
        job.lastRun = timestamp;

        return {
          content: JSON.stringify({
            jobId: id,
            jobName: job.name,
            result,
            timestamp,
          }),
          metadata: { jobId: id, timestamp },
        };
      }

      default:
        return {
          content: JSON.stringify({
            error: `Unknown action: ${action}`,
          }),
          isError: true,
        };
    }
  },
};
