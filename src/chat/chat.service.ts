import { Injectable } from "@nestjs/common";
import { LlmService } from "../llm/llm.service";

@Injectable()
export class ChatService {
  constructor(private readonly llmService: LlmService) {}

  async getAnswer(message: string, history: { role: string; content: string }[] = []): Promise<string> {
    return this.llmService.runToolUseLoop(message, [], history);
  }
}
