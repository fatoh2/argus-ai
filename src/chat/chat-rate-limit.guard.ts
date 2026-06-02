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
    const { req, res } = this.getRequestResponse(context);
    const ip = this.getClientIp(req as unknown as Record<string, any>);
    const hashedIp = crypto.createHash('sha256').update(ip).digest('hex').slice(0, 16);

    // Log rate-limit hits with hashed IP and timestamp
    this.logger.warn(
      `Rate limit hit — IP hash: ${hashedIp}, timeToExpire: ${throttlerLimitDetail.timeToExpire}ms`,
    );

    // Set Retry-After header (in seconds)
    const response = res as unknown as Response;
    if (response && typeof response.setHeader === 'function') {
      const retryAfter = Math.ceil(throttlerLimitDetail.timeToExpire / 1000);
      response.setHeader('Retry-After', retryAfter.toString());
    }

    throw new ThrottlerException(this.errorMessage);
  }

  private getClientIp(req: Record<string, any>): string {
    const request = req as unknown as Request;
    const forwarded = request.headers?.['x-forwarded-for'];
    if (typeof forwarded === 'string') {
      return forwarded.split(',')[0].trim();
    }
    return request.ip || request.socket?.remoteAddress || 'unknown';
  }
}
