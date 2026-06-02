import { Module } from '@nestjs/common';
import { KubernetesConnector } from './kubernetes.connector';
import { PrometheusConnector } from './prometheus/prometheus.connector';
import { K8sPrometheusConnector } from './k8s-prometheus.connector';
import { LokiConnector } from './loki.connector';
import { ArgoCDConnector } from './argocd.connector';

@Module({
  providers: [KubernetesConnector, PrometheusConnector, K8sPrometheusConnector, LokiConnector, ArgoCDConnector],
  exports: [KubernetesConnector, PrometheusConnector, K8sPrometheusConnector, LokiConnector, ArgoCDConnector],
})
export class ConnectorsModule {}
