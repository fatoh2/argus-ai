import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ChatModule } from './chat/chat.module';
import { ConnectorsModule } from './connectors/connectors.module';
import { LlmModule } from './llm/llm.module';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    ChatModule,
    LlmModule,
    ConnectorsModule,
  ],
  controllers: [AppController, HealthController],
  providers: [AppService, HealthService],
})
export class AppModule {}
