import { Injectable } from '@nestjs/common';

@Injectable()
export class ChatService {
  async getAnswer(message: string): Promise<string> {
    // TODO: Integrate with AI model
    console.log('Received message:', message);
    return '';
  }
}
