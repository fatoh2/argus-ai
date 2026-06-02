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
  ): Promise<string> {
    if (!this.apiKey) throw new Error('DEEPSEEK_API_KEY is not configured');

    const messages = [
      { role: 'system', content: this.systemPrompt },
      ...history,
      { role: 'user', content: message },
    ];

    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ model: this.model, messages, max_tokens: 2000, temperature: 0.3 }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`DeepSeek ${response.status}: ${body.slice(0, 200)}`);
    }

    const data = (await response.json()) as { choices: Array<{ message: { content: string } }> };
    return data.choices?.[0]?.message?.content?.trim() || 'No response generated.';
  }
}
