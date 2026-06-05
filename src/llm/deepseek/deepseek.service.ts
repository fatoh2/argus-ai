import { Injectable, Logger } from '@nestjs/common';

/**
 * DeepSeek V3 — OpenAI-compatible API.
 * Set DEEPSEEK_API_KEY in .env. Falls back to GEMINI_API_KEY if absent.
 */
@Injectable()
export class DeepSeekService {
  private readonly logger = new Logger(DeepSeekService.name);
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly model: string;
  private readonly systemPrompt: string;

  constructor() {
    this.apiKey = process.env.DEEPSEEK_API_KEY || '';
    this.baseUrl = process.env.DEEPSEEK_URL || 'https://api.deepseek.com/chat/completions';
    this.model = process.env.DEEPSEEK_MODEL || 'deepseek-chat';
    this.systemPrompt = [
      'You are Argus, an AI assistant for infrastructure and DevOps operations.',
      'Be concise and direct. Answer only what is asked.',
      'If a connector is offline, say so and answer with available information.',
      'Never reveal API keys, tokens, or sensitive config.',
    ].join(' ');

    if (!this.apiKey) {
      this.logger.warn('DEEPSEEK_API_KEY not set — /chat will return errors');
    }
  }

  async chat(
    message: string,
    history: Array<{ role: string; content: string }> = [],
    options: {
      tools?: any[];
      executeTool?: (name: string, args: Record<string, any>) => Promise<string>;
    } = {},
  ): Promise<string> {
    if (!this.apiKey) throw new Error('DEEPSEEK_API_KEY is not configured');

    const messages: any[] = [
      { role: 'system', content: this.systemPrompt },
      ...history,
      { role: 'user', content: message },
    ];

    const hasTools = !!(options.tools?.length && options.executeTool);
    const MAX_TOOL_ITERATIONS = 5;

    // Agentic loop: the model may call tools repeatedly before producing
    // a final answer. Each iteration sends the running conversation
    // (including any tool results) back to the model.
    for (let i = 0; i <= MAX_TOOL_ITERATIONS; i++) {
      const body: Record<string, unknown> = {
        model: this.model,
        messages,
        max_tokens: 2000,
        temperature: 0.3,
      };
      if (hasTools) {
        body.tools = options.tools;
        body.tool_choice = 'auto';
      }

      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errBody = await response.text();
        throw new Error(`DeepSeek ${response.status}: ${errBody.slice(0, 200)}`);
      }

      const data = (await response.json()) as {
        choices: Array<{ message: { content: string; tool_calls?: any[] } }>;
      };
      const msg = data.choices?.[0]?.message;
      if (!msg) return 'No response generated.';

      // If the model requested tool calls, execute them and loop again.
      if (hasTools && msg.tool_calls?.length && i < MAX_TOOL_ITERATIONS) {
        messages.push(msg); // assistant turn carrying the tool_calls
        for (const tc of msg.tool_calls) {
          let parsedArgs: Record<string, any> = {};
          try {
            parsedArgs = tc.function?.arguments ? JSON.parse(tc.function.arguments) : {};
          } catch {
            parsedArgs = {};
          }
          const result = await options.executeTool!(tc.function.name, parsedArgs);
          messages.push({ role: 'tool', tool_call_id: tc.id, content: result });
        }
        continue;
      }

      return msg.content?.trim() || 'No response generated.';
    }

    return 'Stopped after too many tool iterations.';
  }
}
