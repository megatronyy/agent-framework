/**
 * Validation framework tests
 */

import { describe, it, expect } from "vitest";
import {
  StringValidator,
  NumberValidator,
  PathValidator,
  CommandValidator,
  ObjectValidator,
  ArrayValidator,
  validate,
  sanitize,
  assertValid,
} from "./index.js";

describe("StringValidator", () => {
  it("should validate string length", () => {
    const validator = new StringValidator({
      minLength: 3,
      maxLength: 10,
    });

    const result1 = validator.validate("hi");
    expect(result1.success).toBe(false);
    expect(result1.errors).toContain("String must be at least 3 characters long");

    const result2 = validator.validate("12345678901");
    expect(result2.success).toBe(false);
    expect(result2.errors).toContain("String must be at most 10 characters long");

    const result3 = validator.validate("hello");
    expect(result3.success).toBe(true);
    expect(result3.value).toBe("hello");
  });

  it("should validate pattern", () => {
    const validator = new StringValidator({
      pattern: /^[a-z]+$/,
    });

    const result1 = validator.validate("abc123");
    expect(result1.success).toBe(false);

    const result2 = validator.validate("abcxyz");
    expect(result2.success).toBe(true);
  });

  it("should sanitize strings", () => {
    const validator = new StringValidator({
      trim: true,
      lowercase: true,
    });

    expect(validator.sanitize("  HELLO  ")).toBe("hello");
  });
});

describe("NumberValidator", () => {
  it("should validate number range", () => {
    const validator = new NumberValidator({
      min: 0,
      max: 100,
      integer: true,
    });

    const result1 = validator.validate(-5);
    expect(result1.success).toBe(false);

    const result2 = validator.validate(3.14);
    expect(result2.success).toBe(false);
    expect(result2.errors).toContain("Number must be an integer");

    const result3 = validator.validate(50);
    expect(result3.success).toBe(true);
    expect(result3.value).toBe(50);
  });

  it("should validate positive numbers", () => {
    const validator = new NumberValidator({
      positive: true,
    });

    const result1 = validator.validate(0);
    expect(result1.success).toBe(false);
    expect(result1.errors).toContain("Number must be positive");

    const result2 = validator.validate(5);
    expect(result2.success).toBe(true);
  });

  it("should sanitize to number", () => {
    const validator = new NumberValidator();

    expect(validator.sanitize("123.45")).toBe(123.45);
    expect(validator.sanitize("invalid")).toBe(0);
  });
});

describe("PathValidator", () => {
  it("should block path traversal", () => {
    const validator = new PathValidator();

    const result1 = validator.validate("../../etc/passwd");
    expect(result1.success).toBe(false);
    expect(result1.errors.some((e) => e.includes("path traversal"))).toBe(true);
  });

  it("should block home directory access", () => {
    const validator = new PathValidator();

    const result1 = validator.validate("~/.ssh");
    expect(result1.success).toBe(false);
    expect(result1.errors.some((e) => e.includes("~"))).toBe(true);
  });

  it("should block absolute paths when not allowed", () => {
    const validator = new PathValidator({
      allowAbsolute: false,
    });

    const result1 = validator.validate("/etc/passwd");
    expect(result1.success).toBe(false);
    expect(result1.errors).toContain("Absolute paths not allowed");
  });

  it("should validate against allowed base directories", () => {
    const validator = new PathValidator({
      allowedBase: ["/tmp", "/home/user/work"],
    });

    const result1 = validator.validate("/tmp/test.txt");
    expect(result1.success).toBe(true);

    const result2 = validator.validate("/etc/passwd");
    expect(result2.success).toBe(false);
  });

  it("should sanitize paths", () => {
    const validator = new PathValidator();

    expect(validator.sanitize("../../etc/passwd")).not.toContain("..");
    expect(validator.sanitize("path//to///file")).toBe("path/to/file");
  });
});

describe("CommandValidator", () => {
  it("should block dangerous patterns", () => {
    const validator = new CommandValidator();

    const result1 = validator.validate("cat file.txt | grep test");
    expect(result1.success).toBe(false);
    expect(result1.errors.some((e) => e.includes("dangerous pattern"))).toBe(true);
  });

  it("should validate against whitelist", () => {
    const validator = new CommandValidator({
      allowedCommands: ["ls", "cat", "echo"],
    });

    const result1 = validator.validate("ls -la");
    expect(result1.success).toBe(true);

    const result2 = validator.validate("rm file.txt");
    expect(result2.success).toBe(false);
  });

  it("should sanitize commands", () => {
    const validator = new CommandValidator();

    const sanitized = validator.sanitize("cat file.txt | grep test");
    expect(sanitized).not.toContain("|");
  });
});

describe("ObjectValidator", () => {
  it("should validate object properties", () => {
    const validator = new ObjectValidator({
      name: new StringValidator({ minLength: 2 }),
      age: new NumberValidator({ min: 0, max: 120 }),
    });

    const result1 = validator.validate({ name: "A", age: 25 });
    expect(result1.success).toBe(false);
    expect(result1.errors[0]).toMatch(/name.*at least 2 characters/);

    const result2 = validator.validate({ name: "John", age: 25 });
    expect(result2.success).toBe(true);
    expect(result2.value).toEqual({ name: "John", age: 25 });
  });
});

describe("ArrayValidator", () => {
  it("should validate array items", () => {
    const validator = new ArrayValidator(
      new NumberValidator({ min: 0, max: 10 })
    );

    const result1 = validator.validate([1, 2, 3]);
    expect(result1.success).toBe(true);
    expect(result1.value).toEqual([1, 2, 3]);

    const result2 = validator.validate([1, 15, 3]);
    expect(result2.success).toBe(false);
  });

  it("should validate array length", () => {
    const validator = new ArrayValidator(
      new StringValidator(),
      { minLength: 1, maxLength: 3 }
    );

    const result1 = validator.validate([]);
    expect(result1.success).toBe(false);
    expect(result1.errors).toContain("Array must have at least 1 items");

    const result2 = validator.validate(["a", "b", "c", "d"]);
    expect(result2.success).toBe(false);
    expect(result2.errors).toContain("Array must have at most 3 items");
  });
});

describe("Helper functions", () => {
  it("should validate using helper", () => {
    const validator = new StringValidator({ minLength: 3 });
    const result = validate("hi", validator);
    expect(result.success).toBe(false);
  });

  it("should sanitize using helper", () => {
    const validator = new StringValidator({ trim: true });
    expect(sanitize("  test  ", validator)).toBe("test");
  });

  it("should assert valid and throw if invalid", () => {
    const validator = new StringValidator({ minLength: 5 });
    const result = validator.validate("sho"); // Only 3 chars, less than min 5

    expect(() => assertValid(result)).toThrow();
    expect(() => assertValid(result)).toThrow("Validation failed");
  });

  it("should not throw when valid", () => {
    const validator = new StringValidator({ minLength: 5 });
    const result = validator.validate("long enough");

    expect(() => assertValid(result)).not.toThrow();
    expect(assertValid(result)).toBe("long enough");
  });
});
