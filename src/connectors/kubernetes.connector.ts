import { Injectable, Logger } from '@nestjs/common';
import * as k8s from '@kubernetes/client-node';

/** Kubernetes connector — reads from the cluster via the KUBECONFIG env var.
 *  Gracefully degrades to an offline marker when no cluster is configured.
 *  Strictly read-only. */
@Injectable()
export class KubernetesConnector {
  private readonly logger = new Logger(KubernetesConnector.name);
  private available = false;
  private core?: k8s.CoreV1Api;
  private apps?: k8s.AppsV1Api;

  constructor() {
    // Backward compatibility: KUBECONFIG_PATH is deprecated in favour of
    // KUBECONFIG. If the old var is set and the new one isn't, use it and
    // emit a one-time warning.
    let kubeconfig = process.env.KUBECONFIG;
    if (!kubeconfig && process.env.KUBECONFIG_PATH) {
      this.logger.warn(
        '[k8s] KUBECONFIG_PATH is deprecated — rename to KUBECONFIG. ' +
        'Support for KUBECONFIG_PATH will be removed in a future release.',
      );
      kubeconfig = process.env.KUBECONFIG_PATH;
    }
    if (!kubeconfig) {
      this.logger.warn('[k8s] no KUBECONFIG — running in offline mode');
      return;
    }
    try {
      const kc = new k8s.KubeConfig();
      kc.loadFromFile(kubeconfig);
      this.core = kc.makeApiClient(k8s.CoreV1Api);
      this.apps = kc.makeApiClient(k8s.AppsV1Api);
      this.available = true;
      this.logger.log(`[k8s] connected using KUBECONFIG=${kubeconfig}`);
    } catch (e: any) {
      this.logger.error(`[k8s] failed to load KUBECONFIG: ${e.message}`);
    }
  }

  /** True if a cluster is configured and the API answers. */
  async isHealthy(): Promise<boolean> {
    if (!this.available || !this.core) return false;
    try {
      await this.core.listNamespace();
      return true;
    } catch {
      return false;
    }
  }

  /** List pods, optionally scoped to a namespace (defaults to all namespaces). */
  async listPods(namespace?: string): Promise<any[]> {
    if (!this.available || !this.core) {
      return [{ status: 'connector offline', reason: 'KUBECONFIG not configured' }];
    }
    try {
      const res = namespace
        ? await this.core.listNamespacedPod({ namespace })
        : await this.core.listPodForAllNamespaces();
      return res.items.map((p) => {
        const containers = p.status?.containerStatuses ?? [];
        const ready = containers.filter((c) => c.ready).length;
        const restarts = containers.reduce((s, c) => s + (c.restartCount ?? 0), 0);
        return {
          name: p.metadata?.name,
          namespace: p.metadata?.namespace,
          phase: p.status?.phase,
          ready: `${ready}/${containers.length}`,
          restarts,
          node: p.spec?.nodeName,
        };
      });
    } catch (e: any) {
      this.logger.error(`listPods failed: ${e.message}`);
      return [{ error: `Failed to list pods: ${e.message}` }];
    }
  }

  /** List deployments, optionally scoped to a namespace (defaults to all). */
  async listDeployments(namespace?: string): Promise<any[]> {
    if (!this.available || !this.apps) {
      return [{ status: 'connector offline', reason: 'KUBECONFIG not configured' }];
    }
    try {
      const res = namespace
        ? await this.apps.listNamespacedDeployment({ namespace })
        : await this.apps.listDeploymentForAllNamespaces();
      return res.items.map((d) => ({
        name: d.metadata?.name,
        namespace: d.metadata?.namespace,
        ready: `${d.status?.readyReplicas ?? 0}/${d.status?.replicas ?? 0}`,
        available: d.status?.availableReplicas ?? 0,
        image: d.spec?.template?.spec?.containers?.[0]?.image,
      }));
    } catch (e: any) {
      this.logger.error(`listDeployments failed: ${e.message}`);
      return [{ error: `Failed to list deployments: ${e.message}` }];
    }
  }

  /** List all namespaces in the cluster. */
  async listNamespaces(): Promise<any[]> {
    if (!this.available || !this.core) {
      return [{ status: 'connector offline', reason: 'KUBECONFIG not configured' }];
    }
    try {
      const res = await this.core.listNamespace();
      return res.items.map((n) => ({
        name: n.metadata?.name,
        status: n.status?.phase,
      }));
    } catch (e: any) {
      this.logger.error(`listNamespaces failed: ${e.message}`);
      return [{ error: `Failed to list namespaces: ${e.message}` }];
    }
  }

  /** Describe a single deployment: replica counts, image, conditions. */
  async describeDeployment(name: string, namespace = 'default'): Promise<any> {
    if (!this.available || !this.apps) return { status: 'connector offline' };
    try {
      const d = await this.apps.readNamespacedDeployment({ name, namespace });
      return {
        name: d.metadata?.name,
        namespace: d.metadata?.namespace,
        replicas: d.spec?.replicas,
        ready: d.status?.readyReplicas ?? 0,
        available: d.status?.availableReplicas ?? 0,
        updated: d.status?.updatedReplicas ?? 0,
        image: d.spec?.template?.spec?.containers?.[0]?.image,
        conditions: (d.status?.conditions ?? []).map((c) => ({
          type: c.type,
          status: c.status,
          reason: c.reason,
        })),
      };
    } catch (e: any) {
      this.logger.error(`describeDeployment failed: ${e.message}`);
      return { error: `Failed to describe deployment ${name}: ${e.message}` };
    }
  }

  /** Recent log lines from a pod (tail, read-only). */
  async getPodLogs(podName: string, namespace = 'default', tailLines = 50): Promise<string> {
    if (!this.available || !this.core) return '[k8s connector offline — KUBECONFIG not configured]';
    try {
      const res = await this.core.readNamespacedPodLog({ name: podName, namespace, tailLines });
      return (res as unknown as string) || '[no logs]';
    } catch (e: any) {
      this.logger.error(`getPodLogs failed: ${e.message}`);
      return `[failed to read logs for ${podName}: ${e.message}]`;
    }
  }
}
