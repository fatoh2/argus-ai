import { Test, TestingModule } from '@nestjs/testing';
import { KubernetesConnector } from './kubernetes.connector';
import { withConnectorErrorHandling, ConnectorErrorResult } from './utils/connector-error';

describe('KubernetesConnector', () => {
  let connector: KubernetesConnector;

  beforeEach(async () => {
    // Ensure KUBECONFIG is not set so connector runs in offline mode
    delete process.env.KUBECONFIG;
    delete process.env.KUBECONFIG_BASE64;

    const module: TestingModule = await Test.createTestingModule({
      providers: [KubernetesConnector],
    }).compile();

    connector = module.get<KubernetesConnector>(KubernetesConnector);
  });

  it('should be defined', () => {
    expect(connector).toBeDefined();
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
});
