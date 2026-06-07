# Connectors

Argus AI integrates with various infrastructure components to provide comprehensive insights. All connectors are read-only to ensure the safety and integrity of your systems.

For the architectural principles governing connectors, including graceful degradation, error handling, and logging, please refer to the [CLAUDE.md](../CLAUDE.md) document.

## Kubernetes Connector

**Purpose**: Provides information about your Kubernetes cluster, including pod status, deployments, and events.

**How it works**: Connects to the Kubernetes API server using in-cluster service accounts or a provided kubeconfig file. It fetches data such as:

- Pod status and details
- Deployment and StatefulSet status
- Cluster events

All public methods are wrapped with `withConnectorErrorHandling('kubernetes', ...)` and accept the `AbortSignal` parameter for consistency, though the underlying `@kubernetes/client-node` library handles its own cancellation.

**Available methods**:
- `isHealthy()` — health check against the Kubernetes API
- `listPods(namespace)` — list pods in a namespace
- `getPodLogs(podName, namespace)` — get logs for a specific pod
- `describeDeployment(deploymentName, namespace)` — describe a deployment

**Configuration**:
```yaml
kubernetes:
  kubeconfig_path: "~/.kube/config"   # Omit for in-cluster
```

**Example Questions**:
- "What is the status of pods with the label 'app=my-app' in the 'production' namespace?"
- "List all events in the 'staging' namespace from the last hour."

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
