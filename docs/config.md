# Configuration

Argus AI uses a `config.yaml` file for all its operational settings. This file defines how Argus AI connects to your various infrastructure components (Kubernetes, Prometheus, Loki, ArgoCD, GitHub Actions, Argus Monitor) and configures the underlying Large Language Model (LLM).

A `config.example.yaml` is provided in the root of the repository, which you should copy to `config.yaml` and modify.

```bash
cp config.example.yaml config.yaml
```

**Important Security Note:** Sensitive fields (like API keys and tokens) in `config.yaml` are designed to be populated via environment variables (e.g., `${GEMINI_API_KEY}`). **Never commit `config.yaml` to Git if it contains sensitive information!**

## Configuration Structure

The `config.yaml` is structured into several top-level sections, each corresponding to a specific component or connector.

### `gemini`

Configuration for the Google Gemini API.

-   `api_key`: Your Gemini API key. **Required.** Populated via environment variable (e.g., `${GEMINI_API_KEY}`).
-   `model`: The Gemini model to use (e.g., `gemini-1.5-flash`).

Example:

```yaml
gemini:
  api_key: "${GEMINI_API_KEY}"
  model: "gemini-1.5-flash"
```

### `kubernetes`

Configuration for the Kubernetes connector.

-   `kubeconfig_path`: Path to your kubeconfig file. Supports `~` expansion and environment variables (e.g., `${KUBECONFIG_PATH}`). If left empty, Argus AI will attempt to use in-cluster configuration (suitable when running inside a Kubernetes cluster).

Example:

```yaml
kubernetes:
  kubeconfig_path: "~/.kube/config"
```

### `prometheus`

Configuration for the Prometheus connector.

-   `url`: URL of your Prometheus instance (e.g., `http://localhost:9090`, `https://prometheus.example.com`).

Example:

```yaml
prometheus:
  url: "http://localhost:9090"
```

### `loki`

Configuration for the Loki connector.

-   `url`: URL of your Loki instance (e.g., `http://localhost:3100`, `https://loki.example.com`).

Example:

```yaml
loki:
  url: "http://localhost:3100"
```

### `argocd`

Configuration for the ArgoCD connector.

-   `url`: URL of your ArgoCD instance (e.g., `https://argocd.example.com`).
-   `token`: ArgoCD authentication token. **Required.** Populated via environment variable (e.g., `${ARGOCD_AUTH_TOKEN}`).

Example:

```yaml
argocd:
  url: "https://argocd.example.com"
  token: "${ARGOCD_AUTH_TOKEN}"
```

### `github_actions`

Configuration for the GitHub Actions connector.

-   `token`: GitHub Personal Access Token with `workflow` scope. **Required.** Populated via environment variable (e.g., `${GITHUB_TOKEN}`).

Example:

```yaml
github_actions:
  token: "${GITHUB_TOKEN}"
```

### `argus_monitor`

Configuration for the optional Argus Monitor connector.

-   `database_url`: The database URL for the Argus Monitor PostgreSQL instance. **Highly recommended to use an environment variable.**

Example:

```yaml
argus_monitor:
  database_url: "${ARGUS_MONITOR_DB_URL}"
```

## LLM Configuration

The LLM service (`LlmService`) is configurable via environment variables or the `LLM_SERVICE_OPTIONS` injection token:

> **Note**: The `/chat` endpoint is now wired to `LlmService` via `ChatService`. When you send a message to `/chat`, it calls `llmService.runToolUseLoop()` to generate a real AI response using Google Gemini. All LLM configuration options below (timeout, retries, token limits) apply to chat requests as well.

| Variable | Description | Default |
|---|---|---|
| `LLM_TIMEOUT_MS` | Hard timeout for LLM calls in milliseconds | `30000` (30s) |
| `LLM_MAX_PROMPT_TOKENS` | Maximum estimated tokens before oldest history is truncated | `50000` |
| `LLM_MAX_RETRIES` | Number of retry attempts on 5xx server errors | `1` |

### LLM Error Handling

The LLM service maps errors to appropriate HTTP status codes:

| Condition | HTTP Status | Response |
|---|---|---|
| Timeout (exceeds `LLM_TIMEOUT_MS`) | `504 Gateway Timeout` | `{ statusCode: 504, message: "LLM request timed out" }` |
| Rate limit / quota exceeded | `429 Too Many Requests` | `{ statusCode: 429, message: "LLM rate limit exceeded" }` |
| Auth failure (invalid API key) | `401 Unauthorized` | `{ statusCode: 401, message: "LLM authentication failed" }` |
| Server error (all retries exhausted) | `502 Bad Gateway` | `{ statusCode: 502, message: "LLM service unavailable after retries" }` |
| Generic LLM error | `502 Bad Gateway` | `{ statusCode: 502, message: "LLM service error" }` |

### Health Check

The `GET /health/llm` endpoint returns:

```json
{
  "ok": true,
  "latencyMs": 1234
}
```

On failure, `ok` is `false` and `latencyMs` reflects the time until the health check timed out (10s).

## Error Handling and Resilience

Argus AI is designed to handle various operational challenges gracefully:

- **Invalid Configuration**: The application will perform structural and format validation on connector configurations (e.g., URLs, paths, tokens). Syntactically incorrect YAML in `config.yaml` will result in an application startup error, prompting the user to correct the file.
- **Network Connectivity**: Temporary network failures to external connectors (Kubernetes API, Prometheus, Loki, etc.) are handled gracefully. All connector calls are wrapped with a **10-second timeout** (using AbortController to cancel the underlying HTTP request) via the shared `withConnectorErrorHandling()` utility. If a connector is unreachable, it returns a structured `ConnectorErrorResult` rather than crashing the application.
- **LLM Error Resilience**:
  - **30-second hard timeout** — LLM calls are aborted after 30 seconds, returning `504 Gateway Timeout`. Timeout errors are NOT retried.
  - **Automatic retry** — on 5xx server errors, the call is retried once (configurable via `LLM_MAX_RETRIES`) before returning `502 Bad Gateway`.
  - **Token limit guard** — prompts exceeding 50k estimated tokens truncate oldest history first.
  - **Safe logging** — the LLM service never logs full prompt or response content; all log output is sanitized via `sanitizeForLog()`.
- **Empty/Null/Large Responses**:
  - **Empty/Null Data**: If connectors return empty or null data for a query, Argus AI will process this gracefully, often resulting in a "no data found" response from the LLM.
  - **Large Data Volumes**: Strategies like pagination, sampling, and summarization are employed to manage extremely large responses from connectors (e.g., millions of log lines from Loki) to prevent memory exhaustion and ensure efficient LLM processing.

## See Also

For the full configuration reference including environment variables, see [Configuration Reference](configuration.md).
