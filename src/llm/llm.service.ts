import { Injectable, Optional, Inject, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { GeminiService } from './gemini/gemini.service';
import { ToolDeclaration } from '@google/generative-ai';

/**
 * Rough token estimation: ~4 chars per token for English text.
 * Used for the token limit guard — not a precise tokenizer.
 */
function estimateTokenCount(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Truncate conversation history to fit within maxTokens.
 * Removes oldest messages first, keeping the most recent.
 */
function truncateConversation(
  messages: { role: string; content: string }[],
  maxTokens: number,
): { role: string; content: string }[] {
  let totalTokens = messages.reduce(
    (sum, m) => sum + estimateTokenCount(m.content),
    0,
  );

  if (totalTokens <= maxTokens) {
    return messages;
  }

  // Remove oldest messages until under limit
  const truncated = [...messages];
  while (truncated.length > 0 && totalTokens > maxTokens) {
    const oldest = truncated.shift();
    if (oldest) {
      totalTokens -= estimateTokenCount(oldest.content);
    }
  }

  return truncated;
}

/**
 * Sanitize a string for logging — redacts anything that looks like
 * an API key, token, secret, or sensitive infra data.
 */
function sanitizeForLog(input: string): string {
  return input
    // Redact API keys (alphanumeric strings 20+ chars)
    .replace(/[A-Za-z0-9_-]{20,}/g, '[REDACTED]')
    // Redact URLs with potential tokens
    .replace(/https?:\/\/[^\s]+/g, '[URL-REDACTED]')
    // Redact JSON-like structures that may contain secrets
    .replace(/"apiKey"\s*:\s*"[^"]+"/g, '"apiKey": "[REDACTED]"')
    .replace(/"token"\s*:\s*"[^"]+"/g, '"token": "[REDACTED]"')
    .replace(/"secret"\s*:\s*"[^"]+"/g, '"secret": "[REDACTED]"')
    .replace(/"password"\s*:\s*"[^"]+"/g, '"password": "[REDACTED]"');
}

export const LLM_SERVICE_OPTIONS = 'LLM_SERVICE_OPTIONS';

export interface LlmServiceOptions {
  timeoutMs?: number;
  maxPromptTokens?: number;
  maxRetries?: number;
}

const DEFAULT_OPTIONS: LlmServiceOptions = {
  timeoutMs: 30_000,
  maxPromptTokens: 50_000,
  maxRetries: 1,
};

@Injectable()
export class LlmService {
  private readonly logger = new Logger(LlmService.name);
  private readonly timeoutMs: number;
  private readonly maxPromptTokens: number;
  private readonly maxRetries: number;

  constructor(
    private readonly geminiService: GeminiService,
    @Optional() @Inject(LLM_SERVICE_OPTIONS)
    private readonly options?: LlmServiceOptions,
  ) {
    const opts = { ...DEFAULT_OPTIONS, ...(options || {}) };
    this.timeoutMs = opts.timeoutMs!;
    this.maxPromptTokens = opts.maxPromptTokens!;
    this.maxRetries = opts.maxRetries!;
  }

  /**
   * Run the LLM tool-use loop with timeout, retry, token guard, and safe logging.
   */
  async runToolUseLoop(
    prompt: string,
    tools: ToolDeclaration[],
    conversationHistory: { role: string; content: string }[] = [],
  ): Promise<string> {
    // --- Token limit guard ---
    const allMessages = [
      ...conversationHistory,
      { role: 'user', content: prompt },
    ];
    const truncatedHistory = truncateConversation(
      allMessages,
      this.maxPromptTokens,
    );

    const finalPrompt = truncatedHistory.map((m) => m.content).join('\n');

    // Log only metadata, never the prompt content
    this.logger.log(
      `LLM call: promptTokens=${estimateTokenCount(finalPrompt)} historyMessages=${truncatedHistory.length}`,
    );

    // --- Execute with timeout and retry ---
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      if (attempt > 0) {
        this.logger.warn(`Retrying LLM call (attempt ${attempt + 1})`);
      }

      try {
        const result = await this.executeWithTimeout(finalPrompt, tools);

        // Log only metadata about the response
        this.logger.log(
          `LLM call succeeded: attempt=${attempt + 1}`,
        );

        return result;
      } catch (error: any) {
        // Timeout errors are NOT retryable — return 504 immediately
        if (error instanceof HttpException && error.getStatus() === HttpStatus.GATEWAY_TIMEOUT) {
          throw error;
        }

        lastError = error;

        // Only retry on 5xx-like errors (server errors)
        const isServerError =
          (error.status && error.status >= 500) ||
          error.message?.includes('5') ||
          error.message?.includes('Internal') ||
          error.message?.includes('Server Error') ||
          error.message?.includes('Service Unavailable');

        if (!isServerError) {
          // Non-retryable error — fail immediately
          this.logger.warn(
            `LLM call failed (non-retryable): ${sanitizeForLog(error.message || 'Unknown error')}`,
          );
          throw this.mapErrorToHttpException(error);
        }

        if (attempt < this.maxRetries) {
          this.logger.warn(
            `LLM call failed with server error, will retry: ${sanitizeForLog(error.message || 'Unknown error')}`,
          );
        }
      }
    }

    // All retries exhausted
    this.logger.error(
      `LLM call failed after ${this.maxRetries + 1} attempts: ${sanitizeForLog(lastError?.message || 'Unknown error')}`,
    );
    throw new HttpException(
      {
        statusCode: HttpStatus.BAD_GATEWAY,
        message: 'LLM service unavailable after retries',
        error: 'Bad Gateway',
      },
      HttpStatus.BAD_GATEWAY,
    );
  }

  /**
   * Execute an LLM call with a hard timeout.
   * Returns 504 Gateway Timeout if the call exceeds timeoutMs.
   */
  private async executeWithTimeout(
    prompt: string,
    tools: ToolDeclaration[],
  ): Promise<string> {
    try {
      const result = await Promise.race([
        this.geminiService.runToolUseLoop(prompt, tools),
        this.createTimeoutPromise(),
      ]);

      return result;
    } catch (error: any) {
      if (error instanceof HttpException && error.getStatus() === HttpStatus.GATEWAY_TIMEOUT) {
        throw error;
      }
      throw this.mapErrorToHttpException(error);
    }
  }

  /**
   * Creates a promise that rejects with a 504 Gateway Timeout after this.timeoutMs.
   */
  private createTimeoutPromise(): Promise<any> {
    return new Promise((_resolve, reject) => {
      setTimeout(() => {
        reject(
          new HttpException(
            'LLM request timed out',
            HttpStatus.GATEWAY_TIMEOUT,
          ),
        );
      }, this.timeoutMs);
    });
  }

  /**
   * Performs a cheap LLM health check.
   * Returns { ok: true, latencyMs: N } on success, or throws an error on failure.
   */
  async checkHealth(): Promise<{ ok: boolean; latencyMs: number }> {
    const startTime = process.hrtime.bigint();
    try {
      // Use a very simple prompt that doesn't require tool use
      await this.executeWithTimeout('Hello', []);
      const endTime = process.hrtime.bigint();
      const latencyMs = Number(endTime - startTime) / 1_000_000;
      return { ok: true, latencyMs: parseFloat(latencyMs.toFixed(2)) };
    } catch (error) {
      const endTime = process.hrtime.bigint();
      const latencyMs = Number(endTime - startTime) / 1_000_000;
      this.logger.error(`Health check failed: ${sanitizeForLog(error.message || 'Unknown error')}`);
      return { ok: false, latencyMs: parseFloat(latencyMs.toFixed(2)) };
    }
  }

  /**
   * Maps various errors to appropriate HTTP exceptions.
   */
  private mapErrorToHttpException(error: any): HttpException {
    if (error instanceof HttpException) {
      return error;
    }
    if (error.name === 'GoogleGenerativeAIResponseError') {
      // Specific handling for Gemini API errors
      this.logger.error(
        `Gemini API error: status=${error.response.status} message=${sanitizeForLog(error.message)}`,
      );
      return new HttpException(
        {
          statusCode: error.response.status,
          message: `LLM service error: ${error.message}`,
          error: 'Bad Gateway',
        },
        HttpStatus.BAD_GATEWAY,
      );
    }
    // Rate limiting / quota errors
    if (
      error.message?.includes('429') ||
      error.message?.includes('quota') ||
      error.message?.includes('rate limit')
    ) {
      return new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: 'LLM rate limit exceeded',
          error: 'Too Many Requests',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    this.logger.error(
      `Unexpected LLM service error: ${sanitizeForLog(error.message || 'Unknown error')}`,
    );
    return new HttpException(
      'Internal LLM service error',
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }
}
