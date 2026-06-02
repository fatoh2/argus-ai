import { Module } from '@nestjs/common';
import { GeminiModule } from './gemini/gemini.module';
import { LlmService } from './llm.service';
import { LlmController } from './llm.controller';

@Module({
  imports: [GeminiModule],
  controllers: [LlmController],
  providers: [LlmService],
  exports: [LlmService],
})
export class LlmModule {}
