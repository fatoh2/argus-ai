import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { ThrottlerModule } from "@nestjs/throttler";
import { ChatController } from "./chat.controller";
import { ChatService } from "./chat.service";
import { ChatRateLimitGuard } from "./chat-rate-limit.guard";
import { LlmModule } from "../llm/llm.module";

@Module({
  imports: [
    LlmModule,
    ThrottlerModule.forRoot([{
      name: "chat",
      limit: 20,
      ttl: 60000,
    }]),
  ],
  controllers: [ChatController],
  providers: [
    ChatService,
    {
      provide: APP_GUARD,
      useClass: ChatRateLimitGuard,
    },
  ],
})
export class ChatModule {}
