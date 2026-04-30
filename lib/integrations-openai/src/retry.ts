import pRetry, { type Options } from "p-retry";
import { APIError as OpenAIAPIError } from "openai";

export type RetryOptions = Options;

/**
 * Returns true for HTTP 429 / rate-limit responses.
 */
export function isRateLimitError(err: unknown): boolean {
  if (err instanceof OpenAIAPIError) {
    return err.status === 429;
  }
  // Fallback for nested error shapes
  const status = (err as { status?: number; statusCode?: number })?.status ??
    (err as { statusCode?: number })?.statusCode;
  return status === 429;
}

/**
 * True for errors worth retrying: 408, 429, 5xx, network errors, ECONNRESET, etc.
 */
export function isTransientError(err: unknown): boolean {
  if (err instanceof OpenAIAPIError) {
    if (err.status === undefined) return true; // network error
    return err.status === 408 || err.status === 429 || err.status >= 500;
  }
  const code = (err as { code?: string })?.code;
  if (code === "ECONNRESET" || code === "ETIMEDOUT" || code === "ENOTFOUND") {
    return true;
  }
  return false;
}

/**
 * Wraps an async operation with exponential backoff retry on transient errors.
 *
 * Default config: 3 retries, exponential backoff starting at 500ms, jitter,
 * capped at 8s. Aborts immediately on non-transient errors.
 */
export async function withRetry<T>(
  fn: (attempt: number) => Promise<T>,
  options: Omit<RetryOptions, "onFailedAttempt"> & {
    onFailedAttempt?: (err: Error, attempt: number) => void;
  } = {},
): Promise<T> {
  return pRetry(
    async (attemptNumber) => {
      try {
        return await fn(attemptNumber);
      } catch (err) {
        if (!isTransientError(err)) {
          // p-retry has an AbortError class for non-retryable failures, but
          // exporting it cross-module is fragile across versions; instead,
          // we just re-throw and rely on the `retries` count to bound work.
          // Mark as final by attaching a property checked in shouldRetry.
          (err as { __noRetry?: boolean }).__noRetry = true;
        }
        throw err;
      }
    },
    {
      retries: 3,
      factor: 2,
      minTimeout: 500,
      maxTimeout: 8000,
      randomize: true,
      ...options,
      shouldRetry: (err) => !(err as { __noRetry?: boolean }).__noRetry,
      onFailedAttempt: (err) => {
        options.onFailedAttempt?.(err, err.attemptNumber);
      },
    },
  );
}
