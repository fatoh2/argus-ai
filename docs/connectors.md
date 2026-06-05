# Connectors

Argus AI integrates with various infrastructure components to provide comprehensive insights. All connectors are read-only to ensure the safety and integrity of your systems.

For the architectural principles governing connectors, including graceful degradation, error handling, and logging, please refer to the [CLAUDE.md](../CLAUDE.md) document.

## Kubernetes Connector

**Purpose**: Provides real-time information about your Kubernetes cluster, including pod status, deployments, namespaces, and pod logs.

**How it works**: Connects to the Kubernetes API server using a kubeconfig file specified via the `KUBECONFIG` environment variable. Uses the `@kubernetes/client-node` library for all API interactions. If `KUBECONFIG` is not set, the connector gracefully reports itself as offline.

**Available methods**:
- `isHealthy()` — health check against the Kubernetes API (lists namespaces)
- `listPods(namespace?)` — list pods in a namespace (or all namespaces if omitted), returns name, namespace, phase, ready count, restarts, and node
- `listDeployments(namespace?)` — list deployments in a namespace (or all namespaces if omitted), returns name, namespace, ready/available replicas, and container image
- `listNamespaces()` — list all namespaces with their status
- `describeDeployment(name, namespace)` — describe a single deployment: replica counts, conditions, container image
- `getPodLogs(podName, namespace, tailLines?)` — fetch recent log lines from a specific pod (default 50 lines)

**Configuration**:
The Kubernetes connector is configured via the `KUBECONFIG` environment variable (not via `config.yaml`). Set it to the path of your kubeconfig file inside the container:

```env
KUBECONFIG=/kube/config
```

When running via Docker Compose, mount your kubeconfig directory at `./.kube:/kube:ro` (the `docker-compose.yml` includes this mount by default). The `.kube/` directory is gitignored.

**Example Questions**:
- "What pods are running in my cluster?"
- "How many deployments are in the default namespace?"
- "What namespaces exist?"
- "Describe the nginx deployment"
- "Show me the logs for pod web-app-xyz in default"

## Tool Registry

The `ToolRegistryService` (at `src/llm/tools/tool-registry.service.ts`) is the central registry of LLM-callable tools. It serves two purposes:

1. **Schema definition**: Exposes OpenAI/DeepSeek-compatible function-calling schemas that tell the LLM what tools are available and how to call them.
2. **Tool execution**: Routes tool calls from the LLM to the appropriate connector methods.

Currently registered tools:

| Tool Name | Description | Connector Method |
|---|---|---|
| `list_pods` | List Kubernetes pods with status, ready count, and restarts | `KubernetesConnector.listPods()` |
| `list_deployments` | List deployments with ready/available replicas and image | `KubernetesConnector.listDeployments()` |
| `list_namespaces` | List all namespaces in the cluster | `KubernetesConnector.listNamespaces()` |
| `get_pod_logs` | Fetch recent log lines from a specific pod | `KubernetesConnector.getPodLogs()` |

To add a new tool, register a new schema in `getToolSchemas()` and add a case in `executeTool()`.

## Prometheus Connector

**Purpose**: Enables querying Prometheus for metrics and time-series data.

**How it works**: Executes PromQL queries against your Prometheus instance. It can retrieve historical and real-time metric data.

**Available methods**:
- `isHealthy()` — health check against the Prometheus API
- `query(promql)` — execute an instant PromQL query
- `queryRange(promql, start, end, step)` — execute a range query over time
- `getAlerts()` — list active Prometheus alerts

**Configuration**:
```yaml
prometheus:
  url: "http://localhost:9090"
```

**Example Questions**:
- "What is the average CPU utilization for the 'web-server' deployment over the last 24 hours?"
- "Show me the rate of HTTP 5xx errors from the 'api-gateway' service in the last 6 hours."

## K8sPrometheus Connector

**Purpose**: Convenience facade that delegates to both the Kubernetes and Prometheus connectors, wrapping all calls with graceful degradation.

**How it works**: All methods (`listPods`, `getPodLogs`, `describeDeployment`, `queryPrometheus`, `instantQueryPrometheus`, `rangeQueryPrometheus`) are wrapped with `withConnectorErrorHandling('k8s prometheus', ...)`. On failure, they return a `ConnectorErrorResult` instead of throwing. The factory functions accept `_signal` for API consistency with other connectors.

**Available methods**:
- `isHealthy()` — returns `true` if `listPods` succeeds
- `listPods(namespace)` — list pods via KubernetesConnector
- `getPodLogs(podName, namespace)` — get pod logs via KubernetesConnector
- `describeDeployment(deploymentName, namespace)` — describe a deployment via KubernetesConnector
- `queryPrometheus(query)` — execute a PromQL query via PrometheusConnector
- `instantQueryPrometheus(query)` — execute an instant PromQL query via PrometheusConnector
- `rangeQueryPrometheus(query, start, end, step)` — execute a range PromQL query via PrometheusConnector

**Configuration**: This connector uses the configurations of the underlying Kubernetes and Prometheus connectors.

**Example Questions**:
- "What is the CPU usage of the 'my-app' deployment in the 'production' namespace?"
- "Show me the logs for the 'nginx-ingress' pod in the 'kube-system' namespace."
