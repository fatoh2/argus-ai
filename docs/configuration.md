# Configuration

Argus AI uses **NestJS ConfigModule** (`@nestjs/config`) for configuration management. Settings are loaded from environment variables (highest priority) and `config.yaml` (defaults).

## Configuration Loading Order

1. **Environment variables** (highest priority) — set in your shell or a `.env` file
2. **`config.yaml`** — for non-sensitive defaults and connector endpoint URLs

The `ConfigModule` is registered globally in `app.module.ts`:

```typescript
ConfigModule.forRoot({
  isGlobal: true,
  envFilePath: '.env',
})
```

This means all services can inject `ConfigService` directly without importing `ConfigModule` in each feature module.

## Environment Variables

Argus AI uses environment variables for sensitive information and flexible configuration. It's highly recommended to use a `.env` file for local development or your deployment environment's secret management system (e.g., Kubernetes Secrets, AWS Secrets Manager) for production.

**Never commit `config.yaml` or `.env` files containing sensitive information to Git!**

Here's a list of environment variables used:

| Variable | Description | Required | Default |
|---|---|---|---|
| `DEEPSEEK_API_KEY` | DeepSeek V3 API key (primary LLM) | **Yes** | — |
| `DEEPSEEK_MODEL` | DeepSeek model override (optional) | No | `deepseek-chat` |
| `DEEPSEEK_URL` | DeepSeek API endpoint override (optional) | No | `https://api.deepseek.com/chat/completions` |
| `GEMINI_API_KEY` | Google Gemini API key (optional fallback) | No | — |
| `LLM_TIMEOUT_MS` | Hard timeout for LLM calls in milliseconds | No | `30000` |
| `LLM_MAX_TOKENS` | Maximum estimated tokens before oldest history is truncated | No | `50000` |
| `LLM_MAX_RETRIES` | Number of retry attempts on 5xx LLM server errors | No | `1` |
| `KUBECONFIG_PATH` | Path to your Kubernetes kubeconfig file | No | In-cluster config |
| `PROMETHEUS_URL` | URL of your Prometheus instance | No | `http://localhost:9090` |
| `LOKI_URL` | URL of your Loki instance | No | `http://localhost:3100` |
| `ARGOCD_URL` | URL of your ArgoCD instance | No | `https://localhost:8080` |
| `ARGOCD_AUTH_TOKEN` | Authentication token for ArgoCD | No | — |
| `GITHUB_TOKEN` | Personal Access Token (PAT) for GitHub, with `workflow` scope | No | — |
| `ARGUS_MONITOR_DB_URL` | Database connection string for the Argus Monitor (read-only replica) | No | — |

## LLM Configuration

The LLM service (`LlmService`) is configurable via environment variables:

| Variable | Description | Default |
|---|---|---|
| `LLM_TIMEOUT_MS` | Hard timeout for LLM calls in milliseconds | `30000` (30s) |
| `LLM_MAX_TOKENS` | Maximum estimated tokens before oldest history is truncated | `50000` |
| `LLM_MAX_RETRIES` | Number of retry attempts on 5xx server errors | `1` |

### LLM Error Handling

The LLM service maps errors to appropriate HTTP status codes:

| Condition | HTTP Status | Response Body |
|---|---|---|
| Timeout (exceeds `LLM_TIMEOUT_MS`) | `504 Gateway Timeout` | `{ statusCode: 504, message: "LLM request timed out", error: "Gateway Timeout" }` |
| Rate limit / quota exceeded | `429 Too Many Requests` | `{ statusCode: 429, message: "LLM rate limit exceeded", error: "Too Many Requests" }` |
| Auth failure (invalid API key) | `401 Unauthorized` | `{ statusCode: 401, message: "LLM authentication failed", error: "Unauthorized" }` |
| Server error (all retries exhausted) | `502 Bad Gateway` | `{ statusCode: 502, message: "LLM service unavailable after retries", error: "Bad Gateway" }` |
| Generic LLM error | `502 Bad Gateway` | `{ statusCode: 502, message: "LLM service error", error: "Bad Gateway" }` |

### Health Check

The `GET /health/llm` endpoint (in `LlmController`) returns:

```json
{
  "ok": true,
  "latencyMs": 1234
}
```

On failure, `ok` is `false` and `latencyMs` reflects the time until the health check timed out (10s internal timeout).

### Token Estimation

Token count is estimated using a simple heuristic: `Math.ceil(text.length / 4)`. This is a rough approximation for English text — not a precise tokenizer.

### Conversation Truncation

When the estimated token count exceeds `LLM_MAX_TOKENS`, the oldest messages in the conversation history are removed first, keeping the most recent context.

## Connector Setup

Detailed setup instructions for each connector.

### Kubernetes Connector Setup

The Kubernetes connector can operate in two modes:

1.  **In-cluster (Recommended for Production)**: When Argus AI is deployed inside a Kubernetes cluster, it will automatically use the service account credentials assigned to its pod.
    -   Ensure the service account has appropriate read-only permissions (e.g., `get`, `list`, `watch` for pods, deployments, events).
    -   **Do not set `KUBECONFIG_PATH`** in your `config.yaml` or environment variables if deploying in-cluster.

2.  **Out-of-cluster (Recommended for Local Development)**: For local development or when running outside a cluster, you can point Argus AI to a kubeconfig file.
    -   Set the `KUBECONFIG_PATH` environment variable to the path of your kubeconfig file (e.g., `~/.kube/config`).
    -   Ensure the context in your kubeconfig file is correctly configured to access your target cluster.

**Available Methods** (all wrapped with graceful degradation):

- `isHealthy()` — Health check
- `listPods(namespace)` — List pods in a namespace
- `getPodLogs(podName, namespace)` — Get logs for a specific pod
- `describeDeployment(deploymentName, namespace)` — Describe a deployment

### Prometheus Connector Setup

1.  **URL Configuration**: Set the `PROMETHEUS_URL` environment variable to the base URL of your Prometheus instance.
    -   Example: `PROMETHEUS_URL=http://localhost:9090`
    -   If Prometheus requires authentication, you will need to configure a reverse proxy or API gateway to handle authentication and forward requests to Prometheus, as Argus AI does not directly support Prometheus authentication.

### Loki Connector Setup

1.  **URL Configuration**: Set the `LOKI_URL` environment variable to the base URL of your Loki instance.
    -   Example: `LOKI_URL=http://localhost:3100`
    -   Similar to Prometheus, if Loki requires authentication, consider using a reverse proxy.

**Available Methods** (all wrapped with graceful degradation):

- `isHealthy()` — Health check
- `queryLogs(query, start, end)` — Query logs using LogQL
- `getLogStreams()` — List available log streams

### ArgoCD Connector Setup

1.  **URL and Token Configuration**: Set the `ARGOCD_URL` and `ARGOCD_AUTH_TOKEN` environment variables.
    -   Example: `ARGOCD_URL=https://argocd.example.com`
    -   The token must have read-only access to applications.

**Available Methods** (all wrapped with graceful degradation):

- `isHealthy()` — Health check
- `listApplications()` — List all ArgoCD applications
- `getApplicationStatus(appName)` — Get sync status and health for a specific application

### GitHub Actions Connector Setup

1.  **Token Configuration**: Set the `GITHUB_TOKEN` environment variable.
    -   The token must have the `workflow` scope to read workflow runs.

**Available Methods** (all wrapped with graceful degradation):

- `isHealthy()` — Health check
- `listWorkflowRuns(owner, repo)` — List recent workflow runs for a repository
- `getWorkflowRunDetails(owner, repo, runId)` — Get details for a specific workflow run

### Argus Monitor Connector Setup (Optional)

1.  **Database URL Configuration**: Set the `ARGUS_MONITOR_DB_URL` environment variable.
    -   This connects to a read-only replica of the Argus Monitor PostgreSQL database.
    -   The connector provides alerts and wallet activity data.

**Available Methods** (all wrapped with graceful degradation):

- `isHealthy()` — Health check
- `getRecentAlerts(limit)` — Get recent alerts from Argus Monitor
- `getWalletActivity(address, limit)` — Get recent wallet activity for a given address
