import { Module } from '@nestjs/common';
import { DeepSeekModule } from './deepseek/deepseek.module';
import { GeminiModule } from './gemini/gemini.module';
import { LlmService } from './llm.service';
import { LlmController } from './llm.controller';
import { ToolRegistryService } from './tools/tool-registry.service';
import { ConnectorsModule } from '../connectors/connectors.module';

@Module({
  imports: [DeepSeekModule, GeminiModule, ConnectorsModule],
  controllers: [LlmController],
  providers: [LlmService, ToolRegistryService],
  exports: [LlmService],
})
export class LlmModule {}
