/**
 * Structured error result returned by connectors on failure.
 * The LLM context builder checks for this shape to insert placeholders.
 */
export interface ConnectorErrorResult<T = null> {
  error: string;
  data: T;
}

/**
 * Wraps a connector call with a timeout and structured error handling.
 *
 * @param connectorName - Human-readable name for logging (e.g. 'k8s prometheus')
 * @param fn - The async connector function to call
 * @param timeoutMs - Timeout in milliseconds (default 10_000)
 * @returns The result or a ConnectorErrorResult on failure
 */
export async function withConnectorErrorHandling<T>(
  connectorName: string,
  fn: () => Promise<T>,
  timeoutMs: number = 10_000,
): Promise<T | ConnectorErrorResult<T>> {
  const start = Date.now();

  try {
    const result = await withTimeout(fn(), timeoutMs);
    return result;
  } catch (error: any) {
    const duration = Date.now() - start;
    const errorType = error.name || 'UnknownError';
    const message = error.message || String(error);

    // Log connector name, error type, duration — never API keys or tokens
    console.error(
      `[connector:${connectorName}] error=${errorType} duration=${duration}ms message="${sanitizeLog(message)}"`,
    );

    return {
      error: `${connectorName} unavailable`,
      data: null as T,
    };
  }
}

/**
 * Creates a promise that rejects after a given timeout.
 */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      const err = new Error(`Timed out after ${ms}ms`);
      err.name = 'TimeoutError';
      reject(err);
    }, ms);
  });

  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer!));
}

/**
 * Sanitize log output — strip anything that looks like an API key or token.
 * Basic heuristic: redact strings matching common key patterns.
 */
function sanitizeLog(message: string): string {
  // Redact anything that looks like a bearer token, API key, or secret
  return message.replace(
    /(?:bearer\s+|api[_-]?key\s*[:=]\s*|token\s*[:=]\s*|secret\s*[:=]\s*)(['"]?)[a-zA-Z0-9_\-.]{16,}\1/gi,
    '$1***redacted***$1',
  );
}
