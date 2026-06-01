# Configuration Reference

Argus AI uses a `config.yaml` file for all its operational settings, including API endpoints, credentials, and connector-specific configurations. A template, `config.example.yaml`, is provided for reference. **Never commit your `config.yaml` to Git!**

## Basic Setup

1.  Copy `config.example.yaml` to `config.yaml`:
    ```bash
    cp config.example.yaml config.yaml
    ```
2.  Edit `config.yaml` to fill in your specific values for API keys, endpoints, and other settings.

## Environment Variables

Sensitive information like API keys should ideally be provided via environment variables, especially in production environments. The `config.yaml` can reference environment variables using the `${ENV_VAR_NAME}` syntax.

Example:

```yaml
claude:
  api_key: ${ANTHROPIC_API_KEY}
kubernetes:
  kubeconfig_path: /path/to/your/kubeconfig # Or use in-cluster service account
prometheus:
  url: http://localhost:9090
loki:
  url: http://localhost:3100
argocd:
  url: https://argocd.example.com
  token: ${ARGOCD_AUTH_TOKEN}
github_actions:
  token: ${GITHUB_TOKEN}
argus_monitor:
  database_url: ${ARGUS_MONITOR_DB_URL} # Read-only replica
```

## Connector-Specific Configuration

Each connector has its own section in `config.yaml`.

### `claude`

- `api_key`: Your Anthropic Claude API key. **Highly recommended to use an environment variable.**
- `model`: The Claude model to use (e.g., `claude-sonnet-4-6`).

### `kubernetes`

- `kubeconfig_path`: (Optional) Path to your kubeconfig file. If not provided, it will attempt to use an in-cluster service account.

### `prometheus`

- `url`: The URL of your Prometheus instance.

### `loki`

- `url`: The URL of your Loki instance.

### `argocd`

- `url`: The URL of your ArgoCD instance.
- `token`: (Optional) An authentication token for ArgoCD. **Highly recommended to use an environment variable.**

### `github_actions`

- `token`: A GitHub Personal Access Token with `repo` scope. **Highly recommended to use an environment variable.**

### `argus_monitor`

- `database_url`: The connection string for a read-only replica of the Argus Monitor PostgreSQL database. **Highly recommended to use an environment variable.**

## Example `config.example.yaml`

```yaml
claude:
  api_key: "YOUR_ANTHROPIC_API_KEY"
  model: "claude-sonnet-4-6"

kubernetes:
  kubeconfig_path: "~/.kube/config" # Or leave empty for in-cluster

prometheus:
  url: "http://localhost:9090"

loki:
  url: "http://localhost:3100"

argocd:
  url: "https://argocd.example.com"
  token: "YOUR_ARGOCD_TOKEN"

github_actions:
  token: "YOUR_GITHUB_TOKEN"

argus_monitor:
  database_url: "postgresql://user:password@host:port/database"
```
