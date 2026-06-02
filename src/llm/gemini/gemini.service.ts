import { Injectable } from '@nestjs/common';
import { GoogleGenerativeAI, FunctionDeclaration } from '@google/generative-ai';

@Injectable()
export class GeminiService {
  private genAI: GoogleGenerativeAI;
  private model: any;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY is not set');
    }
    this.genAI = new GoogleGenerativeAI(apiKey);
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

  async runToolUseLoop(prompt: string, tools: FunctionDeclaration[]): Promise<string> {
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
