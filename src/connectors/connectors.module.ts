import { Module } from '@nestjs/common';
import { K8sPrometheusConnector } from './k8s-prometheus.connector';
import { KubernetesConnector } from './kubernetes.connector';
import { ArgoCDConnector } from './argocd.connector';
import { LokiConnector } from './loki.connector';

@Module({
  providers: [
    K8sPrometheusConnector,
    KubernetesConnector,
    ArgoCDConnector,
    LokiConnector,
  ],
  exports: [
    K8sPrometheusConnector,
    KubernetesConnector,
    ArgoCDConnector,
    LokiConnector,
  ],
})
export class ConnectorsModule {}
