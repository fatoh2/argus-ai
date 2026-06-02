# Connectors

Argus AI integrates with various infrastructure components to provide comprehensive insights. All connectors are read-only to ensure the safety and integrity of your systems.

## Graceful Degradation

All connectors use a shared `withConnectorErrorHandling()` utility that provides:

- **10-second timeout** — if a connector call takes longer than 10 seconds, it returns a structured error instead of hanging
- **Structured error responses** — on failure, connectors return `{ error: "<name> unavailable", data: null }` instead of throwing exceptions
- **Safe logging** — error logs include the connector name, error type, and duration, but never API keys, tokens, or secrets (automatically redacted via regex)
- **Health checks** — every connector implements `isHealthy(): Promise<boolean>` that returns `false` when the connector is unreachable

This means the LLM always receives a predictable response shape and can gracefully handle unavailable services by informing the user rather than crashing.

### ConnectorErrorResult Type

```typescript
interface ConnectorErrorResult<T = null> {
  error: string;   // e.g. "loki unavailable"
  data: T;         // always null on failure
}
```

The LLM context builder checks for this shape to insert appropriate placeholders in its responses.

## Kubernetes Connector

**Purpose**: Provides information about your Kubernetes cluster, including pod status, deployments, and events.

**How it works**: Connects to the Kubernetes API server using in-cluster service accounts or a provided kubeconfig file. It fetches data such as:

- Pod status and details
- Deployment and StatefulSet status
- Cluster events

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

**How it works**: All methods (`listPods`, `getPodLogs`, `describeDeployment`, `queryPrometheus`, `instantQueryPrometheus`, `rangeQueryPrometheus`) are wrapped with `withConnectorErrorHandling('k8s prometheus', ...)`. On failure, they return a `ConnectorErrorResult` instead of throwing.

**Available methods**:
- `isHealthy()` — returns `true` if `listPods` succeeds
- `listPods(namespace)` — list pods via KubernetesConnector
- `getPodLogs(podName, namespace)` — get pod logs via KubernetesConnector
- `describeDeployment(deploymentName, namespace)` — describe a deployment via KubernetesConnector
- `queryPrometheus(query)` — execute a PromQL query via PrometheusConnector
- `instantQueryPrometheus(query)` — execute an instant PromQL query
- `rangeQueryPrometheus(query, start, end, step)` — execute a range query

## Loki Connector

**Purpose**: Allows searching and analyzing logs stored in Loki.

**How it works**: Queries Loki using LogQL to retrieve log streams based on labels and time ranges. By default, queries are capped at 500 lines to prevent excessive data retrieval. All methods are wrapped with `withConnectorErrorHandling('loki', ...)` for graceful degradation.

**Available methods**:
- `isHealthy()` — health check — returns `true` if `queryLogs` succeeds
- `queryLogs(query)` — execute a LogQL query
- `getServiceLogs(service, start, end, maxLines?)` — get logs for a specific service, capped at 500 lines by default

**Configuration**:
```yaml
loki:
  url: "http://localhost:3100"
```

**Example Questions**:
- "Find all error logs for the 'auth-service' in the last 30 minutes."
- "Show me logs from pods with the label 'component=database' that contain the word 'failed' in the 'production' namespace."
- "Summarize errors from the last 2 hours across all services."

## ArgoCD Connector

**Purpose**: Monitors the status of your ArgoCD applications.

**How it works**: Connects to the ArgoCD API to fetch the status of specified applications, including sync status and health. Authentication is supported via bearer token. All methods are wrapped with `withConnectorErrorHandling('argocd', ...)` for graceful degradation.

**Available methods**:
- `isHealthy()` — health check — returns `true` if `listApps` succeeds
- `getAppStatus(appName)` — fetch sync status, health status, and revision for a specific application
- `listApps()` — list all applications with their sync and health status

**Configuration**:
```yaml
argocd:
  url: "https://argocd.example.com"
  token: "${ARGOCD_AUTH_TOKEN}"
```

**Example Questions**:
- "What is the sync status of the 'my-app-frontend' ArgoCD application?"
- "Are all applications in the 'dev' namespace healthy?"
- "Give me a summary of all ArgoCD applications and their health."

## GitHub Actions Connector

**Purpose**: Retrieves information about GitHub Actions workflows and runs.

**How it works**: Interacts with the GitHub API to fetch details about workflow runs for a given repository and branch.

**Available methods**:
- `isHealthy()` — health check against the GitHub API
- `getWorkflowRun(owner, repo, workflowId, branch?)` — fetch the latest run for a workflow
- `listWorkflowRuns(owner, repo, workflowId, limit?)` — list recent workflow runs

**Configuration**:
```yaml
github_actions:
  token: "${GITHUB_TOKEN}"
```

**Example Questions**:
- "What was the status of the latest 'deploy' workflow run on the 'main' branch of the 'fatoh2/argus-ai' repository?"
- "List the last 5 workflow runs for the 'build' job in 'fatoh2/argus-monitor'."

## Argus Monitor Connector (Optional)

**Purpose**: Integrates with the Argus Monitor platform to fetch alerts and wallet activity.

**How it works**: Connects to the Argus Monitor database (read-only replica) to retrieve specific data points.

**Configuration**:
```yaml
argus_monitor:
  database_url: "${ARGUS_MONITOR_DB_URL}"
```

**Example Questions**:
- "Show me all alerts triggered in the last 24 hours for 'user-123'."
- "What is the recent wallet activity for '0xabc...def' in the last 12 hours?"

## Adding New Connectors

To add a new connector, follow the guidelines in [CLAUDE.md](../CLAUDE.md). Key steps:

1. Create the connector class in `src/connectors/` implementing the `Connector` interface
2. Use `ConfigService` for configuration (inject via constructor)
3. Add health check method `isHealthy(): Promise<boolean>`
4. **Wrap all public methods** with `withConnectorErrorHandling('<name>', ...)` from `./utils/connector-error` for graceful degradation
5. Register in `src/connectors/connectors.module.ts` (providers + exports)
6. Add to `config.example.yaml` with placeholder values
7. Write unit tests with stubbed HTTP responses (see `connector-error.spec.ts` for the error handling pattern)
8. Update this document with available methods and example questions
9. **Escalate to PM** — new connectors always require PM review before merging due to security implications
