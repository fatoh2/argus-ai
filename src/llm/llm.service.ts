import { Injectable, HttpException, HttpStatus, Logger } from "@nestjs/common";
import { DeepSeekService } from "./deepseek/deepseek.service";

function estimateTokenCount(text: string): number {
  return Math.ceil(text.length / 4);
}

function truncateHistory(
  history: { role: string; content: string }[],
  maxTokens: number,
): { role: string; content: string }[] {
  let total = history.reduce((s, m) => s + estimateTokenCount(m.content), 0);
  const truncated = [...history];
  while (truncated.length > 0 && total > maxTokens) {
    const removed = truncated.shift()!;
    total -= estimateTokenCount(removed.content);
  }
  return truncated;
}

@Injectable()
export class LlmService {
  private readonly logger = new Logger(LlmService.name);
  private readonly timeoutMs = parseInt(process.env.LLM_TIMEOUT_MS || "30000");
  private readonly maxTokens = parseInt(process.env.LLM_MAX_TOKENS || "50000");

  constructor(private readonly deepseek: DeepSeekService) {}

  async runToolUseLoop(
    message: string,
    _tools: any[] = [],
    history: { role: string; content: string }[] = [],
  ): Promise<string> {
    const safeHistory = truncateHistory(history, this.maxTokens);
    this.logger.log(
      ,
    );

    try {
      const result = await Promise.race([
        this.deepseek.chat(message, safeHistory),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("LLM request timed out")), this.timeoutMs),
        ),
      ]);
      return result;
    } catch (err: any) {
      if (err.message?.includes("timed out")) {
        this.logger.warn();
        throw new HttpException({ statusCode: 504, message: "LLM request timed out", error: "Gateway Timeout" }, 504);
      }
      this.logger.error();
      throw new HttpException({ statusCode: 502, message: "LLM service unavailable", error: "Bad Gateway" }, 502);
    }
  }

  async checkHealth(): Promise<{ ok: boolean; latencyMs: number }> {
    const start = Date.now();
    try {
      await Promise.race([
        this.deepseek.chat("Reply with exactly: ok"),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), 10000)),
      ]);
      return { ok: true, latencyMs: Date.now() - start };
    } catch {
      return { ok: false, latencyMs: Date.now() - start };
    }
  }
}
