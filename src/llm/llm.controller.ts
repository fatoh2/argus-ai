import { Controller, Get } from '@nestjs/common';
import { LlmService } from './llm.service';

@Controller('health')
export class LlmController {
  constructor(private readonly llmService: LlmService) {}

  @Get('llm')
  async checkLlmHealth(): Promise<{ ok: boolean; latencyMs: number }> {
    return this.llmService.checkHealth();
  }
}
