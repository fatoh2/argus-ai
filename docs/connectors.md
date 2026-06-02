# Connectors

Argus AI integrates with various infrastructure components to provide comprehensive insights. All connectors are read-only to ensure the safety and integrity of your systems.

## Graceful Degradation

All connector methods use a shared error-handling utility that provides:

- **Timeout protection** — every connector call is wrapped with a 10-second timeout. If a connector hangs or is unreachable, it returns a structured error instead of blocking the request.
- **Structured error responses** — on failure, connectors return a `ConnectorErrorResult<T>` object with shape `{ error: string, data: null }` rather than throwing or returning empty defaults. The LLM context builder checks for this shape and inserts appropriate placeholders.
- **Sanitized logging** — error logs include the connector name, error type, and duration, but never API keys, tokens, or secrets. Any value matching common credential patterns is redacted automatically.
- **Health checks** — every connector implements `isHealthy(): Promise<boolean>` that returns `false` when the endpoint is unreachable, without crashing the application.

This means a single failing connector (e.g., Prometheus is down) will not break queries against other connectors. The LLM will see a clear "Prometheus unavailable" message and can still answer questions using Kubernetes, Loki, or other available sources.

## Kubernetes Connector

**Purpose**: Provides information about your Kubernetes cluster, including pod status, deployments, and events.

**How it works**: Connects to the Kubernetes API server using in-cluster service accounts or a provided kubeconfig file. It fetches data such as:

- Pod status and details
- Deployment and StatefulSet status
- Cluster events

**Available methods**:
- `isHealthy()` — health check against the Kubernetes API
- `getPodStatus(namespace, labelSelector)` — fetch pod details by namespace and label
- `getDeploymentStatus(namespace, name)` — fetch a specific deployment's status
- `getClusterEvents(namespace, hours)` — list recent cluster events

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

## Loki Connector

**Purpose**: Allows searching and analyzing logs stored in Loki.

**How it works**: Queries Loki using LogQL to retrieve log streams based on labels and time ranges. By default, queries are capped at 500 lines to prevent excessive data retrieval.

**Available methods**:
- `isHealthy()` — health check against Loki's `/ready` endpoint
- `queryRange(options)` — execute a LogQL range query with start/end time, limit, and direction
- `queryLogs(labelSelector, start?, end?, level?, limit?)` — convenience method for querying logs by label with optional level filtering
- `summarizeErrors(hours?, labelSelector?)` — aggregate error logs from the last N hours, grouped by source and message

**Key implementation details**:
- Time parsing supports ISO 8601 strings and relative formats (`1h`, `30m`, `15s`)
- Limit is capped at 500 lines maximum
- Timestamps are converted to nanosecond precision for Loki's API
- Default time range is the last 1 hour if not specified

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

**How it works**: Connects to the ArgoCD API to fetch the status of specified applications, including sync status and health. Authentication is supported via bearer token.

**Available methods**:
- `isHealthy()` — health check against ArgoCD's `/api/v1/session/userinfo` endpoint
- `getAppStatus(appName)` — fetch sync status, health status, and revision for a specific application
- `listApps()` — list all applications with their sync and health status
- `getClusterSummary()` — get a human-readable summary of all applications, highlighting out-of-sync and unhealthy apps

**Key implementation details**:
- Supports both HTTP and HTTPS (auto-detected from URL)
- Configurable via `argocd.url` and `argocd.token` environment variables
- Token is optional — if not provided, requests are made without authentication
- 10-second request timeout

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

1. Create the connector class in `src/connectors/` implementing the `Connector` interface.
2. Add a health check method `isHealthy(): Promise<boolean>`.
3. Use `ConfigService` for configuration (inject via constructor).
4. **Wrap all public methods with `withConnectorErrorHandling()`** from `./utils/connector-error` to ensure graceful degradation with timeout and structured error responses.
5. Register the connector in `src/connectors/connectors.module.ts` (add to `providers` and `exports`).
6. Update `config.example.yaml` with placeholder values.
7. Write unit tests with stubbed HTTP responses (see `loki.connector.spec.ts` and `argocd.connector.spec.ts` for examples).
8. Update this document with available methods and example questions.
9. **Escalate to PM**: New connectors always require PM review before merging due to security implications.
