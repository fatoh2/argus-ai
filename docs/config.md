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
-   `model`: The Gemini model to use (e.g., `gemini-2.0-flash`).

Example:

```yaml
gemini:
  api_key: "${GEMINI_API_KEY}"
  model: "gemini-2.0-flash"
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

## Error Handling and Resilience

Argus AI is designed to handle various operational challenges gracefully:

- **Invalid Configuration**: The application will perform structural and format validation on connector configurations (e.g., URLs, paths, tokens). Syntactically incorrect YAML in `config.yaml` will result in an application startup error, prompting the user to correct the file.
- **Network Connectivity**: Temporary network failures to external connectors (Kubernetes API, Prometheus, Loki, etc.) are handled gracefully. All connector calls are wrapped with a **10-second timeout** (using AbortController to cancel the underlying HTTP request) via the shared `withConnectorErrorHandling()` utility. If a connector is unreachable, it returns a structured `ConnectorErrorResult` rather than crashing the application.
- **LLM Error Resilience**:
  - **30-second timeout** — LLM calls are aborted after 30 seconds, returning `504 Gateway Timeout`
  - **Automatic retry** — on 5xx server errors, the call is retried once before returning `502 Bad Gateway`
  - **Token limit guard** — prompts exceeding 50k tokens truncate oldest history first
  - **Safe logging** — the LLM service never logs full prompt/response content; all log output is sanitized
- **Empty/Null/Large Responses**:
  - **Empty/Null Data**: If connectors return empty or null data for a query, Argus AI will process this gracefully, often resulting in a "no data found" response from the LLM.
  - **Large Data Volumes**: Strategies like pagination, sampling, and summarization are employed to manage extremely large responses from connectors (e.g., millions of log lines from Loki) to prevent memory exhaustion and ensure efficient LLM processing.

## See Also

For the full configuration reference including environment variables, see [Configuration Reference](configuration.md).
