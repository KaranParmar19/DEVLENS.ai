import { describe, it, expect, beforeEach } from "vitest";
import { isAbortError, consumeLastCapturedError } from "./error-capture";

describe("error-capture: isAbortError", () => {
  it("detects ECONNRESET errors", () => {
    const err = new Error("aborted");
    (err as any).code = "ECONNRESET";
    expect(isAbortError(err)).toBe(true);
  });

  it("detects ERR_STREAM_PREMATURE_CLOSE errors", () => {
    const err = new Error("Connection closed before response was finished");
    (err as any).code = "ERR_STREAM_PREMATURE_CLOSE";
    expect(isAbortError(err)).toBe(true);
  });

  it("detects AbortError", () => {
    const err = new Error("The user aborted a request.");
    err.name = "AbortError";
    expect(isAbortError(err)).toBe(true);
  });

  it("detects nested cause with ECONNRESET", () => {
    const cause = new Error("aborted");
    (cause as any).code = "ECONNRESET";
    const wrapper = new Error("HTTPError", { cause });
    expect(isAbortError(wrapper)).toBe(true);
  });

  it("returns false for real application errors", () => {
    const err = new Error("Cannot read properties of undefined (reading 'map')");
    expect(isAbortError(err)).toBe(false);
  });

  it("returns false for null and undefined", () => {
    expect(isAbortError(null)).toBe(false);
    expect(isAbortError(undefined)).toBe(false);
  });
});
