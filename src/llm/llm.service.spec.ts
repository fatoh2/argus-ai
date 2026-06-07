import { Test, TestingModule } from '@nestjs/testing';
import { HttpException, HttpStatus } from '@nestjs/common';
import { LlmService } from './llm.service';
import { DeepSeekService } from './deepseek/deepseek.service';
import { GeminiService } from './gemini/gemini.service';

describe('LlmService', () => {
  let service: LlmService;
  let deepseekService: jest.Mocked<Pick<DeepSeekService, 'chat'>>;
  let geminiService: jest.Mocked<Pick<GeminiService, 'runToolUseLoop'>>;

  beforeEach(async () => {
    jest.useRealTimers();
    process.env.LLM_TIMEOUT_MS = '100';

    deepseekService = { chat: jest.fn() };
    geminiService = { runToolUseLoop: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LlmService,
        { provide: DeepSeekService, useValue: deepseekService },
        { provide: GeminiService, useValue: geminiService },
      ],
    }).compile();

    service = module.get<LlmService>(LlmService);
  });

  afterEach(() => {
    delete process.env.LLM_TIMEOUT_MS;
    jest.restoreAllMocks();
  });

  describe('runToolUseLoop', () => {
    it('returns the DeepSeek response on success', async () => {
      deepseekService.chat.mockResolvedValue('Hello from DeepSeek');

      const result = await service.runToolUseLoop('test prompt', []);

      expect(result).toBe('Hello from DeepSeek');
      expect(deepseekService.chat).toHaveBeenCalledWith('test prompt', []);
      expect(geminiService.runToolUseLoop).not.toHaveBeenCalled();
    });

    it('throws 504 Gateway Timeout when DeepSeek call exceeds timeout', async () => {
      deepseekService.chat.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve('too late'), 200)),
      );

      await expect(service.runToolUseLoop('test prompt', [])).rejects.toThrow(
        new HttpException(
          {
            statusCode: HttpStatus.GATEWAY_TIMEOUT,
            message: 'LLM request timed out',
            error: 'Gateway Timeout',
          },
          HttpStatus.GATEWAY_TIMEOUT,
        ),
      );
      expect(geminiService.runToolUseLoop).not.toHaveBeenCalled();
    });

    it('falls back to Gemini when DeepSeek fails', async () => {
      deepseekService.chat.mockRejectedValue(new Error('DeepSeek 500: Internal Server Error'));
      geminiService.runToolUseLoop.mockResolvedValue('Hello from Gemini');

      const result = await service.runToolUseLoop('test prompt', []);

      expect(result).toBe('Hello from Gemini');
      expect(geminiService.runToolUseLoop).toHaveBeenCalledWith('test prompt', []);
    });

    it('throws 502 when DeepSeek and Gemini both fail', async () => {
      deepseekService.chat.mockRejectedValue(new Error('DeepSeek 500: Internal Server Error'));
      geminiService.runToolUseLoop.mockRejectedValue(new Error('Gemini 500: Internal Server Error'));

      await expect(service.runToolUseLoop('test prompt', [])).rejects.toThrow(
        new HttpException(
          {
            statusCode: HttpStatus.BAD_GATEWAY,
            message: 'LLM service unavailable',
            error: 'Bad Gateway',
          },
          HttpStatus.BAD_GATEWAY,
        ),
      );
    });

    it('truncates conversation history before sending to DeepSeek', async () => {
      deepseekService.chat.mockResolvedValue('OK');
      process.env.LLM_MAX_TOKENS = '10';
      const freshModule = await Test.createTestingModule({
        providers: [
          LlmService,
          { provide: DeepSeekService, useValue: deepseekService },
          { provide: GeminiService, useValue: geminiService },
        ],
      }).compile();
      const freshService = freshModule.get<LlmService>(LlmService);
      const longHistory = Array.from({ length: 10 }, (_, i) => ({
        role: 'user' as const,
        content: `message-${i}-${'A'.repeat(2000)}`,
      }));

      await freshService.runToolUseLoop('final prompt', [], longHistory);

      const sentHistory = deepseekService.chat.mock.calls[0][1]!;
      expect(sentHistory.length).toBeLessThan(longHistory.length);
      delete process.env.LLM_MAX_TOKENS;
    });

    it('does not log full prompt or response content', async () => {
      const loggerSpy = jest.spyOn(service['logger'], 'log');
      deepseekService.chat.mockResolvedValue('sensitive response data');

      await service.runToolUseLoop('sensitive prompt with API_KEY_12345', []);

      for (const logCall of loggerSpy.mock.calls) {
        const logMessage = logCall[0];
        expect(logMessage).not.toContain('sensitive prompt');
        expect(logMessage).not.toContain('sensitive response');
        expect(logMessage).not.toContain('API_KEY_12345');
      }
    });
  });

  describe('checkHealth', () => {
    it('returns ok=true when DeepSeek responds quickly', async () => {
      deepseekService.chat.mockResolvedValue('ok');

      const result = await service.checkHealth();

      expect(result.ok).toBe(true);
      expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    });

    it('returns ok=false when DeepSeek fails', async () => {
      deepseekService.chat.mockRejectedValue(new Error('API error'));

      const result = await service.checkHealth();

      expect(result.ok).toBe(false);
      expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    });
  });
});
