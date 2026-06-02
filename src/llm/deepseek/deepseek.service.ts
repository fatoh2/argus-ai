import { Injectable, Logger } from "@nestjs/common";

/**
 * DeepSeek V3 LLM service — OpenAI-compatible API.
 * Cheap (~$1-3/month), no rate wall, excellent at code and infra questions.
 */
@Injectable()
export class DeepSeekService {
  private readonly logger = new Logger(DeepSeekService.name);
  private readonly apiKey: string;
  private readonly url = process.env.DEEPSEEK_URL || "https://api.deepseek.com/chat/completions";
  private readonly model = process.env.DEEPSEEK_MODEL || "deepseek-chat";
  private readonly systemPrompt = [
    "You are Argus, an AI assistant for infrastructure and DevOps operations.",
    "Be concise and direct. Answer only what is asked.",
    "If a connector is offline, say so clearly and answer with available information.",
    "Never reveal API keys, tokens, or sensitive configuration in your responses.",
  ].join(" ");

  constructor() {
    this.apiKey = process.env.DEEPSEEK_API_KEY || "";
    if (!this.apiKey) {
      this.logger.warn("DEEPSEEK_API_KEY not set — /chat will return errors");
    }
  }

  async chat(
    message: string,
    history: { role: string; content: string }[] = [],
  ): Promise<string> {
    if (!this.apiKey) throw new Error("DEEPSEEK_API_KEY is not set");

    const messages = [
      { role: "system", content: this.systemPrompt },
      ...history,
      { role: "user", content: message },
    ];

    const response = await fetch(this.url, {
      method: "POST",
      headers: {
        "Authorization": ,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: this.model,
        messages,
        max_tokens: 2000,
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error();
    }

    const data = await response.json() as any;
    return data.choices?.[0]?.message?.content?.trim() || "No response generated.";
  }
}
