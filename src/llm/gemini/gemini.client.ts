import { GoogleGenerativeAI } from '@google/generative-ai';
export class GeminiClient {
  private client: GoogleGenerativeAI;

  constructor(apiKey: string) {
    this.client = new GoogleGenerativeAI(apiKey);
  }

  async sendMessage(prompt: string): Promise<string> {
    const model = this.client.getGenerativeModel({ model: 'gemini-pro' });
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    return text;
  }

  // Add more methods for tool use here as needed
}
