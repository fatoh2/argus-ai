import { Injectable, Logger } from '@nestjs/common';
import { KubernetesConnector } from '../../connectors/kubernetes.connector';

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

  constructor(private readonly k8s: KubernetesConnector) {}

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
        default:
          return JSON.stringify({ error: `Unknown tool: ${name}` });
      }
    } catch (e: any) {
      this.logger.error(`tool ${name} failed: ${e.message}`);
      return JSON.stringify({ error: `Tool ${name} failed: ${e.message}` });
    }
  }
}
