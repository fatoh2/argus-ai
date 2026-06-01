
import { GeminiClient } from './gemini-client';
import { availableTools, executeTool } from './tools';

export class ToolUseLoopService {
  private geminiClient = new GeminiClient();

  async run(prompt: string): Promise<string> {
    let currentPrompt = prompt;
    let conversationHistory = [];

    // Limit the number of turns to prevent infinite loops
    for (let i = 0; i < 5; i++) { // Max 5 turns
      const response = await this.geminiClient.runGemini(currentPrompt);
      conversationHistory.push({ role: 'model', parts: response });

      // Check if the model wants to use a tool
      const toolCallMatch = response.match(/TOOL_CALL: (.*)/);
      if (toolCallMatch && toolCallMatch[1]) {
        const toolData = JSON.parse(toolCallMatch[1]);
        const toolName = toolData.name;
        const toolArgs = toolData.args;

        if (availableTools.some(tool => tool.name === toolName)) {
          try {
            const toolResult = executeTool(toolName, toolArgs);
            conversationHistory.push({ role: 'tool', parts: toolResult });
            currentPrompt = ;
          } catch (error) {
            conversationHistory.push({ role: 'tool_error', parts: error.message });
            currentPrompt = ;
          }
        } else {
          conversationHistory.push({ role: 'tool_error', parts:  });
          currentPrompt = ;
        }
      } else {
        // If no tool call, return the model's response
        return response;
      }
    }

    return 'Maximum number of turns reached. Could not complete the request.';
  }
}
