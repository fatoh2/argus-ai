import { Test, TestingModule } from '@nestjs/testing';
import { HealthService } from './health.service';
import { KubernetesConnector } from './connectors/kubernetes.connector';
import { PrometheusConnector } from './connectors/prometheus/prometheus.connector';
import { LokiConnector } from './connectors/loki.connector';
import { ArgoCDConnector } from './connectors/argocd.connector';

describe('HealthService', () => {
  let service: HealthService;
  let kubernetes: { isHealthy: jest.Mock };
  let prometheus: { isHealthy: jest.Mock };
  let loki: { isHealthy: jest.Mock };
  let argocd: { isHealthy: jest.Mock };

  beforeEach(async () => {
    kubernetes = { isHealthy: jest.fn() };
    prometheus = { isHealthy: jest.fn() };
    loki = { isHealthy: jest.fn() };
    argocd = { isHealthy: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HealthService,
        { provide: KubernetesConnector, useValue: kubernetes },
        { provide: PrometheusConnector, useValue: prometheus },
        { provide: LokiConnector, useValue: loki },
        { provide: ArgoCDConnector, useValue: argocd },
      ],
    }).compile();

    service = module.get(HealthService);
  });

  it('reports ok when all connectors are healthy', async () => {
    kubernetes.isHealthy.mockResolvedValue(true);
    prometheus.isHealthy.mockResolvedValue(true);
    loki.isHealthy.mockResolvedValue(true);
    argocd.isHealthy.mockResolvedValue(true);

    await expect(service.check()).resolves.toMatchObject({
      status: 'ok',
      connectors: { kubernetes: true, prometheus: true, loki: true, argocd: true },
    });
  });

  it('reports degraded when some connectors are unhealthy', async () => {
    kubernetes.isHealthy.mockResolvedValue(true);
    prometheus.isHealthy.mockResolvedValue(false);
    loki.isHealthy.mockResolvedValue(true);
    argocd.isHealthy.mockResolvedValue(true);

    await expect(service.check()).resolves.toMatchObject({ status: 'degraded' });
  });

  it('reports unhealthy when all connectors are unhealthy', async () => {
    kubernetes.isHealthy.mockResolvedValue(false);
    prometheus.isHealthy.mockResolvedValue(false);
    loki.isHealthy.mockResolvedValue(false);
    argocd.isHealthy.mockResolvedValue(false);

    await expect(service.check()).resolves.toMatchObject({ status: 'unhealthy' });
  });

  it('marks thrown connector checks false without throwing', async () => {
    kubernetes.isHealthy.mockRejectedValue(new Error('cluster unavailable'));
    prometheus.isHealthy.mockResolvedValue(true);
    loki.isHealthy.mockResolvedValue(true);
    argocd.isHealthy.mockResolvedValue(true);

    await expect(service.check()).resolves.toMatchObject({
      status: 'degraded',
      connectors: { kubernetes: false, prometheus: true, loki: true, argocd: true },
    });
  });
});
