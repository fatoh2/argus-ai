import { Test, TestingModule } from '@nestjs/testing';
import { LokiConnector } from './loki.connector';
import { ConfigService } from '@nestjs/config';

describe('LokiConnector', () => {
  let connector: LokiConnector;
  let configService: ConfigService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LokiConnector,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue: string) => {
              if (key === 'loki.url') return 'http://localhost:3100';
              return defaultValue;
            }),
          },
        },
      ],
    }).compile();

    connector = module.get<LokiConnector>(LokiConnector);
    configService = module.get<ConfigService>(ConfigService);
  });

  it('should be defined', () => {
    expect(connector).toBeDefined();
  });

  describe('isHealthy', () => {
    it('should return false when Loki is unreachable', async () => {
      const result = await connector.isHealthy();
      expect(result).toBe(false);
    });
  });

  describe('summarizeErrors', () => {
    it('should return a no-errors message when no errors found', async () => {
      // Mock the queryRange to return empty
      jest.spyOn(connector, 'queryRange').mockResolvedValue({
        status: 'success',
        data: { result: [] },
      });

      const result = await connector.summarizeErrors(1);
      expect(result).toContain('No error logs found');
    });

    it('should return a summary when errors are found', async () => {
      jest.spyOn(connector, 'queryRange').mockResolvedValue({
        status: 'success',
        data: {
          result: [
            {
              timestamp: '2024-01-01T00:00:00.000Z',
              line: 'ERROR: connection refused to database',
              labels: { app: 'api', env: 'production' },
            },
            {
              timestamp: '2024-01-01T00:01:00.000Z',
              line: 'ERROR: timeout exceeded for request',
              labels: { app: 'api', env: 'production' },
            },
          ],
        },
      });

      const result = await connector.summarizeErrors(1);
      expect(result).toContain('Found 2 error log entries');
      expect(result).toContain('api/production');
    });
  });

  describe('queryRange', () => {
    it('should cap limit at 500', async () => {
      jest.spyOn(connector as any, 'request').mockResolvedValue({
        statusCode: 200,
        body: JSON.stringify({ status: 'success', data: { result: [] } }),
      });

      const result = await connector.queryRange({ query: '{}', limit: 1000 });
      expect(result.status).toBe('success');
    });

    it('should throw on non-200 response', async () => {
      jest.spyOn(connector as any, 'request').mockResolvedValue({
        statusCode: 400,
        body: JSON.stringify({ message: 'bad query' }),
      });

      await expect(connector.queryRange({ query: '{invalid}' })).rejects.toThrow();
    });
  });
});
