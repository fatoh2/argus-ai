import { Controller, Post, Body, BadRequestException, Logger } from '@nestjs/common';
import { ChatService } from './chat.service';
import { ChatDto } from './dto/chat.dto';

@Controller('chat')
export class ChatController {
  private readonly logger = new Logger(ChatController.name);

  constructor(private readonly chatService: ChatService) {}

  @Post()
  async chat(@Body() chatDto: ChatDto) {
    const rawLength = chatDto.message.length;

    // Log oversized inputs (length only, not content)
    if (rawLength > 4000) {
      this.logger.warn(`Oversized chat input rejected: length=${rawLength}`);
      throw new BadRequestException('Message exceeds maximum length of 4000 characters');
    }

    // Strip control characters and null bytes
    const sanitized = chatDto.message.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '').trim();

    if (!sanitized) {
      throw new BadRequestException('Message must not be empty');
    }

    return this.chatService.getAnswer(sanitized);
  }
}
