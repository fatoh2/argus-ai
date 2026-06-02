import { Module } from '@nestjs/common';
import { LlmService, LLM_SERVICE_OPTIONS } from './llm.service';
import { LlmController } from './llm.controller';
import { GeminiModule } from './gemini/gemini.module';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports: [GeminiModule, ConfigModule],
  controllers: [LlmController],
  providers: [
    LlmService,
    {
      provide: LLM_SERVICE_OPTIONS,
      useFactory: (configService: ConfigService) => ({
        timeoutMs: configService.get<number>('LLM_TIMEOUT_MS', 30_000),
        maxPromptTokens: configService.get<number>('LLM_MAX_PROMPT_TOKENS', 50_000),
        maxRetries: configService.get<number>('LLM_MAX_RETRIES', 1),
      }),
      inject: [ConfigService],
    },
  ],
  exports: [LlmService],
})
export class LlmModule {}
