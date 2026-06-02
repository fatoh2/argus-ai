import { Controller, Post, Body, HttpCode, HttpStatus, Get } from '@nestjs/common';
import { LlmService } from './llm.service';
import { ToolDeclaration } from '@google/generative-ai';

interface RunToolUseLoopDto {
  prompt: string;
  tools: ToolDeclaration[];
  conversationHistory?: { role: string; content: string }[];
}

@Controller('llm')
export class LlmController {
  constructor(private readonly llmService: LlmService) {}

  @Post('run-tool-use-loop')
  @HttpCode(HttpStatus.OK)
  async runToolUseLoop(@Body() dto: RunToolUseLoopDto): Promise<string> {
    return this.llmService.runToolUseLoop(
      dto.prompt,
      dto.tools,
      dto.conversationHistory,
    );
  }

  @Get('health/llm')
  async checkLlmHealth(): Promise<{ ok: boolean; latencyMs: number }> {
    return this.llmService.checkHealth();
  }
}
