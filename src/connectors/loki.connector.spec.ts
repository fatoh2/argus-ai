import { Test, TestingModule } from '@nestjs/testing';
import { LokiConnector } from './loki.connector';
import { ConfigService } from '@nestjs/config';

describe('LokiConnector', () => {
  let connector: LokiConnector;
  let configService: ConfigService;

  beforeEach(async () => {
    // Ensure LOKI_URL is not set so connector runs in offline mode
    delete process.env.LOKI_URL;

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
    it('should return false when LOKI_URL not set', async () => {
      const result = await connector.isHealthy();
      expect(result).toBe(false);
    });

    it('should return false when Loki is unreachable (LOKI_URL set)', async () => {
      process.env.LOKI_URL = 'http://loki:3100';
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          LokiConnector,
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn((key: string, defaultValue: string) => {
                if (key === 'loki.url') return 'http://loki:3100';
                return defaultValue;
              }),
            },
          },
        ],
      }).compile();
      const configuredConnector = module.get<LokiConnector>(LokiConnector);
      const result = await configuredConnector.isHealthy();
      expect(result).toBe(false);
      delete process.env.LOKI_URL;
    });
  });

  describe('queryRange', () => {
    it('should return offline status when LOKI_URL not set', async () => {
      const result = await connector.queryRange({ query: '{}' });
      expect(result.status).toBe('connector offline');
      expect(result.data.result).toEqual([]);
    });

    it('should cap limit at 500', async () => {
      process.env.LOKI_URL = 'http://loki:3100';
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          LokiConnector,
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn((key: string, defaultValue: string) => {
                if (key === 'loki.url') return 'http://loki:3100';
                return defaultValue;
              }),
            },
          },
        ],
      }).compile();
      const configuredConnector = module.get<LokiConnector>(LokiConnector);
      jest.spyOn(configuredConnector as any, 'request').mockResolvedValue({
        statusCode: 200,
        body: JSON.stringify({ status: 'success', data: { result: [] } }),
      });

      const result = await configuredConnector.queryRange({ query: '{}', limit: 1000 });
      expect(result.status).toBe('success');
      delete process.env.LOKI_URL;
    });

    it('should return error status on non-200 response instead of throwing', async () => {
      process.env.LOKI_URL = 'http://loki:3100';
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          LokiConnector,
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn((key: string, defaultValue: string) => {
                if (key === 'loki.url') return 'http://loki:3100';
                return defaultValue;
              }),
            },
          },
        ],
      }).compile();
      const configuredConnector = module.get<LokiConnector>(LokiConnector);
      jest.spyOn(configuredConnector as any, 'request').mockResolvedValue({
        statusCode: 400,
        body: JSON.stringify({ message: 'bad query' }),
      });

      const result = await configuredConnector.queryRange({ query: '{invalid}' });
      expect(result.status).toBe('error');
      expect(result.data.result).toEqual([]);
      delete process.env.LOKI_URL;
    });
  });

  describe('summarizeErrors', () => {
    it('should return offline message when LOKI_URL not set', async () => {
      const result = await connector.summarizeErrors(1);
      expect(result).toContain('Loki connector offline');
    });

    it('should return a no-errors message when no errors found', async () => {
      process.env.LOKI_URL = 'http://loki:3100';
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          LokiConnector,
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn((key: string, defaultValue: string) => {
                if (key === 'loki.url') return 'http://loki:3100';
                return defaultValue;
              }),
            },
          },
        ],
      }).compile();
      const configuredConnector = module.get<LokiConnector>(LokiConnector);
      // Mock the queryRange to return empty
      jest.spyOn(configuredConnector, 'queryRange').mockResolvedValue({
        status: 'success',
        data: { result: [] },
      });

      const result = await configuredConnector.summarizeErrors(1);
      expect(result).toContain('No error logs found');
      delete process.env.LOKI_URL;
    });

    it('should return a summary when errors are found', async () => {
      process.env.LOKI_URL = 'http://loki:3100';
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          LokiConnector,
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn((key: string, defaultValue: string) => {
                if (key === 'loki.url') return 'http://loki:3100';
                return defaultValue;
              }),
            },
          },
        ],
      }).compile();
      const configuredConnector = module.get<LokiConnector>(LokiConnector);
      jest.spyOn(configuredConnector, 'queryRange').mockResolvedValue({
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

      const result = await configuredConnector.summarizeErrors(1);
      expect(result).toContain('Found 2 error log entries');
      expect(result).toContain('api/production');
      delete process.env.LOKI_URL;
    });
  });
});
