import { Test, TestingModule } from '@nestjs/testing';
import { LlmController } from './llm.controller';
import { LlmService } from './llm.service';

describe('LlmController', () => {
  let controller: LlmController;
  let llmService: jest.Mocked<LlmService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [LlmController],
      providers: [
        {
          provide: LlmService,
          useValue: {
            checkHealth: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<LlmController>(LlmController);
    llmService = module.get(LlmService);
  });

  describe('GET /health/llm', () => {
    it('should return health status from LLM service', async () => {
      llmService.checkHealth.mockResolvedValue({ ok: true, latencyMs: 150 });

      const result = await controller.checkLlmHealth();
      expect(result).toEqual({ ok: true, latencyMs: 150 });
    });

    it('should return failure status when LLM is down', async () => {
      llmService.checkHealth.mockResolvedValue({ ok: false, latencyMs: 5000 });

      const result = await controller.checkLlmHealth();
      expect(result).toEqual({ ok: false, latencyMs: 5000 });
    });
  });
});
