# Connectors

Argus AI integrates with various infrastructure components to provide comprehensive insights. All connectors are read-only to ensure the safety and integrity of your systems.

For the architectural principles governing connectors, including graceful degradation, error handling, and logging, please refer to the [CLAUDE.md](../CLAUDE.md) document.

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
| `query_metrics` | Run an instant PromQL query against Prometheus and return current values | `PrometheusConnector.instantQuery()` |
| `query_logs` | Query logs from Loki using a LogQL label selector over a time range | `LokiConnector.queryLogs()` |
| `summarize_errors` | Summarize error-level logs from Loki over the last N hours, grouped by source and message | `LokiConnector.summarizeErrors()` |
| `list_argocd_apps` | List all ArgoCD applications with sync status, health status, and target revision | `ArgoCDConnector.listApps()` |
| `get_argocd_app` | Get sync/health status and revision for a specific ArgoCD application | `ArgoCDConnector.getAppStatus()` |
| `argocd_summary` | Get a cluster-wide summary of ArgoCD applications (synced vs out-of-sync, healthy vs unhealthy) | `ArgoCDConnector.getClusterSummary()` |

To add a new tool, register a new schema in `getToolSchemas()` and add a case in `executeTool()`.

## Kubernetes Connector

**Purpose**: Provides real-time information about your Kubernetes cluster, including pod status, deployments, namespaces, and pod logs.

**How it works**: Connects to the Kubernetes API server using a kubeconfig file specified via the `KUBECONFIG` environment variable. Uses the `@kubernetes/client-node` library for all API interactions. If `KUBECONFIG` is not set, the connector gracefully reports itself as offline.

**Available methods** (all wrapped with graceful degradation):
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

> **Deprecation note**: `KUBECONFIG_PATH` was renamed to `KUBECONFIG`. The old name is still supported with a deprecation warning but will be removed in a future release. Please migrate to `KUBECONFIG`.

**Example Questions**:
- "What pods are running in my cluster?"
- "How many deployments are in the default namespace?"
- "What namespaces exist?"
- "Describe the nginx deployment"
- "Show me the logs for pod web-app-xyz in default"

## Prometheus Connector

**Purpose**: Enables querying Prometheus for metrics and time-series data.

**How it works**: Executes PromQL queries against your Prometheus instance. It can retrieve historical and real-time metric data.

**Available methods** (all wrapped with graceful degradation):
- `isHealthy()` — health check against the Prometheus API
- `query(promql)` — execute an instant PromQL query
- `queryRange(promql, start, end, step)` — execute a range query over time
- `getAlerts()` — list active Prometheus alerts

**Configuration**:
```yaml
prometheus:
  url: "http://localhost:9090"
```

**LLM-callable tool**: `query_metrics` — registered in `ToolRegistryService`. The LLM can call this tool with any valid PromQL expression.

**Example Questions**:
- "What is the average CPU utilization for the 'web-server' deployment over the last 24 hours?"
- "Show me the rate of HTTP 5xx errors from the 'api-gateway' service in the last 6 hours."
- "What's the current memory usage across all pods?"
- "Run a query: rate(http_requests_total[5m])"

## Loki Connector

**Purpose**: Enables querying Loki for log aggregation, searching, and analysis.

**How it works**: Executes LogQL queries against your Loki instance. It can retrieve recent logs and summarize error-level entries across time ranges.

**Available methods** (all wrapped with graceful degradation):
- `isHealthy()` — health check against the Loki API
- `queryLogs(labelSelector, start?, end?, level?, limit?)` — query logs with a LogQL label selector, optional time range, level filter, and line limit (default 100, capped at 500)
- `queryRange(options)` — execute a LogQL range query with full options (query, start, end, limit)
- `summarizeErrors(hours?, labelSelector?)` — summarize error-level logs over the last N hours, grouped by source and message

**Configuration**:
```yaml
loki:
  url: "http://localhost:3100"
```

**LLM-callable tools**: `query_logs` and `summarize_errors` — registered in `ToolRegistryService`.

**Example Questions**:
- "Show me all error logs from the 'api-gateway' service in the last hour."
- "Summarize errors from the last 2 hours."
- "What logs are available for the 'web-app' deployment?"

## ArgoCD Connector

**Purpose**: Enables querying ArgoCD for application sync status, health checks, and cluster-wide deployment summaries.

**How it works**: Connects to the ArgoCD API using the `ARGOCD_URL` and `ARGOCD_TOKEN` environment variables. All methods are wrapped with graceful degradation — if the environment variables are not set, the connector reports itself as offline.

**Available methods** (all wrapped with graceful degradation):
- `isHealthy()` — health check against the ArgoCD API
- `getAppStatus(appName)` — get sync/health status and revision for a specific application
- `listApps()` — list all applications with sync status, health status, and target revision
- `getClusterSummary()` — get a cluster-wide summary: synced vs out-of-sync, healthy vs unhealthy counts

**Configuration**:
```env
ARGOCD_URL=https://argocd.example.com
ARGOCD_TOKEN=your-argocd-token
```

> **Deprecation note**: `ARGOCD_AUTH_TOKEN` was renamed to `ARGOCD_TOKEN`. The old name is still supported with a deprecation warning but will be removed in a future release. Please migrate to `ARGOCD_TOKEN`.

**LLM-callable tools**: `list_argocd_apps`, `get_argocd_app`, `argocd_summary` — registered in `ToolRegistryService`.

**Example Questions**:
- "What ArgoCD applications are deployed?"
- "Show me the sync status of the guestbook application"
- "Give me a summary of all ArgoCD applications — how many are healthy?"

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
