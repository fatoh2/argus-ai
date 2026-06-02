import { Test, TestingModule } from '@nestjs/testing';
import { HttpException, HttpStatus } from '@nestjs/common';
import { LlmService, LLM_SERVICE_OPTIONS } from './llm.service';
import { GeminiService } from './gemini/gemini.service';

describe('LlmService', () => {
  let service: LlmService;
  let geminiService: jest.Mocked<GeminiService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LlmService,
        {
          provide: GeminiService,
          useValue: {
            runToolUseLoop: jest.fn(),
          },
        },
        {
          provide: LLM_SERVICE_OPTIONS,
          useValue: { timeoutMs: 100, maxPromptTokens: 50_000, maxRetries: 1 },
        },
      ],
    }).compile();

    service = module.get<LlmService>(LlmService);
    geminiService = module.get(GeminiService);
  });

  describe('runToolUseLoop', () => {
    it('should return the LLM response on success', async () => {
      geminiService.runToolUseLoop.mockResolvedValue('Hello from LLM');

      const result = await service.runToolUseLoop('test prompt', []);
      expect(result).toBe('Hello from LLM');
    });

    it('should throw 504 Gateway Timeout when LLM call exceeds timeout', async () => {
      // Simulate a slow LLM call that exceeds the 100ms timeout
      geminiService.runToolUseLoop.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve('too late'), 200)),
      );

      await expect(
        service.runToolUseLoop('test prompt', []),
      ).rejects.toThrow(
        new HttpException(
          {
            statusCode: HttpStatus.GATEWAY_TIMEOUT,
            message: 'LLM request timed out',
            error: 'Gateway Timeout',
          },
          HttpStatus.GATEWAY_TIMEOUT,
        ),
      );
    });

    it('should retry once on 5xx error then fail with 502', async () => {
      geminiService.runToolUseLoop
        .mockRejectedValueOnce(new Error('Internal Server Error'))
        .mockRejectedValueOnce(new Error('Internal Server Error'));

      await expect(
        service.runToolUseLoop('test prompt', []),
      ).rejects.toThrow(
        new HttpException(
          {
            statusCode: HttpStatus.BAD_GATEWAY,
            message: 'LLM service unavailable after retries',
            error: 'Bad Gateway',
          },
          HttpStatus.BAD_GATEWAY,
        ),
      );

      expect(geminiService.runToolUseLoop).toHaveBeenCalledTimes(2);
    });

    it('should succeed on retry after first 5xx failure', async () => {
      geminiService.runToolUseLoop
        .mockRejectedValueOnce(new Error('Internal Server Error'))
        .mockResolvedValueOnce('Success after retry');

      const result = await service.runToolUseLoop('test prompt', []);
      expect(result).toBe('Success after retry');
      expect(geminiService.runToolUseLoop).toHaveBeenCalledTimes(2);
    });

    it('should NOT retry on 4xx errors', async () => {
      geminiService.runToolUseLoop.mockRejectedValue(
        new Error('429 rate limit exceeded'),
      );

      await expect(
        service.runToolUseLoop('test prompt', []),
      ).rejects.toThrow(
        new HttpException(
          {
            statusCode: HttpStatus.TOO_MANY_REQUESTS,
            message: 'LLM rate limit exceeded',
            error: 'Too Many Requests',
          },
          HttpStatus.TOO_MANY_REQUESTS,
        ),
      );

      expect(geminiService.runToolUseLoop).toHaveBeenCalledTimes(1);
    });

    it('should truncate conversation history when over token limit', async () => {
      geminiService.runToolUseLoop.mockResolvedValue('OK');

      // Create a history with many messages that exceed the token limit
      const longHistory = Array.from({ length: 100 }, (_, i) => ({
        role: 'user' as const,
        content: 'A'.repeat(2000), // ~500 tokens each
      }));

      await service.runToolUseLoop('final prompt', [], longHistory);

      // The call should still succeed (truncation happens internally)
      expect(geminiService.runToolUseLoop).toHaveBeenCalledTimes(1);
    });

    it('should not log full prompt or response content', async () => {
      const loggerSpy = jest.spyOn(service['logger'], 'log');
      geminiService.runToolUseLoop.mockResolvedValue('sensitive response data');

      await service.runToolUseLoop('sensitive prompt with API_KEY_12345', []);

      // Check that log messages don't contain the actual content
      for (const logCall of loggerSpy.mock.calls) {
        const logMessage = logCall[0];
        expect(logMessage).not.toContain('sensitive prompt');
        expect(logMessage).not.toContain('sensitive response');
        expect(logMessage).not.toContain('API_KEY_12345');
      }
    });
  });

  describe('checkHealth', () => {
    it('should return ok=true when LLM responds quickly', async () => {
      geminiService.runToolUseLoop.mockResolvedValue('ok');

      const result = await service.checkHealth();
      expect(result.ok).toBe(true);
      expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    });

    it('should return ok=false when LLM fails', async () => {
      geminiService.runToolUseLoop.mockRejectedValue(new Error('API error'));

      const result = await service.checkHealth();
      expect(result.ok).toBe(false);
      expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    });
  });
});
