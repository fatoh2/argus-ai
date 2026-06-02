import { Injectable, ExecutionContext, Logger } from '@nestjs/common';
import { ThrottlerGuard, ThrottlerException, ThrottlerLimitDetail } from '@nestjs/throttler';
import { Request, Response } from 'express';
import * as crypto from 'crypto';

@Injectable()
export class ChatRateLimitGuard extends ThrottlerGuard {
  private readonly logger = new Logger(ChatRateLimitGuard.name);

  protected async throwThrottlingException(
    context: ExecutionContext,
    throttlerLimitDetail: ThrottlerLimitDetail,
  ): Promise<void> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();

    const forwarded = request.headers?.['x-forwarded-for'];
    const ip = (typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : request.ip) || 'unknown';
    const hashedIp = crypto.createHash('sha256').update(ip).digest('hex').slice(0, 16);

    this.logger.warn(
      `Rate limit hit — IP hash: ${hashedIp}, timeToExpire: ${throttlerLimitDetail.timeToExpire}ms`,
    );

    const retryAfter = Math.ceil(throttlerLimitDetail.timeToExpire / 1000);
    response.setHeader('Retry-After', retryAfter.toString());

    throw new ThrottlerException();
  }
}
