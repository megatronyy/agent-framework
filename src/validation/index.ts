/**
 * Input Validation Framework
 *
 * Provides consistent input validation and sanitization across the framework.
 */

import { resolve } from "node:path";
import { ValidationError } from "../errors/index.js";

/**
 * Validation result
 */
export interface ValidationResult<T = unknown> {
  success: boolean;
  value?: T;
  errors: string[];
}

/**
 * Validator interface
 */
export interface Validator<T> {
  validate(input: unknown): ValidationResult<T>;
  sanitize(input: unknown): T;
}

/**
 * Base validator class
 */
export abstract class BaseValidator<T> implements Validator<T> {
  protected errors: string[] = [];

  abstract validate(input: unknown): ValidationResult<T>;
  abstract sanitize(input: unknown): T;

  protected addError(message: string): void {
    this.errors.push(message);
  }

  protected resetErrors(): void {
    this.errors = [];
  }
}

/**
 * String validator
 */
export class StringValidator extends BaseValidator<string> {
  constructor(
    private options: {
      minLength?: number;
      maxLength?: number;
      pattern?: RegExp;
      allowedChars?: RegExp;
      trim?: boolean;
      lowercase?: boolean;
      uppercase?: boolean;
    } = {}
  ) {
    super();
  }

  validate(input: unknown): ValidationResult<string> {
    this.resetErrors();

    if (typeof input !== "string") {
      this.addError("Input must be a string");
      return { success: false, errors: this.errors };
    }

    let value = input;

    // Apply transformations before validation
    if (this.options.trim) {
      value = value.trim();
    }

    // Check length
    if (this.options.minLength !== undefined && value.length < this.options.minLength) {
      this.addError(
        `String must be at least ${this.options.minLength} characters long`
      );
    }

    if (this.options.maxLength !== undefined && value.length > this.options.maxLength) {
      this.addError(
        `String must be at most ${this.options.maxLength} characters long`
      );
    }

    // Check pattern
    if (this.options.pattern && !this.options.pattern.test(value)) {
      this.addError("String does not match required pattern");
    }

    // Check allowed characters
    if (this.options.allowedChars) {
      const invalidChars = value.match(new RegExp(`[^${this.options.allowedChars.source}]`, "g"));
      if (invalidChars) {
        this.addError(
          `String contains invalid characters: ${[...new Set(invalidChars)].join(", ")}`
        );
      }
    }

    return {
      success: this.errors.length === 0,
      value: this.errors.length === 0 ? value : undefined,
      errors: this.errors,
    };
  }

  sanitize(input: unknown): string {
    if (typeof input !== "string") {
      return String(input);
    }

    let value = input;

    if (this.options.trim) {
      value = value.trim();
    }

    if (this.options.lowercase) {
      value = value.toLowerCase();
    }

    if (this.options.uppercase) {
      value = value.toUpperCase();
    }

    // Remove characters not in allowed set
    if (this.options.allowedChars) {
      value = value.replace(new RegExp(`[^${this.options.allowedChars.source}]`, "g"), "");
    }

    return value;
  }
}

/**
 * Number validator
 */
export class NumberValidator extends BaseValidator<number> {
  constructor(
    private options: {
      min?: number;
      max?: number;
      integer?: boolean;
      positive?: boolean;
      nonNegative?: boolean;
    } = {}
  ) {
    super();
  }

  validate(input: unknown): ValidationResult<number> {
    this.resetErrors();

    let num: number;

    if (typeof input === "number") {
      num = input;
    } else if (typeof input === "string") {
      num = parseFloat(input);
      if (isNaN(num)) {
        this.addError("Input must be a valid number");
        return { success: false, errors: this.errors };
      }
    } else {
      this.addError("Input must be a number");
      return { success: false, errors: this.errors };
    }

    // Check integer
    if (this.options.integer && !Number.isInteger(num)) {
      this.addError("Number must be an integer");
    }

    // Check positive
    if (this.options.positive && num <= 0) {
      this.addError("Number must be positive");
    }

    // Check non-negative
    if (this.options.nonNegative && num < 0) {
      this.addError("Number must be non-negative");
    }

    // Check range
    if (this.options.min !== undefined && num < this.options.min) {
      this.addError(`Number must be at least ${this.options.min}`);
    }

    if (this.options.max !== undefined && num > this.options.max) {
      this.addError(`Number must be at most ${this.options.max}`);
    }

    return {
      success: this.errors.length === 0,
      value: this.errors.length === 0 ? num : undefined,
      errors: this.errors,
    };
  }

  sanitize(input: unknown): number {
    if (typeof input === "number") {
      return input;
    }
    if (typeof input === "string") {
      const num = parseFloat(input);
      return isNaN(num) ? 0 : num;
    }
    return 0;
  }
}

/**
 * Path validator - prevents path traversal attacks
 */
export class PathValidator extends BaseValidator<string> {
  constructor(
    private options: {
      allowedBase?: string[];
      allowRelative?: boolean;
      allowAbsolute?: boolean;
      requireExtension?: string[];
    } = {}
  ) {
    super();
  }

  validate(input: unknown): ValidationResult<string> {
    this.resetErrors();

    if (typeof input !== "string") {
      this.addError("Path must be a string");
      return { success: false, errors: this.errors };
    }

    const path = input;

    // Check for path traversal attempts
    if (path.includes("..") || path.includes("~")) {
      this.addError("Path cannot contain .. or ~ (path traversal not allowed)");
    }

    // Check absolute paths (allow if allowedBase is specified, as base directories use absolute paths)
    if (!this.options.allowAbsolute && !this.options.allowedBase && path.startsWith("/")) {
      this.addError("Absolute paths not allowed");
    }

    // Check relative paths
    if (!this.options.allowRelative && !path.startsWith("/")) {
      this.addError("Relative paths not allowed");
    }

    // Check allowed base directories
    if (this.options.allowedBase && this.options.allowedBase.length > 0) {
      const resolved = resolve(path);
      const allowed = this.options.allowedBase.some((base) =>
        resolved.startsWith(resolve(base))
      );

      if (!allowed) {
        this.addError(
          `Path must be within one of: ${this.options.allowedBase.join(", ")}`
        );
      }
    }

    // Check extension requirements
    if (this.options.requireExtension && this.options.requireExtension.length > 0) {
      const ext = path.split(".").pop()?.toLowerCase();
      if (!ext || !this.options.requireExtension.includes(ext)) {
        this.addError(
          `Path must have one of these extensions: ${this.options.requireExtension.join(", ")}`
        );
      }
    }

    return {
      success: this.errors.length === 0,
      value: this.errors.length === 0 ? path : undefined,
      errors: this.errors,
    };
  }

  sanitize(input: unknown): string {
    if (typeof input !== "string") {
      return "";
    }

    // Remove any path traversal attempts
    let path = input.replace(/\.\./g, "").replace(/~/g, "");

    // Remove multiple slashes
    path = path.replace(/\/+/g, "/");

    return path;
  }
}

/**
 * Command validator - prevents command injection
 */
export class CommandValidator extends BaseValidator<string> {
  // Dangerous command patterns
  private dangerousPatterns = [
    /\$\(/, // Command substitution $(...)
    /`/, // Backtick command substitution
    /\|/, // Pipe to another command
    /;/, // Command separator
    /&/, // Background command / command separator
    /\n/, // Newline command separator
    /\r/, // Carriage return
    /\t/, // Tab
    /</, // Input redirection
    />/, // Output redirection
  ];

  // Allowed commands (whitelist)
  private allowedCommands?: Set<string>;

  constructor(options: {
    allowedCommands?: string[];
    allowArguments?: boolean;
    maxArgs?: number;
  } = {}) {
    super();
    if (options.allowedCommands) {
      this.allowedCommands = new Set(options.allowedCommands);
    }
  }

  validate(input: unknown): ValidationResult<string> {
    this.resetErrors();

    if (typeof input !== "string") {
      this.addError("Command must be a string");
      return { success: false, errors: this.errors };
    }

    const command = input.trim();

    // Check for dangerous patterns
    for (const pattern of this.dangerousPatterns) {
      if (pattern.test(command)) {
        this.addError(`Command contains dangerous pattern: ${pattern.source}`);
      }
    }

    // Check command whitelist
    if (this.allowedCommands && this.allowedCommands.size > 0) {
      const cmdName = command.split(/\s+/)[0];
      if (!this.allowedCommands.has(cmdName)) {
        this.addError(
          `Command not allowed. Allowed commands: ${[...this.allowedCommands].join(", ")}`
        );
      }
    }

    return {
      success: this.errors.length === 0,
      value: this.errors.length === 0 ? command : undefined,
      errors: this.errors,
    };
  }

  sanitize(input: unknown): string {
    if (typeof input !== "string") {
      return "";
    }

    // Remove dangerous patterns
    let cmd = input;
    for (const pattern of this.dangerousPatterns) {
      cmd = cmd.replace(pattern, "");
    }

    return cmd.trim();
  }
}

/**
 * Object/Schema validator
 */
export class ObjectValidator<T extends Record<string, unknown>> extends BaseValidator<T> {
  constructor(
    private schema: {
      [K in keyof T]?: Validator<unknown>;
    }
  ) {
    super();
  }

  validate(input: unknown): ValidationResult<T> {
    this.resetErrors();

    if (typeof input !== "object" || input === null) {
      this.addError("Input must be an object");
      return { success: false, errors: this.errors };
    }

    const result = {} as T;
    const obj = input as Record<string, unknown>;

    for (const [key, validator] of Object.entries(this.schema)) {
      if (validator) {
        const value = obj[key];
        const validation = validator.validate(value);

        if (!validation.success) {
          this.addError(`${key}: ${validation.errors.join(", ")}`);
        } else if (validation.value !== undefined) {
          (result as Record<string, unknown>)[key] = validation.value;
        }
      }
    }

    return {
      success: this.errors.length === 0,
      value: this.errors.length === 0 ? result : undefined,
      errors: this.errors,
    };
  }

  sanitize(input: unknown): T {
    if (typeof input !== "object" || input === null) {
      return {} as T;
    }

    const result = {} as T;
    const obj = input as Record<string, unknown>;

    for (const [key, validator] of Object.entries(this.schema)) {
      if (validator) {
        (result as Record<string, unknown>)[key] = validator.sanitize(obj[key]);
      }
    }

    return result;
  }
}

/**
 * Array validator
 */
export class ArrayValidator<T> extends BaseValidator<T[]> {
  constructor(
    private itemValidator: Validator<T>,
    private options: {
      minLength?: number;
      maxLength?: number;
    } = {}
  ) {
    super();
  }

  validate(input: unknown): ValidationResult<T[]> {
    this.resetErrors();

    if (!Array.isArray(input)) {
      this.addError("Input must be an array");
      return { success: false, errors: this.errors };
    }

    // Check length
    if (this.options.minLength !== undefined && input.length < this.options.minLength) {
      this.addError(`Array must have at least ${this.options.minLength} items`);
    }

    if (this.options.maxLength !== undefined && input.length > this.options.maxLength) {
      this.addError(`Array must have at most ${this.options.maxLength} items`);
    }

    // Validate each item
    const items: T[] = [];
    const itemErrors: string[] = [];

    input.forEach((item, index) => {
      const result = this.itemValidator.validate(item);
      if (!result.success) {
        itemErrors.push(`[${index}]: ${result.errors.join(", ")}`);
      } else if (result.value !== undefined) {
        items.push(result.value);
      }
    });

    if (itemErrors.length > 0) {
      this.errors.push(...itemErrors.slice(0, 5)); // Limit errors
      if (itemErrors.length > 5) {
        this.addError(`...and ${itemErrors.length - 5} more errors`);
      }
    }

    return {
      success: this.errors.length === 0,
      value: this.errors.length === 0 ? items : undefined,
      errors: this.errors,
    };
  }

  sanitize(input: unknown): T[] {
    if (!Array.isArray(input)) {
      return [];
    }

    return input.map((item) => this.itemValidator.sanitize(item));
  }
}

/**
 * Convenience function to create validators
 */
export function validate<T>(
  input: unknown,
  validator: Validator<T>
): ValidationResult<T> {
  return validator.validate(input);
}

/**
 * Convenience function to sanitize input
 */
export function sanitize<T>(input: unknown, validator: Validator<T>): T {
  return validator.sanitize(input);
}

/**
 * Check validation result and throw if invalid
 */
export function assertValid<T>(result: ValidationResult<T>): T {
  if (!result.success) {
    throw new ValidationError(
      `Validation failed: ${result.errors.join("; ")}`,
      undefined,
      { errors: result.errors }
    );
  }
  return result.value!;
}
