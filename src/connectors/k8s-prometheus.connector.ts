import { Injectable } from '@nestjs/common';
import { KubernetesConnector } from './kubernetes.connector';
import { PrometheusConnector } from './prometheus/prometheus.connector';
import {
  withConnectorErrorHandling,
  ConnectorErrorResult,
} from './utils/connector-error';

@Injectable()
export class K8sPrometheusConnector {
  constructor(
    private readonly kubernetesConnector: KubernetesConnector,
    private readonly prometheusConnector: PrometheusConnector,
  ) {}

  // ---------------------------------------------------------------------------
  // Kubernetes Operations
  // ---------------------------------------------------------------------------

  async listPods(namespace: string = 'default'): Promise<any[] | ConnectorErrorResult<any[]>> {
    return withConnectorErrorHandling('k8s prometheus', (_signal) =>
      this.kubernetesConnector.listPods(namespace),
    );
  }

  async getPodLogs(podName: string, namespace: string = 'default'): Promise<string | ConnectorErrorResult<string>> {
    return withConnectorErrorHandling('k8s prometheus', (_signal) =>
      this.kubernetesConnector.getPodLogs(podName, namespace),
    );
  }

  async describeDeployment(deploymentName: string, namespace: string = 'default'): Promise<any | ConnectorErrorResult<any>> {
    return withConnectorErrorHandling('k8s prometheus', (_signal) =>
      this.kubernetesConnector.describeDeployment(deploymentName, namespace),
    );
  }

  // ---------------------------------------------------------------------------
  // Prometheus Operations
  // ---------------------------------------------------------------------------

  async queryPrometheus(query: string): Promise<any | ConnectorErrorResult<any>> {
    return withConnectorErrorHandling('k8s prometheus', (_signal) =>
      this.prometheusConnector.instantQuery(query),
    );
  }

  async instantQueryPrometheus(query: string): Promise<any | ConnectorErrorResult<any>> {
    return withConnectorErrorHandling('k8s prometheus', (_signal) =>
      this.prometheusConnector.instantQuery(query),
    );
  }

  async rangeQueryPrometheus(
    query: string,
    start: string,
    end: string,
    step: string = '1m',
  ): Promise<any | ConnectorErrorResult<any>> {
    return withConnectorErrorHandling('k8s prometheus', (_signal) =>
      this.prometheusConnector.rangeQuery(query, Number(start), Number(end), step),
    );
  }

  // ---------------------------------------------------------------------------
  // Health
  // ---------------------------------------------------------------------------

  async isHealthy(): Promise<boolean> {
    try {
      const result = await this.listPods();
      return !(result && typeof result === 'object' && 'error' in result);
    } catch {
      return false;
    }
  }
}
