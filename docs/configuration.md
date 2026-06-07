# Configuration

Argus AI uses **NestJS ConfigModule** (`@nestjs/config`) for configuration management. Settings are loaded from:

1. **Environment variables** (highest priority) — set in your shell or a `.env` file
2. **`config.yaml`** — for non-sensitive defaults and connector endpoint URLs

The `ConfigModule` is registered globally in `app.module.ts` with `isGlobal: true`, making `ConfigService` available to all modules without additional imports.

## Environment Variables

| Variable | Description | Required | Default |
|---|---|---|---|
| `DEEPSEEK_API_KEY` | DeepSeek V3 API key (primary LLM) | Yes | — |
| `GEMINI_API_KEY` | Google Gemini API key (optional fallback) | No | — |
| `KUBECONFIG` | Path to kubeconfig file for live Kubernetes queries | No | Offline mode |
| `LLM_TIMEOUT_MS` | Hard timeout for LLM calls in milliseconds | No | `30000` |
| `LLM_MAX_TOKENS` | Maximum estimated tokens before oldest history is truncated | No | `50000` |
| `LLM_MAX_RETRIES` | Number of retry attempts on 5xx LLM server errors | No | `1` |
| `PROMETHEUS_URL` | URL of your Prometheus instance | No | — |
| `LOKI_URL` | URL of your Loki instance | No | — |
| `ARGOCD_URL` | URL of your ArgoCD instance | No | — |
| `ARGOCD_TOKEN` | Authentication token for ArgoCD | No | — |
| `GITHUB_TOKEN` | Personal Access Token (PAT) for GitHub, with `workflow` scope | No | — |
| `ARGUS_MONITOR_DB_URL` | Database connection string for the Argus Monitor (read-only replica) | No | — |

> **Migration notes**:
> - `KUBECONFIG_PATH` was renamed to `KUBECONFIG`. The old name is still supported with a deprecation warning but will be removed in a future release. Please migrate to `KUBECONFIG`.
> - `ARGOCD_AUTH_TOKEN` was renamed to `ARGOCD_TOKEN`. The old name is still supported with a deprecation warning but will be removed in a future release. Please migrate to `ARGOCD_TOKEN`.
>
> **Note**: The Kubernetes connector uses `KUBECONFIG` (environment variable), not `kubeconfig_path` from `config.yaml`. This is because the kubeconfig path is typically different inside a Docker container vs. the host machine. When running via Docker Compose, set `KUBECONFIG=/kube/config` and mount your kubeconfig at `./.kube:/kube:ro`.

## LLM Configuration

The LLM service (`LlmService`) is configurable via environment variables:

| Variable | Description | Default |
|---|---|---|
| `LLM_TIMEOUT_MS` | Hard timeout for LLM calls in milliseconds | `30000` |
| `LLM_MAX_TOKENS` | Maximum estimated tokens before oldest history is truncated | `50000` |
| `LLM_MAX_RETRIES` | Number of retry attempts on 5xx LLM server errors | `1` |

## Connector Configuration

### Kubernetes Connector Setup

The Kubernetes connector uses the `@kubernetes/client-node` library and loads configuration from the `KUBECONFIG` environment variable.

1.  **In-cluster (Recommended for Production)**: When Argus AI is deployed inside a Kubernetes cluster, it will automatically use the service account credentials assigned to its pod.
    -   Ensure the service account has appropriate read-only permissions (e.g., `get`, `list`, `watch` for pods, deployments, events).
    -   **Do not set `KUBECONFIG`** in your environment variables if deploying in-cluster.

2.  **Out-of-cluster (Recommended for Local Development)**: For local development, you can point Argus AI to an existing kubeconfig file.
    -   Set the `KUBECONFIG` environment variable or add it to your `.env` file.
    -   The path supports `~` expansion and environment variable references (e.g., `${HOME}/.kube/config`).
    > **Deprecation note**: `KUBECONFIG_PATH` was renamed to `KUBECONFIG`. The old name is still supported with a deprecation warning but will be removed in a future release. Please migrate to `KUBECONFIG`.

**Setup steps**:

1. **Export your kubeconfig** to `./.kube/config`:
   ```bash
   mkdir -p .kube
   cp ~/.kube/config .kube/config
   ```

2. **Set `KUBECONFIG`** in `.env`:
   ```
   KUBECONFIG=/kube/config
   ```

3. **Run with Docker Compose** (the `docker-compose.yml` mounts `./.kube:/kube:ro` automatically):
   ```bash
   docker compose up -d
   ```

4. **Verify** the connector is healthy:
   ```bash
   curl -X POST http://localhost:3000/chat \
     -H "Content-Type: application/json" \
     -d '{"message": "What pods are running?"}'
   ```

**Available Methods** (all read-only, wrapped with graceful degradation):

- `isHealthy()` — Health check (lists namespaces)
- `listPods(namespace?)` — List pods (all namespaces or scoped)
- `listDeployments(namespace?)` — List deployments (all namespaces or scoped)
- `listNamespaces()` — List all namespaces
- `describeDeployment(name, namespace)` — Describe a deployment
- `getPodLogs(podName, namespace, tailLines?)` — Fetch pod logs

**Offline mode**: If `KUBECONFIG` is not set, the connector gracefully reports itself as offline and returns structured offline markers instead of crashing.

### Prometheus Connector Setup

1.  Ensure your Prometheus instance is accessible from where Argus AI is running.
2.  Set the `PROMETHEUS_URL` environment variable or add it to your `.env` file.
3.  If your Prometheus instance requires authentication, configure it via environment variables or your deployment's secret management system.

**Available Methods** (all wrapped with graceful degradation):

- `isHealthy()` — Health check
- `query(promql)` — Execute an instant PromQL query
- `queryRange(promql, start, end, step)` — Execute a range query over time
- `getAlerts()` — List active Prometheus alerts

### Loki Connector Setup

1.  Ensure your Loki instance is accessible from where Argus AI is running.
2.  Set the `LOKI_URL` environment variable or add it to your `.env` file.
3.  If your Loki instance requires authentication, configure it via environment variables or your deployment's secret management system.

**Available Methods** (all wrapped with graceful degradation):

- `isHealthy()` — Health check
- `queryLogs(labelSelector, start?, end?, level?, limit?)` — Query logs with a LogQL label selector, optional time range, level filter, and line limit (default 100, capped at 500)
- `queryRange(options)` — Execute a LogQL range query with full options (query, start, end, limit)
- `summarizeErrors(hours?, labelSelector?)` — Summarize error-level logs over the last N hours, grouped by source and message

### ArgoCD Connector Setup

1.  Ensure your ArgoCD instance is accessible from where Argus AI is running.
2.  Generate an ArgoCD authentication token with appropriate read-only permissions.
3.  Set the `ARGOCD_URL` and `ARGOCD_TOKEN` environment variables or add them to your `.env` file.

> **Deprecation note**: `ARGOCD_AUTH_TOKEN` was renamed to `ARGOCD_TOKEN`. The old name is still supported with a deprecation warning but will be removed in a future release. Please migrate to `ARGOCD_TOKEN`.

**Available Methods** (all wrapped with graceful degradation):

- `isHealthy()` — Health check
- `getAppStatus(appName)` — Get sync/health status for a specific application
- `listApps()` — List all applications with their status
- `getClusterSummary()` — Get a summary of all applications (healthy vs unhealthy)

### GitHub Actions Connector Setup

1.  Generate a GitHub Personal Access Token (PAT) with the `workflow` scope.
2.  Set the `GITHUB_TOKEN` environment variable or add it to your `.env` file.

### Argus Monitor Connector Setup

1.  Ensure your Argus Monitor PostgreSQL instance is accessible from where Argus AI is running.
2.  Set the `ARGUS_MONITOR_DB_URL` environment variable or add it to your `.env` file.
3.  The connector uses a read-only connection to query wallet balances, alerts, and transaction history.

**Available Methods** (all wrapped with graceful degradation):

- `isHealthy()` — Health check
- `getWalletBalance(address)` — Get the latest balance for a wallet address
- `getAlerts(hours?)` — Get recent alerts from the last N hours
- `getTransactions(address, limit?)` — Get recent transactions for a wallet address

## config.yaml

For non-sensitive defaults, you can use a `config.yaml` file:

```yaml
llm:
  timeoutMs: 30000
  maxTokens: 50000
  maxRetries: 1

connectors:
  kubernetes:
    kubeconfigPath: ~/.kube/config
  prometheus:
    url: http://localhost:9090
  loki:
    url: http://localhost:3100
  argocd:
    url: https://localhost:8080
    token: ""
```

> **Note**: Environment variables always take precedence over `config.yaml` values. Use `config.yaml` for sensible defaults and `.env` / environment variables for secrets and per-deployment overrides.
