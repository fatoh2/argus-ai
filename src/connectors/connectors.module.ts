import { Module } from '@nestjs/common';
import { K8sPrometheusConnector } from './k8s-prometheus.connector';
import { LokiConnector } from './loki.connector';
import { ArgoCDConnector } from './argocd.connector';

@Module({
  providers: [K8sPrometheusConnector, LokiConnector, ArgoCDConnector],
  exports: [K8sPrometheusConnector, LokiConnector, ArgoCDConnector],
})
export class ConnectorsModule {}
