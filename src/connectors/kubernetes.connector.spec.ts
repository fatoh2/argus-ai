import { Test, TestingModule } from '@nestjs/testing';
import { KubernetesConnector } from './kubernetes.connector';
import { withConnectorErrorHandling, ConnectorErrorResult } from './utils/connector-error';

describe('KubernetesConnector', () => {
  let connector: KubernetesConnector;

  beforeEach(async () => {
    // Ensure KUBECONFIG is not set so connector runs in offline mode
    delete process.env.KUBECONFIG;

    const module: TestingModule = await Test.createTestingModule({
      providers: [KubernetesConnector],
    }).compile();

    connector = module.get<KubernetesConnector>(KubernetesConnector);
  });

  it('should be defined', () => {
    expect(connector).toBeDefined();
  });

  describe('isHealthy', () => {
    it('should return false when KUBECONFIG not set', async () => {
      const result = await connector.isHealthy();
      expect(result).toBe(false);
    });

    it('should return true when KUBECONFIG is set', async () => {
      process.env.KUBECONFIG = '/tmp/kubeconfig';
      const module: TestingModule = await Test.createTestingModule({
        providers: [KubernetesConnector],
      }).compile();
      const configuredConnector = module.get<KubernetesConnector>(KubernetesConnector);
      const result = await configuredConnector.isHealthy();
      expect(result).toBe(true);
      delete process.env.KUBECONFIG;
    });
  });

  describe('listPods', () => {
    it('should return offline status when KUBECONFIG not set', async () => {
      const result = await connector.listPods();
      expect(result).toEqual([
        { status: 'connector offline', reason: 'KUBECONFIG not configured' },
      ]);
    });

    it('should return structured error on timeout, does not throw', async () => {
      const result = await withConnectorErrorHandling(
        'kubernetes',
        async () => {
          await new Promise((resolve) => setTimeout(resolve, 500));
          return [];
        },
        10, // 10ms timeout — will trigger timeout
      );

      expect(result).toEqual<ConnectorErrorResult<any[]>>({
        error: 'kubernetes unavailable',
        data: null,
      });
    });

    it('should return structured error on failure, does not throw', async () => {
      const result = await withConnectorErrorHandling(
        'kubernetes',
        async () => {
          throw new Error('API server unreachable');
        },
      );

      expect(result).toEqual<ConnectorErrorResult<any[]>>({
        error: 'kubernetes unavailable',
        data: null,
      });
    });
  });


  describe('isHealthy', () => {
    it('should return true when listPods succeeds', async () => {
      jest.spyOn(connector, 'listPods').mockResolvedValue([]);
      const result = await connector.isHealthy();
      expect(result).toBe(true);
    });

    it('should return false when listPods returns structured offline status', async () => {
      jest.spyOn(connector, 'listPods').mockResolvedValue([
        { status: 'connector offline', reason: 'kubernetes unavailable' },
      ]);
      const result = await connector.isHealthy();
      expect(result).toBe(false);
    });
  });
});
