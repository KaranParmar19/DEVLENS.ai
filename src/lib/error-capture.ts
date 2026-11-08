// Captures the original Error out-of-band so server.ts can recover the stack
// when h3 has already swallowed the throw into a generic 500 Response.

let lastCapturedError: { error: unknown; at: number } | undefined;
const TTL_MS = 5_000;

export function isAbortError(error: unknown): boolean {
  if (!error) return false;
  if (typeof error === "object") {
    const err = error as { code?: string; name?: string; message?: string; cause?: unknown };
    if (
      err.code === "ECONNRESET" ||
      err.code === "ERR_STREAM_PREMATURE_CLOSE" ||
      err.code === "UND_ERR_ABORTED" ||
      err.name === "AbortError" ||
      err.message === "aborted" ||
      err.message === "The user aborted a request." ||
      err.message === "Connection closed before response was finished"
    ) {
      return true;
    }
    if (err.cause && isAbortError(err.cause)) {
      return true;
    }
  }
  return false;
}

function record(error: unknown) {
  if (isAbortError(error)) {
    return;
  }
  lastCapturedError = { error, at: Date.now() };
}

if (typeof globalThis.addEventListener === "function") {
  globalThis.addEventListener("error", (event) => record((event as ErrorEvent).error ?? event));
  globalThis.addEventListener("unhandledrejection", (event) =>
    record((event as PromiseRejectionEvent).reason),
  );
}

export function consumeLastCapturedError(): unknown {
  if (!lastCapturedError) return undefined;
  if (Date.now() - lastCapturedError.at > TTL_MS) {
    lastCapturedError = undefined;
    return undefined;
  }
  const { error } = lastCapturedError;
  lastCapturedError = undefined;
  return error;
}
