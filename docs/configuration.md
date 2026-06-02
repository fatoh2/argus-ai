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

2.  **Out-of-cluster (Recommended for Local Development)**: For local development, you can point Argus AI to an existing kubeconfig file.
    -   Set the `KUBECONFIG_PATH` environment variable or add it to your `config.yaml`.
    -   The path supports `~` expansion and environment variable references (e.g., `${HOME}/.kube/config`).

### Prometheus Connector Setup

1.  Ensure your Prometheus instance is accessible from where Argus AI is running.
2.  Set the `PROMETHEUS_URL` environment variable or add it to your `config.yaml`.
3.  If your Prometheus instance requires authentication, configure it via environment variables or your deployment's secret management system.

### Loki Connector Setup

1.  Ensure your Loki instance is accessible from where Argus AI is running.
2.  Set the `LOKI_URL` environment variable or add it to your `config.yaml`.
3.  If your Loki instance requires authentication, configure it via environment variables or your deployment's secret management system.

### ArgoCD Connector Setup

1.  Ensure your ArgoCD instance is accessible from where Argus AI is running.
2.  Generate an ArgoCD authentication token with appropriate read-only permissions.
3.  Set the `ARGOCD_URL` and `ARGOCD_AUTH_TOKEN` environment variables or add them to your `config.yaml`.

### GitHub Actions Connector Setup

1.  Generate a GitHub Personal Access Token (PAT) with the `workflow` scope.
2.  Set the `GITHUB_TOKEN` environment variable or add it to your `config.yaml`.

### Argus Monitor Connector Setup

1.  Ensure you have a running Argus Monitor instance with a PostgreSQL database.
2.  Set the `ARGUS_MONITOR_DB_URL` environment variable or add it to your `config.yaml`.
3.  The connector uses a read-only connection to query alerts and wallet activity.

## Error Handling and Resilience

Argus AI is designed to handle various operational challenges gracefully:

- **Invalid Configuration**: The application will fail to start if critical configuration (e.g., LLM API key) is missing.
- **Connector Failures**: All connectors implement graceful degradation. If a connector fails (e.g., Prometheus is unreachable), the LLM will inform the user that the service is unavailable and continue processing with available data.
- **LLM Timeouts**: The LLM service has a configurable hard timeout (`LLM_TIMEOUT_MS`, default 30s). If the LLM does not respond within this time, the request is aborted and a `504 Gateway Timeout` is returned.
- **LLM Retries**: On 5xx server errors, the LLM service will retry up to `LLM_MAX_RETRIES` (default 1) times before returning a `502 Bad Gateway`.
- **Prompt Truncation**: If the accumulated chat history exceeds `LLM_MAX_TOKENS` (default 50000), the oldest messages are truncated to keep the prompt within limits.
- **Rate Limiting**: The `/chat` endpoint is rate-limited to 20 requests per minute per IP. Rate-limit hits are logged with a hashed IP for monitoring.
- **Input Validation**: Messages are limited to 4000 characters. Control characters and null bytes are stripped. Empty messages return `400 Bad Request`.
