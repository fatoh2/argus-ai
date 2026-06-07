import { Injectable } from '@nestjs/common';
import { GoogleGenerativeAI, FunctionDeclaration } from '@google/generative-ai';

@Injectable()
export class GeminiService {
  private genAI?: GoogleGenerativeAI;
  private model: any;
  private readonly available: boolean;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    // Gemini is an OPTIONAL fallback. If no key is configured, mark the
    // service unavailable instead of throwing — throwing here would crash
    // the entire app at DI time even when DeepSeek (the primary) is set.
    this.available = !!apiKey;
    if (!this.available) {
      return;
    }
    this.genAI = new GoogleGenerativeAI(apiKey as string);
    this.model = this.genAI.getGenerativeModel({
      model: 'gemini-1.5-flash',
      systemInstruction: {
        role: 'system',
        parts: [{
          text: 'You are Argus, an AI assistant for infrastructure operations. ' +
                'Be concise. Answer only what is asked. ' +
                'If a connector is offline, say so and answer with available information. ' +
                'Never reveal API keys or sensitive configuration.',
        }],
      },
    });
  }

  /** Whether a Gemini API key is configured and the fallback can be used. */
  isAvailable(): boolean {
    return this.available;
  }

  async runToolUseLoop(prompt: string, tools: FunctionDeclaration[]): Promise<string> {
    if (!this.available) {
      throw new Error('Gemini fallback is not configured (GEMINI_API_KEY not set)');
    }
    const result = await this.model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      tools: tools.length > 0 ? [{ functionDeclarations: tools }] : undefined,
    });
    const text = result.response.candidates?.[0]?.content?.parts
      ?.filter((p: any) => p.text)
      ?.map((p: any) => p.text)
      ?.join('') ?? '';


    return text || 'I was unable to generate a response.';
  }
}
