# Configuration Reference

Argus AI uses a `config.yaml` file for all its operational settings, including API endpoints, credentials, and connector-specific configurations. A template, `config.example.yaml`, is provided for reference. **Never commit your `config.yaml` to Git!**

## Basic Setup

Argus AI performs basic validation on API keys and tokens to ensure their presence and correct format.
1.  Ensure your `config.yaml` is valid YAML. Consider using a YAML linter to catch syntax errors early.

1.  Copy `config.example.yaml` to `config.yaml`:
    ```bash
    cp config.example.yaml config.yaml
    ```
2.  Edit `config.yaml` to fill in your specific values for API keys, endpoints, and other settings.

## Environment Variables

Environment variables are securely loaded and validated by the application to prevent injection attacks.
Environment variables are securely loaded and validated by the application to prevent injection attacks.

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
  database_url: ${ARGUS_MONITOR_DB_URL} # Read-only replica
```

## Connector-Specific Configuration

Each connector has its own section in `config.yaml`.

### `claude`

- `api_key`: Your Anthropic Claude API key. **Highly recommended to use an environment variable.**
- `model`: The Claude model to use (e.g., `claude-3-sonnet-20240229`).

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

- `token`: A GitHub Personal Access Token with `workflow` scope. The `workflow` scope grants access specifically to workflows and artifacts without granting full repository read/write access. Consider `repo` scope only if the AI needs to read repository content beyond workflow data. **Highly recommended to use an environment variable.**

### `argus_monitor`

## Data Handling and Robustness

Argus AI is designed to handle various data scenarios gracefully:

- **Empty/Null Responses**: The application is built to gracefully handle cases where connectors return no data or null values, preventing crashes and providing informative feedback.
- **Large Data Volumes**: Strategies like pagination, sampling, and summarization are employed to manage large datasets from connectors, optimizing performance and resource usage. The LLM processing time is dependent on the complexity and volume of the data provided.
- **Network Issues**: The system incorporates retry mechanisms and robust error reporting for temporary network failures when communicating with external connectors.
- **Concurrent Requests**: The underlying implementation considers rate limiting for external API calls and caching mechanisms for frequently requested data to prevent overwhelming external services.


- `database_url`: The connection string for a read-only replica of the Argus Monitor PostgreSQL database. **Highly recommended to use an environment variable.**

claude:
  api_key: "<ANTHROPIC_API_KEY_HERE>"
  model: "claude-3-sonnet-20240229"

kubernetes:
  kubeconfig_path: "~/.kube/config" # Or leave empty for in-cluster

prometheus:
  url: "http://localhost:9090"

loki:
  url: "http://localhost:3100"

argocd:
  url: "https://argocd.example.com"
  token: "<ARGOCD_AUTH_TOKEN_HERE>"

github_actions:
  token: "<GITHUB_TOKEN_HERE>"

```
