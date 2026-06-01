import { GoogleGenerativeAI } from '@google/generative-ai';
import 'dotenv/config';

const API_KEY = process.env.GEMINI_API_KEY;

if (!API_KEY) {
  throw new Error('GEMINI_API_KEY not found in environment variables.');
}

const genAI = new GoogleGenerativeAI(API_KEY);

export async function runGemini(prompt: string, tools?: any[]) {
  // For now, we'll use a basic text generation model.
  // In the future, this will be extended to handle function calling.
  const model = genAI.getGenerativeModel({ model: 'gemini-pro' });

  const result = await model.generateContent(prompt);
  const response = await result.response;
  const text = response.text();
  return text;
}

