import { Injectable } from '@nestjs/common';
import { GoogleGenerativeAI, ToolDeclaration } from '@google/generative-ai';

@Injectable()
export class GeminiService {
  private genAI: GoogleGenerativeAI;
  private model;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY not set');
    }
    this.genAI = new GoogleGenerativeAI(apiKey);
    this.model = this.genAI.getGenerativeModel({
      model: 'gemini-pro',
      systemInstruction: {
        parts: [
          {
            text:
              'You are an AI assistant for Argus. Your primary role is to help with infrastructure operations. \nRespond concisely and only with the information requested. \nIf you need to use a tool, describe the tool call in the required format. \nDo not invent tools or parameters. \nIf a tool execution fails, inform the user and do not attempt to use it again. \nIf you cannot fulfill the request with the available tools, state that clearly.'
          },
        ],
      },
    });
  }

  async runToolUseLoop(prompt: string, tools: ToolDeclaration[]): Promise<any> {
    const result = await this.model.generateContent({
      contents: [{ parts: [{ text: prompt }] }],
      tools: { functionDeclarations: tools },
    });

    const response = result.response;
    const toolCalls = response.candidates?.[0]?.content?.parts?.[0]?.functionCall;

    if (toolCalls) {
      const toolName = toolCalls.name;
      const toolArgs = JSON.parse(toolCalls.args);

      // Find the tool function to execute
      const toolToExecute = tools.find(tool => tool.name === toolName);
      if (!toolToExecute) {
        throw new Error();
      }

      // Execute the tool (this is a placeholder and needs to be implemented based on the actual tool)
      let toolResult;
      try {
        // In a real scenario, you would dynamically call the appropriate function based on toolName
        // For this example, we'll simulate a successful execution
        console.log(, toolArgs);
        // Placeholder for actual tool execution logic
        toolResult = { success: true, data:  }; 
      } catch (error) {
        console.error(, error);
        throw new Error();
      }

      // Feed the result back to the model
      const finalResult = await this.model.generateContent({
        contents: [
          { parts: [{ text: prompt }] },
          { parts: [{ functionResponse: { name: toolName, response: toolResult } }] },
        ],
      });
      return finalResult.response.candidates?.[0]?.content?.parts?.[0]?.text;
    }

    return response.candidates?.[0]?.content?.parts?.[0]?.text;
  }
}
