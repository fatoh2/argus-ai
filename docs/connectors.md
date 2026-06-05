# Connectors

Argus AI integrates with various infrastructure components to provide comprehensive insights. All connectors are read-only to ensure the safety and integrity of your systems.

For the architectural principles governing connectors, including graceful degradation, error handling, and logging, please refer to the [CLAUDE.md](../CLAUDE.md) document.

## Health Endpoint

The `GET /health` endpoint returns a simple health check:

```json
{
  "status": "ok"
}
```

The LLM has a separate dedicated health endpoint at `GET /health/llm` (served by `LlmController`), which returns latency tracking:

```json
{
  "ok": true,
  "latencyMs": 1234
}
```

## Kubernetes Connector

**Purpose**: Provides information about your Kubernetes cluster, including pod status, deployments, and events.

**How it works**: Connects to the Kubernetes API server using in-cluster service accounts or a provided kubeconfig file. It fetches data such as:

- Pod status and details
- Deployment and StatefulSet status
- Cluster events

All public methods are wrapped with `withConnectorErrorHandling('kubernetes', ...)` and accept the `AbortSignal` parameter for consistency, though the underlying `@kubernetes/client-node` library handles its own cancellation.

**Offline mode**: When the `KUBECONFIG` environment variable is not set, the connector operates in offline mode. `isHealthy()` returns `false` immediately (no network call), `listPods()` returns `[{ status: 'connector offline', reason: 'KUBECONFIG not configured' }]`, and other methods return empty/offline results. A warning is logged at startup. On API failure, `listPods()` also returns a structured offline status with the error message as the reason, instead of an empty array.

**Available methods**:
- `isHealthy()` — returns `false` immediately if `KUBECONFIG` not set; otherwise calls `listPods()` and returns `false` if any pod reports `connector offline` status
- `listPods(namespace)` — list pods in a namespace
- `getPodLogs(podName, namespace)` — get logs for a specific pod
- `describeDeployment(deploymentName, namespace)` — describe a deployment

**Configuration**:
```yaml
kubernetes:
  kubeconfig_path: "~/.kube/config"   # Omit for in-cluster
```

**Environment variable**: `KUBECONFIG` — path to kubeconfig file. If not set, the connector runs in offline mode (or uses in-cluster config when deployed inside a cluster).

**Example Questions**:
- "What is the status of pods with the label 'app=my-app' in the 'production' namespace?"
- "List all events in the 'staging' namespace from the last hour."

## Prometheus Connector

**Purpose**: Enables querying Prometheus for metrics and time-series data.

**How it works**: Executes PromQL queries against your Prometheus instance. It can retrieve historical and real-time metric data.

**Offline mode**: When the `PROMETHEUS_URL` environment variable is not set, the connector operates in offline mode. `isHealthy()` returns `false` immediately (no network call), and query methods return empty result sets. A warning is logged at startup.

**Available methods**:
- `isHealthy()` — returns `false` immediately if `PROMETHEUS_URL` not set; otherwise calls `instantQuery('up')` and returns `true` if the query succeeds
- `instantQuery(promql)` — execute an instant PromQL query
- `rangeQuery(promql, start, end, step)` — execute a range query over time

**Configuration**:
```yaml
prometheus:
  url: "http://localhost:9090"
```

**Environment variable**: `PROMETHEUS_URL` — URL of your Prometheus instance. If not set, the connector runs in offline mode.

**Example Questions**:
- "What is the average CPU utilization for the 'web-server' deployment over the last 24 hours?"
- "Show me the rate of HTTP 5xx errors from the 'api-gateway' service in the last 6 hours."

## K8sPrometheus Connector

**Purpose**: Convenience facade that delegates to both the Kubernetes and Prometheus connectors, wrapping all calls with graceful degradation.

**How it works**: All methods (`listPods`, `getPodLogs`, `describeDeployment`, `queryPrometheus`, `instantQueryPrometheus`, `rangeQueryPrometheus`) are wrapped with `withConnectorErrorHandling('k8s prometheus', ...)`. On failure, they return a `ConnectorErrorResult` instead of throwing. The factory functions accept `_signal` for API consistency with other connectors.

**Offline mode**: This connector inherits the offline behavior of its underlying connectors. If either `KUBECONFIG` or `PROMETHEUS_URL` is not set, the corresponding delegated methods return offline/empty results.

**Available methods**:
- `isHealthy()` — returns `true` if `listPods` succeeds (no `connector offline` status in results)
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

## Loki Connector

**Purpose**: Enables log aggregation, searching, and analysis — including error summarization across time ranges.

**How it works**: Executes LogQL queries against your Loki instance. It can retrieve log entries with labels and timestamps, and summarize error patterns across time ranges.

**Offline mode**: When the `LOKI_URL` environment variable is not set, the connector operates in offline mode. `isHealthy()` returns `false` immediately (no network call), `queryRange()` returns `{ status: 'connector offline', data: { result: [] } }`, and `summarizeErrors()` returns an offline message. A warning is logged at startup.

**Available methods**:
- `isHealthy()` — returns `false` immediately if `LOKI_URL` not set; otherwise health check against the Loki API
- `queryRange(options)` — execute a LogQL range query over a time range
- `summarizeErrors(hours, labelSelector)` — summarize error log patterns across a time range

**Configuration**:
```yaml
loki:
  url: "http://localhost:3100"
```

**Environment variable**: `LOKI_URL` — URL of your Loki instance. If not set, the connector runs in offline mode.

**Example Questions**:
- "Show me all error logs from the 'api-gateway' service in the last hour."
- "Summarize errors from the 'web-app' deployment in the last 6 hours."

## ArgoCD Connector

**Purpose**: Provides ArgoCD application sync status, health checks, and cluster-wide deployment summaries.

**How it works**: Connects to the ArgoCD API server to fetch application status, list applications, and generate cluster summaries.

**Offline mode**: When the `ARGOCD_URL` environment variable is not set, the connector operates in offline mode. `isHealthy()` returns `false` immediately (no network call), `getAppStatus()` returns an offline status object, `listApps()` returns an empty array, and `getClusterSummary()` returns an offline message. A warning is logged at startup.

**Available methods**:
- `isHealthy()` — returns `false` immediately if `ARGOCD_URL` not set; otherwise health check against the ArgoCD API
- `getAppStatus(appName)` — get sync and health status for a specific application
- `listApps()` — list all applications with their sync and health status
- `getClusterSummary()` — get a summary of all applications (healthy vs unhealthy)

**Configuration**:
```yaml
argocd:
  url: "https://argocd.example.com"
  token: "${ARGOCD_TOKEN}"
```

**Environment variables**:
- `ARGOCD_URL` — URL of your ArgoCD instance. If not set, the connector runs in offline mode.
- `ARGOCD_TOKEN` — ArgoCD authentication token.

**Example Questions**:
- "Is the 'payment-gateway' application synced and healthy in ArgoCD?"
- "Show me all out-of-sync applications in ArgoCD."
