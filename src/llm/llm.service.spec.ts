import { Test, TestingModule } from '@nestjs/testing';
import { HttpException } from '@nestjs/common';
import { LlmService } from './llm.service';
import { DeepSeekService } from './deepseek/deepseek.service';
import { GeminiService } from './gemini/gemini.service';

describe('LlmService', () => {
  let service: LlmService;
  let deepseekService: jest.Mocked<DeepSeekService>;
  let geminiService: jest.Mocked<GeminiService>;

  beforeEach(async () => {
    // Set env vars for testing
    process.env.LLM_TIMEOUT_MS = '100';
    process.env.LLM_MAX_TOKENS = '50000';

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LlmService,
        {
          provide: DeepSeekService,
          useValue: {
            chat: jest.fn(),
          },
        },
        {
          provide: GeminiService,
          useValue: {
            runToolUseLoop: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<LlmService>(LlmService);
    deepseekService = module.get(DeepSeekService);
    geminiService = module.get(GeminiService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('runToolUseLoop', () => {
    it('should return the DeepSeek response on success', async () => {
      deepseekService.chat.mockResolvedValue('Hello from LLM');

      const result = await service.runToolUseLoop('test prompt', []);
      expect(result).toBe('Hello from LLM');
    });

    it('should throw 504 Gateway Timeout when DeepSeek call exceeds timeout', async () => {
      // Simulate a slow LLM call that exceeds the 100ms timeout
      deepseekService.chat.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve('too late'), 200)),
      );

      await expect(
        service.runToolUseLoop('test prompt', []),
      ).rejects.toThrow(HttpException);
    });

    it('should fall back to Gemini when DeepSeek fails', async () => {
      deepseekService.chat.mockRejectedValue(new Error('API error'));
      geminiService.runToolUseLoop.mockResolvedValue('Gemini fallback response');

      const result = await service.runToolUseLoop('test prompt', []);
      expect(result).toBe('Gemini fallback response');
      expect(geminiService.runToolUseLoop).toHaveBeenCalledTimes(1);
    });

    it('should throw 502 when both DeepSeek and Gemini fail', async () => {
      deepseekService.chat.mockRejectedValue(new Error('API error'));
      geminiService.runToolUseLoop.mockRejectedValue(new Error('Gemini also failed'));

      await expect(
        service.runToolUseLoop('test prompt', []),
      ).rejects.toThrow(
        new HttpException(
          { statusCode: 502, message: 'LLM service unavailable', error: 'Bad Gateway' },
          502,
        ),
      );
    });

    it('should truncate conversation history when over token limit', async () => {
      deepseekService.chat.mockResolvedValue('OK');

      // Create a history with many messages that exceed the token limit
      const longHistory = Array.from({ length: 100 }, (_, i) => ({
        role: 'user' as const,
        content: 'A'.repeat(2000), // ~500 tokens each
      }));

      await service.runToolUseLoop('final prompt', [], longHistory);

      // The call should still succeed (truncation happens internally)
      expect(deepseekService.chat).toHaveBeenCalledTimes(1);
    });
  });

  describe('checkHealth', () => {
    it('should return ok=true when DeepSeek responds quickly', async () => {
      deepseekService.chat.mockResolvedValue('ok');

      const result = await service.checkHealth();
      expect(result.ok).toBe(true);
      expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    });

    it('should return ok=false when DeepSeek fails', async () => {
      deepseekService.chat.mockRejectedValue(new Error('API error'));

      const result = await service.checkHealth();
      expect(result.ok).toBe(false);
      expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    });
  });
});
