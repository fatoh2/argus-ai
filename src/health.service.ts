import { Injectable, Logger } from '@nestjs/common';
import { KubernetesConnector } from './connectors/kubernetes.connector';
import { PrometheusConnector } from './connectors/prometheus/prometheus.connector';
import { LokiConnector } from './connectors/loki.connector';
import { ArgoCDConnector } from './connectors/argocd.connector';

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);

  constructor(
    private readonly kubernetesConnector: KubernetesConnector,
    private readonly prometheusConnector: PrometheusConnector,
    private readonly lokiConnector: LokiConnector,
    private readonly argocdConnector: ArgoCDConnector,
  ) {}

  async check(): Promise<Record<string, any>> {
    const results: Record<string, any> = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      connectors: {},
    };

    // Check each connector — never throw, always report status
    try {
      results.connectors.kubernetes = await this.kubernetesConnector.isHealthy();
    } catch (e: any) {
      results.connectors.kubernetes = false;
      this.logger.error(`Health check kubernetes failed: ${e.message}`);
    }

    try {
      results.connectors.prometheus = await this.prometheusConnector.isHealthy();
    } catch (e: any) {
      results.connectors.prometheus = false;
      this.logger.error(`Health check prometheus failed: ${e.message}`);
    }

    try {
      results.connectors.loki = await this.lokiConnector.isHealthy();
    } catch (e: any) {
      results.connectors.loki = false;
      this.logger.error(`Health check loki failed: ${e.message}`);
    }

    try {
      results.connectors.argocd = await this.argocdConnector.isHealthy();
    } catch (e: any) {
      results.connectors.argocd = false;
      this.logger.error(`Health check argocd failed: ${e.message}`);
    }

    const connectorValues = Object.values(results.connectors) as boolean[];
    const allHealthy = connectorValues.every(Boolean);
    const anyHealthy = connectorValues.some(Boolean);
    results.status = allHealthy ? 'ok' : anyHealthy ? 'degraded' : 'unhealthy';

    return results;
  }
}
