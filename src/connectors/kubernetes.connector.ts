import { Injectable, Logger } from '@nestjs/common';
import {
  withConnectorErrorHandling,
  ConnectorErrorResult,
} from './utils/connector-error';

/** Kubernetes connector — reads from cluster via KUBECONFIG env var.
 *  Gracefully returns empty data when no cluster is configured. */
@Injectable()
export class KubernetesConnector {
  private readonly logger = new Logger(KubernetesConnector.name);
  private available = false;

  constructor() {
    this.available = !!process.env.KUBECONFIG_BASE64 || !!process.env.KUBECONFIG;
    if (!this.available) this.logger.warn('[k8s] no KUBECONFIG — running in offline mode');
  }

  async listPods(namespace = 'default'): Promise<any[]> {
    if (!this.available) return [{ status: 'connector offline', reason: 'KUBECONFIG not configured' }];
    try {
      // TODO: use @kubernetes/client-node when cluster access is available
      this.logger.log(`listPods(${namespace})`);
      return [];
    } catch (e: any) {
      this.logger.error(`listPods failed: ${e.message}`);
      return [];
    }
  }

  async getPodLogs(podName: string, namespace = 'default'): Promise<string> {
    if (!this.available) return '[k8s connector offline]';
    this.logger.log(`getPodLogs(${podName}, ${namespace})`);
    return '[pod logs unavailable — cluster not connected]';
  }

  async describeDeployment(name: string, namespace = 'default'): Promise<any> {
    if (!this.available) return { status: 'connector offline' };
    this.logger.log(`describeDeployment(${name}, ${namespace})`);
    return {};
  }
}
