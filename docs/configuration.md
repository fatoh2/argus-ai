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
| `DEEPSEEK_URL` | DeepSeek API endpoint | No | `https://api.deepseek.com/chat/completions` |
| `GEMINI_API_KEY` | Google Gemini API key (optional fallback — app boots fine without it) | No | — |
| `PORT` | HTTP server port | No | `3000` |
| `NODE_ENV` | Environment (development/production) | No | `development` |
| `LLM_TIMEOUT_MS` | Hard timeout for LLM calls in milliseconds | No | `30000` |
| `LLM_MAX_TOKENS` | Maximum estimated tokens before oldest history is truncated | No | `50000` |
| `LLM_MAX_RETRIES` | Number of retry attempts on 5xx LLM server errors | No | `1` |
| `REDIS_URL` | Redis connection string for queue/job processing | **Yes** | `redis://localhost:6379` |
| `PROMETHEUS_URL` | URL of your Prometheus instance | No | (empty — offline/stub mode) |
| `LOKI_URL` | URL of your Loki instance | No | (empty — offline/stub mode) |
| `ARGOCD_URL` | URL of your ArgoCD instance | No | (empty — offline/stub mode) |
| `ARGOCD_TOKEN` | Authentication token for ArgoCD | No | (empty — offline/stub mode) |
| `KUBECONFIG` | Path to your Kubernetes kubeconfig file | No | (empty — in-cluster config) |
| `GITHUB_TOKEN` | Personal Access Token (PAT) for GitHub, with `workflow` scope | No | — |
| `ARGUS_MONITOR_DB_URL` | Database connection string for the Argus Monitor (read-only replica) | No | — |

> **Note**: Connector URLs (`PROMETHEUS_URL`, `LOKI_URL`, `ARGOCD_URL`) default to empty strings. When left empty, the corresponding connectors operate in offline/stub mode and return structured errors instead of crashing. This allows the app to start and serve chat requests even when no infrastructure is connected.

## LLM Configuration

The LLM service (`LlmService`) is configurable via environment variables. The Gemini fallback is optional — if `GEMINI_API_KEY` is not set, the Gemini service marks itself unavailable at startup and the app boots normally using only DeepSeek.

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

The `GET /health` endpoint returns a simple health check:

```json
{
  "status": "ok"
}
```

### LLM Health Check

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
    -   **Do not set `KUBECONFIG`** in your environment variables if deploying in-cluster.

2.  **Out-of-cluster (Recommended for Local Development)**: For local development, you can point Argus AI to an existing kubeconfig file.
    -   Set the `KUBECONFIG` environment variable to the path of your kubeconfig file.
    -   The path supports `~` expansion and environment variable references (e.g., `${HOME}/.kube/config`).

3.  **Offline mode**: If `KUBECONFIG` is not set and the app is not running in-cluster, the connector operates in offline mode. `isHealthy()` returns `false` immediately (no network call), and all methods return empty/offline results. A warning is logged at startup.

**Available Methods** (all wrapped with graceful degradation):

- `isHealthy()` — Returns `false` immediately if `KUBECONFIG` not set; otherwise calls `listPods()` and returns `false` if any pod reports `connector offline` status
- `listPods(namespace)` — List pods in a namespace
- `getPodLogs(podName, namespace)` — Get logs for a specific pod
- `describeDeployment(deploymentName, namespace)` — Describe a deployment

### Prometheus Connector Setup

1.  Ensure your Prometheus instance is accessible from where Argus AI is running.
2.  Set the `PROMETHEUS_URL` environment variable or add it to your `config.yaml`.
3.  If your Prometheus instance requires authentication, configure it via environment variables or your deployment's secret management system.

4.  **Offline mode**: If `PROMETHEUS_URL` is not set, the connector operates in offline mode. `isHealthy()` returns `false` immediately (no network call), and query methods return empty result sets. A warning is logged at startup.

### Loki Connector Setup

1.  Ensure your Loki instance is accessible from where Argus AI is running.
2.  Set the `LOKI_URL` environment variable or add it to your `config.yaml`.
3.  If your Loki instance requires authentication, configure it via environment variables or your deployment's secret management system.

4.  **Offline mode**: If `LOKI_URL` is not set, the connector operates in offline mode. `isHealthy()` returns `false` immediately (no network call), `queryRange()` returns an offline result, and `summarizeErrors()` returns an offline message. A warning is logged at startup.

### ArgoCD Connector Setup

1.  Ensure your ArgoCD instance is accessible from where Argus AI is running.
2.  Set the `ARGOCD_URL` and `ARGOCD_TOKEN` environment variables or add them to your `config.yaml`.

3.  **Offline mode**: If `ARGOCD_URL` is not set, the connector operates in offline mode. `isHealthy()` returns `false` immediately (no network call), `getAppStatus()` returns an offline status object, `listApps()` returns an empty array, and `getClusterSummary()` returns an offline message. A warning is logged at startup.

### GitHub Actions Connector Setup

1.  Generate a GitHub Personal Access Token (PAT) with the `workflow` scope.
2.  Set the `GITHUB_TOKEN` environment variable or add it to your `config.yaml`.

### Argus Monitor Connector Setup

1.  Ensure you have a read-only replica of the Argus Monitor PostgreSQL database.
2.  Set the `ARGUS_MONITOR_DB_URL` environment variable or add it to your `config.yaml`.

## Redis Configuration

Redis is required for queue/job processing. The `docker-compose.yml` includes a Redis 7 service with healthcheck. When running outside Docker, set `REDIS_URL` to point to your Redis instance:

```bash
REDIS_URL=redis://localhost:6379
```

The app waits for Redis to be healthy before starting (when using Docker Compose). If Redis is unavailable, the app will fail to start.
