import { Injectable, HttpException, Logger } from '@nestjs/common';
import { DeepSeekService } from './deepseek/deepseek.service';
import { GeminiService } from './gemini/gemini.service';
import { ToolRegistryService } from './tools/tool-registry.service';

function estimateTokens(text: string): number { return Math.ceil(text.length / 4); }

function truncateHistory(
  history: Array<{ role: string; content: string }>,
  maxTokens: number,
): Array<{ role: string; content: string }> {
  let total = history.reduce((s, m) => s + estimateTokens(m.content), 0);
  const result = [...history];
  while (result.length > 0 && total > maxTokens) {
    const removed = result.shift()!;
    total -= estimateTokens(removed.content);
  }
  return result;
}

function redact(s: string): string {
  return s.replace(/[A-Za-z0-9_-]{20,}/g, '[REDACTED]');
}

@Injectable()
export class LlmService {
  private readonly logger = new Logger(LlmService.name);
  private readonly timeoutMs = Number(process.env.LLM_TIMEOUT_MS ?? 30_000);
  private readonly maxTokens = Number(process.env.LLM_MAX_TOKENS ?? 50_000);

  constructor(
    private readonly deepseek: DeepSeekService,
    private readonly tools: ToolRegistryService,
    private readonly gemini?: GeminiService,
  ) {}

  async runToolUseLoop(
    message: string,
    _tools: unknown[] = [],
    history: Array<{ role: string; content: string }> = [],
  ): Promise<string> {
    const safeHistory = truncateHistory(history, this.maxTokens);
    this.logger.log(`LLM call: ~${estimateTokens(message)} tokens, ${safeHistory.length} history msgs`);

    // Advertise infrastructure tools so the model can query live systems.
    const toolOptions = {
      tools: this.tools.getToolSchemas(),
      executeTool: (name: string, args: Record<string, any>) => this.tools.executeTool(name, args),
    };

    try {
      const result = await Promise.race([
        this.deepseek.chat(message, safeHistory, toolOptions),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('LLM request timed out')), this.timeoutMs),
        ),
      ]);
      return result;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);

      // Try Gemini fallback if available (key configured)
      if (this.gemini?.isAvailable() && !msg.includes('timed out')) {
        this.logger.warn(`DeepSeek failed, trying Gemini fallback: ${redact(msg)}`);
        try {
          const fallbackResult = await Promise.race([
            this.gemini.runToolUseLoop(message, _tools as any),
            new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error('LLM request timed out')), this.timeoutMs),
            ),
          ]);
          return fallbackResult;
        } catch (fallbackErr: unknown) {
          const fallbackMsg = fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr);
          if (fallbackMsg.includes('timed out')) {
            this.logger.warn(`Gemini fallback also timed out after ${this.timeoutMs}ms`);
            throw new HttpException({ statusCode: 504, message: 'LLM request timed out', error: 'Gateway Timeout' }, 504);
          }
          this.logger.error(`Gemini fallback also failed: ${redact(fallbackMsg)}`);
          throw new HttpException({ statusCode: 502, message: 'LLM service unavailable', error: 'Bad Gateway' }, 502);
        }
      }

      if (msg.includes('timed out')) {
        this.logger.warn(`LLM timed out after ${this.timeoutMs}ms`);
        throw new HttpException({ statusCode: 504, message: 'LLM request timed out', error: 'Gateway Timeout' }, 504);
      }
      this.logger.error(`LLM failed: ${redact(msg)}`);
      throw new HttpException({ statusCode: 502, message: 'LLM service unavailable', error: 'Bad Gateway' }, 502);
    }
  }

  async checkHealth(): Promise<{ ok: boolean; latencyMs: number }> {
    const start = Date.now();
    try {
      await Promise.race([
        this.deepseek.chat('Reply with exactly: ok'),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 10_000)),
      ]);
      return { ok: true, latencyMs: Date.now() - start };
    } catch {
      return { ok: false, latencyMs: Date.now() - start };
    }
  }
}
