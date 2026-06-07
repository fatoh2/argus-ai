import { Injectable, Logger } from '@nestjs/common';
import { KubernetesConnector } from '../../connectors/kubernetes.connector';
import { PrometheusConnector } from '../../connectors/prometheus/prometheus.connector';
import { LokiConnector } from '../../connectors/loki.connector';
import { ArgoCDConnector } from '../../connectors/argocd.connector';

/** OpenAI/DeepSeek-compatible function-calling tool definition. */
export interface ToolSchema {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

/**
 * Central registry of LLM-callable tools.
 * Exposes JSON-schema definitions (for the model) and executes tool calls
 * by routing them to the read-only infrastructure connectors.
 */
@Injectable()
export class ToolRegistryService {
  private readonly logger = new Logger(ToolRegistryService.name);

  constructor(
    private readonly k8s: KubernetesConnector,
    private readonly prometheus: PrometheusConnector,
    private readonly loki: LokiConnector,
    private readonly argocd: ArgoCDConnector,
  ) {}

  /** Tool schemas advertised to the LLM. */
  getToolSchemas(): ToolSchema[] {
    return [
      {
        type: 'function',
        function: {
          name: 'list_pods',
          description:
            'List Kubernetes pods with their status, ready count, and restart count. ' +
            'Use this to answer questions about running pods or pod health.',
          parameters: {
            type: 'object',
            properties: {
              namespace: {
                type: 'string',
                description: 'Namespace to scope to. Omit to list pods across all namespaces.',
              },
            },
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'list_deployments',
          description:
            'List Kubernetes deployments with ready/available replica counts and container image. ' +
            'Use this to answer questions about deployments or their rollout status.',
          parameters: {
            type: 'object',
            properties: {
              namespace: {
                type: 'string',
                description: 'Namespace to scope to. Omit to list deployments across all namespaces.',
              },
            },
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'list_namespaces',
          description: 'List all namespaces in the Kubernetes cluster.',
          parameters: { type: 'object', properties: {} },
        },
      },
      {
        type: 'function',
        function: {
          name: 'get_pod_logs',
          description:
            'Fetch recent log lines from a specific pod. Use this to diagnose why a pod is failing or restarting.',
          parameters: {
            type: 'object',
            properties: {
              podName: { type: 'string', description: 'Name of the pod.' },
              namespace: { type: 'string', description: 'Namespace of the pod (default: default).' },
              tailLines: { type: 'number', description: 'Number of recent lines to fetch (default 50).' },
            },
            required: ['podName'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'list_argocd_apps',
          description:
            'List all ArgoCD applications with their sync status (Synced/OutOfSync) and health (Healthy/Degraded). ' +
            'Use for GitOps deployment questions.',
          parameters: { type: 'object', properties: {} },
        },
      },
      {
        type: 'function',
        function: {
          name: 'get_argocd_app',
          description: 'Get sync status, health, and revision for a single ArgoCD application by name.',
          parameters: {
            type: 'object',
            properties: { appName: { type: 'string', description: 'The ArgoCD application name.' } },
            required: ['appName'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'argocd_summary',
          description:
            'Get an overall ArgoCD summary: how many apps are synced vs out-of-sync and healthy vs unhealthy, ' +
            'with the problem apps listed. Use to answer "are my deployments in sync?".',
          parameters: { type: 'object', properties: {} },
        },
      },
      {
        type: 'function',
        function: {
          name: 'query_metrics',
          description:
            'Run an instant PromQL query against Prometheus and return the current value(s). ' +
            'Use for questions about CPU, memory, request rates, or any metric. ' +
            'Examples: "up", "rate(http_requests_total[5m])", "sum(container_memory_usage_bytes)".',
          parameters: {
            type: 'object',
            properties: {
              query: { type: 'string', description: 'A valid PromQL expression.' },
            },
            required: ['query'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'query_logs',
          description:
            'Query logs from Loki using a LogQL label selector over a time range. ' +
            'Use to inspect recent logs for a service or component.',
          parameters: {
            type: 'object',
            properties: {
              labelSelector: {
                type: 'string',
                description: 'LogQL label selector without braces, e.g. job="varlogs" or app="web".',
              },
              level: { type: 'string', description: 'Optional substring/level filter, e.g. "error".' },
              start: { type: 'string', description: 'Start time: ISO 8601 or relative like "1h", "30m".' },
              limit: { type: 'number', description: 'Max lines (default 100, capped at 500).' },
            },
            required: ['labelSelector'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'summarize_errors',
          description:
            'Summarize error-level logs from Loki over the last N hours, grouped by source and message. ' +
            'Use to answer "what errors happened recently?" or for incident triage.',
          parameters: {
            type: 'object',
            properties: {
              hours: { type: 'number', description: 'Look-back window in hours (default 1).' },
              labelSelector: {
                type: 'string',
                description: 'Optional LogQL label selector without braces to scope the search.',
              },
            },
          },
        },
      },
    ];
  }

  /** Execute a tool call by name and return a JSON string result for the LLM. */
  async executeTool(name: string, args: Record<string, any>): Promise<string> {
    this.logger.log(`tool call: ${name}(${JSON.stringify(args)})`);
    try {
      switch (name) {
        case 'list_pods':
          return JSON.stringify(await this.k8s.listPods(args.namespace));
        case 'list_deployments':
          return JSON.stringify(await this.k8s.listDeployments(args.namespace));
        case 'list_namespaces':
          return JSON.stringify(await this.k8s.listNamespaces());
        case 'get_pod_logs':
          return JSON.stringify({
            logs: await this.k8s.getPodLogs(args.podName, args.namespace, args.tailLines),
          });
        case 'query_metrics':
          return JSON.stringify(await this.prometheus.instantQuery(args.query));
        case 'query_logs':
          return JSON.stringify(
            await this.loki.queryLogs(args.labelSelector, args.start, undefined, args.level, args.limit ?? 100),
          );
        case 'summarize_errors':
          return JSON.stringify({
            summary: await this.loki.summarizeErrors(args.hours ?? 1, args.labelSelector ?? '{}'),
          });
        case 'list_argocd_apps':
          return JSON.stringify(await this.argocd.listApps());
        case 'get_argocd_app':
          return JSON.stringify(await this.argocd.getAppStatus(args.appName));
        case 'argocd_summary':
          return JSON.stringify({ summary: await this.argocd.getClusterSummary() });
        default:
          return JSON.stringify({ error: `Unknown tool: ${name}` });
      }
    } catch (e: any) {
      this.logger.error(`tool ${name} failed: ${e.message}`);
      return JSON.stringify({ error: `Tool ${name} failed: ${e.message}` });
    }
  }
}
