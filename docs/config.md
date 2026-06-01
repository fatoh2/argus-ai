# Configuration

Argus AI uses a `config.yaml` file for all its operational settings. This file defines how Argus AI connects to your various infrastructure components (Kubernetes, Prometheus, Loki, ArgoCD, GitHub Actions, Argus Monitor) and configures the underlying Large Language Model (LLM).

A `config.example.yaml` is provided in the root of the repository, which you should copy to `config.yaml` and modify.

```bash
cp config.example.yaml config.yaml
```

**Important Security Note:** Sensitive fields (like API keys and tokens) in `config.yaml` are designed to be populated via environment variables (e.g., `${ANTHROPIC_API_KEY}`). **Never commit `config.yaml` to Git if it contains sensitive information!**

## Configuration Structure

The `config.yaml` is structured into several top-level sections, each corresponding to a specific component or connector.

### `claude`

Configuration for the Anthropic Claude API.

-   `api_key`: Your Anthropic API key. **Required.** Populated via environment variable (e.g., `${ANTHROPIC_API_KEY}`).
-   `model`: The Claude model to use (e.g., `claude-3-sonnet-20240229`, `claude-3-opus-20240229`). Defaults to `claude-3-sonnet-20240229`.

Example:

```yaml
claude:
  api_key: "${ANTHROPIC_API_KEY}"
  model: "claude-3-sonnet-20240229"
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

### `argus_monitor` (Optional)

Configuration for the Argus Monitor connector. This connector allows Argus AI to fetch alerts and wallet activity from an Argus Monitor instance.

-   `database_url`: Database URL for the Argus Monitor PostgreSQL instance. **Required.** Populated via environment variable (e.g., `${ARGUS_MONITOR_DB_URL}`).
-   `api_key`: API key for Argus Monitor (if applicable). Populated via environment variable (e.g., `${ARGUS_MONITOR_API_KEY}`).

Example:

```yaml
argus_monitor:
  database_url: "${ARGUS_MONITOR_DB_URL}"
  api_key: "${ARGUS_MONITOR_API_KEY}"
```

