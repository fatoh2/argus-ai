import { Module } from '@nestjs/common';
import { DeepSeekModule } from './deepseek/deepseek.module';
import { LlmService } from './llm.service';
import { LlmController } from './llm.controller';

@Module({ imports: [DeepSeekModule], controllers: [LlmController], providers: [LlmService], exports: [LlmService] })
export class LlmModule {}
