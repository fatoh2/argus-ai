import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ChatModule } from './chat/chat.module';
import { ConnectorsModule } from './connectors/connectors.module';
import { LlmModule } from './llm/llm.module';

@Module({
  imports: [ChatModule, LlmModule, ConnectorsModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
