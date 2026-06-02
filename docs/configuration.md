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
| `GEMINI_API_KEY` | Your API key for the Google Gemini API | **Yes** | — |
| `KUBECONFIG_PATH` | Path to your Kubernetes kubeconfig file | No | In-cluster config |
| `PROMETHEUS_URL` | URL of your Prometheus instance | No | `http://localhost:9090` |
| `LOKI_URL` | URL of your Loki instance | No | `http://localhost:3100` |
| `ARGOCD_URL` | URL of your ArgoCD instance | No | `https://localhost:8080` |
| `ARGOCD_AUTH_TOKEN` | Authentication token for ArgoCD | No | — |
| `GITHUB_TOKEN` | GitHub Personal Access Token with `workflow` scope | No | — |
| `ARGUS_MONITOR_DB_URL` | Database URL for the Argus Monitor PostgreSQL instance | No | — |

## LLM Service Options

The `LlmService` supports configurable options via the `LLM_SERVICE_OPTIONS` injection token. These can be provided when registering the module or in tests:

| Option | Description | Default |
|---|---|---|
| `timeoutMs` | Hard timeout for LLM API calls (ms) | `30000` (30s) |
| `maxPromptTokens` | Maximum estimated token count before truncation | `50000` |
| `maxRetries` | Number of retry attempts on 5xx server errors | `1` |

### Default Behavior

- **Timeout**: LLM calls exceeding 30 seconds return `504 Gateway Timeout` to the client. Timeout errors are **not** retried.
- **Retry**: On 5xx server errors (Internal Server Error, Service Unavailable), the call is retried once. If both attempts fail, the client receives `502 Bad Gateway`.
- **Token Guard**: Prompts exceeding 50,000 estimated tokens are truncated by removing the oldest conversation history first. This prevents context overflow and excessive API costs.
- **Safe Logging**: The LLM service never logs full prompt or response content. Log output is sanitized to redact API keys, tokens, and secrets.

## Connector Configuration

Each connector reads its configuration from `config.yaml` via `ConfigService`. Below are the configuration sections and their fields.

### Gemini

```yaml
gemini:
  api_key: "${GEMINI_API_KEY}"
  model: "gemini-2.0-flash"
```

### Kubernetes

```yaml
kubernetes:
  kubeconfig_path: "~/.kube/config"   # Omit for in-cluster
```

### Prometheus

```yaml
prometheus:
  url: "http://localhost:9090"
```

### Loki

```yaml
loki:
  url: "http://localhost:3100"
```

### ArgoCD

```yaml
argocd:
  url: "https://argocd.example.com"
  token: "${ARGOCD_AUTH_TOKEN}"
```

### GitHub Actions

```yaml
github_actions:
  token: "${GITHUB_TOKEN}"
```

### Argus Monitor (Optional)

```yaml
argus_monitor:
  database_url: "${ARGUS_MONITOR_DB_URL}"
```

## Error Handling and Resilience

Argus AI is designed to handle various operational challenges gracefully:

- **Invalid Configuration**: The application will perform structural and format validation on connector configurations (e.g., URLs, paths, tokens). Syntactically incorrect YAML in `config.yaml` will result in an application startup error, prompting the user to correct the file.
- **Network Connectivity**: Temporary network failures to external connectors (Kubernetes API, Prometheus, Loki, etc.) are handled gracefully. All connector methods are wrapped with `withConnectorErrorHandling()` which provides:
  - **10-second timeout** — prevents hanging on unresponsive services
  - **Structured error responses** — returns `{ error: "<name> unavailable", data: null }` instead of throwing exceptions
  - **Safe logging** — error logs include connector name, error type, and duration; API keys and tokens are automatically redacted
- **LLM Error Resilience**:
  - **30-second timeout** — LLM calls are aborted after 30 seconds, returning `504 Gateway Timeout`
  - **Automatic retry** — on 5xx server errors, the call is retried once before returning `502 Bad Gateway`
  - **Token limit guard** — prompts exceeding 50k tokens truncate oldest history first
  - **Safe logging** — the LLM service never logs full prompt/response content; all log output is sanitized
- **Empty/Null/Large Responses**:
  - **Empty/Null Data**: If connectors return empty or null data for a query, Argus AI will process this gracefully, often resulting in a "no data found" response from the LLM.
  - **Large Data Volumes**: Strategies like pagination, sampling, and summarization will be employed to manage extremely large responses from connectors (e.g., millions of log lines from Loki) to prevent memory exhaustion and ensure efficient LLM processing.

## Performance Considerations

- **Optimizing Queries**: When interacting with external systems like Prometheus and Loki, it's recommended to specify precise time ranges and aggressive filtering in your natural language queries to minimize the data volume retrieved. This directly impacts response times and resource usage.
- **LLM Processing**: The time taken for LLM processing is directly proportional to the complexity and volume of the data provided. Efficient data retrieval and summarization are key to maintaining responsiveness.

## Example `config.example.yaml`

This section provides a full example of the `config.example.yaml` structure.
Remember to copy this to `config.yaml` and fill in your actual values.

```yaml
gemini:
  api_key: "${GEMINI_API_KEY}"
  model: "gemini-2.0-flash"

kubernetes:
  kubeconfig_path: "~/.kube/config"

prometheus:
  url: "http://localhost:9090"

loki:
  url: "http://localhost:3100"

argocd:
  url: "https://argocd.example.com"
  token: "${ARGOCD_AUTH_TOKEN}"

github_actions:
  token: "${GITHUB_TOKEN}"

argus_monitor:
  database_url: "${ARGUS_MONITOR_DB_URL}"
```
