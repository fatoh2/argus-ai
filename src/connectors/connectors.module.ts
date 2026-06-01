import { Module } from '@nestjs/common';
import { K8sPrometheusConnector } from './k8s-prometheus.connector';

@Module({
  providers: [K8sPrometheusConnector],
  exports: [K8sPrometheusConnector],
})
export class ConnectorsModule {}
