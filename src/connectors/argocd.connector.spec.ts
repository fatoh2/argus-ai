import { Test, TestingModule } from '@nestjs/testing';
import { ArgoCDConnector } from './argocd.connector';
import { ConfigService } from '@nestjs/config';

describe('ArgoCDConnector', () => {
  let connector: ArgoCDConnector;
  let configService: ConfigService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ArgoCDConnector,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue: string) => {
              if (key === 'argocd.url') return 'https://argocd.example.com';
              if (key === 'argocd.token') return 'test-token';
              return defaultValue;
            }),
          },
        },
      ],
    }).compile();

    connector = module.get<ArgoCDConnector>(ArgoCDConnector);
    configService = module.get<ConfigService>(ConfigService);
  });

  it('should be defined', () => {
    expect(connector).toBeDefined();
  });

  describe('isHealthy', () => {
    it('should return false when ArgoCD is unreachable', async () => {
      const result = await connector.isHealthy();
      expect(result).toBe(false);
    });
  });

  describe('getAppStatus', () => {
    it('should throw when app not found', async () => {
      jest.spyOn(connector as any, 'request').mockResolvedValue({
        statusCode: 404,
        body: JSON.stringify({ error: 'not found' }),
      });

      await expect(connector.getAppStatus('nonexistent')).rejects.toThrow();
    });

    it('should return formatted status for a valid app', async () => {
      jest.spyOn(connector as any, 'request').mockResolvedValue({
        statusCode: 200,
        body: JSON.stringify({
          metadata: { name: 'my-app', namespace: 'default' },
          status: {
            sync: { status: 'Synced', revision: 'abc123' },
            health: { status: 'Healthy' },
          },
        }),
      });

      const result = await connector.getAppStatus('my-app');
      expect(result.name).toBe('my-app');
      expect(result.syncStatus).toBe('Synced');
      expect(result.healthStatus).toBe('Healthy');
      expect(result.summary).toContain('my-app');
    });
  });

  describe('listApps', () => {
    it('should return empty array when no apps', async () => {
      jest.spyOn(connector as any, 'request').mockResolvedValue({
        statusCode: 200,
        body: JSON.stringify({ items: [] }),
      });

      const result = await connector.listApps();
      expect(result).toEqual([]);
    });

    it('should return formatted app statuses', async () => {
      jest.spyOn(connector as any, 'request').mockResolvedValue({
        statusCode: 200,
        body: JSON.stringify({
          items: [
            {
              metadata: { name: 'app-1', namespace: 'default' },
              status: {
                sync: { status: 'Synced' },
                health: { status: 'Healthy' },
              },
            },
            {
              metadata: { name: 'app-2', namespace: 'default' },
              status: {
                sync: { status: 'OutOfSync' },
                health: { status: 'Degraded' },
              },
            },
          ],
        }),
      });

      const apps = await connector.listApps();
      expect(apps).toHaveLength(2);
      expect(apps[0].syncStatus).toBe('Synced');
      expect(apps[1].syncStatus).toBe('OutOfSync');
    });
  });

  describe('getClusterSummary', () => {
    it('should return no-apps message when empty', async () => {
      jest.spyOn(connector, 'listApps').mockResolvedValue([]);

      const result = await connector.getClusterSummary();
      expect(result).toContain('No ArgoCD applications found');
    });

    it('should include unhealthy apps in summary', async () => {
      jest.spyOn(connector, 'listApps').mockResolvedValue([
        { name: 'app-1', namespace: 'default', syncStatus: 'Synced', healthStatus: 'Healthy', summary: '' },
        { name: 'app-2', namespace: 'default', syncStatus: 'OutOfSync', healthStatus: 'Degraded', summary: '' },
      ]);

      const result = await connector.getClusterSummary();
      expect(result).toContain('Total applications: 2');
      expect(result).toContain('app-2');
      expect(result).toContain('OutOfSync');
    });
  });
});
