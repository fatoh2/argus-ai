# Configuration Reference

Argus AI uses a `config.yaml` file for all its operational settings, including API endpoints, credentials, and connector-specific configurations. A template, `config.example.yaml`, is provided for reference. **Never commit your `config.yaml` to Git!**

## Basic Setup

Argus AI performs basic validation on API keys and tokens to ensure their presence and correct format.
1.  Ensure your `config.yaml` is valid YAML. Consider using a YAML linter to catch syntax errors early.
2.  Copy `config.example.yaml` to `config.yaml`:
    ```bash
    cp config.example.yaml config.yaml
    ```
3.  Edit `config.yaml` to fill in your specific values for API keys, endpoints, and other settings.

## Environment Variables

Sensitive information like API keys should ideally be provided via environment variables, especially in production environments. Values provided via environment variables will override those specified in `config.yaml`. The `config.yaml` can reference environment variables using the `${ENV_VAR_NAME}` syntax.

Example:

```yaml
claude:
  api_key: ${ANTHROPIC_API_KEY}
  model: claude-3-sonnet-20240229

kubernetes:
    # IMPORTANT: The `kubeconfig_path` parameter requires rigorous sanitization and escaping
    # in the application code to prevent path traversal and command injection vulnerabilities.
    # Ensure that any usage of this path in shell commands or system calls is properly secured.
  kubeconfig_path: /path/to/your/kubeconfig # Or use in-cluster service account

prometheus:
  url: http://localhost:9090

loki:
  url: http://localhost:3100

argocd:
  url: https://argocd.example.com
  token: ${ARGOCD_AUTH_TOKEN}

github_actions:
  token: ${GITHUB_TOKEN} # For GitHub Actions, prefer the 'workflow' scope for tokens over 'repo' for least privilege.

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

- `token`: A GitHub Personal Access Token with `workflow` scope. **Highly recommended to use an environment variable.**

### `argus_monitor`

- `database_url`: The database URL for the Argus Monitor PostgreSQL instance. **Highly recommended to use an environment variable.**
- `api_key`: (Optional) API key for Argus Monitor (if applicable). **Highly recommended to use an environment variable.**

## Error Handling and Resilience

Argus AI is designed to handle various operational challenges:

-   **Invalid Configuration**: The application will perform structural and format validation on connector configurations (e.g., URLs, paths, tokens). Syntactically incorrect YAML in `config.yaml` will result in an application startup error, prompting the user to correct the file.
-   **Network Connectivity**: Temporary network failures to external connectors (Kubernetes API, Prometheus, Loki, etc.) are handled gracefully. The application will implement retry mechanisms and report connection issues without crashing.
-   **Empty/Null/Large Responses**:
    -   **Empty/Null Data**: If connectors return empty or null data for a query, Argus AI will process this gracefully, often resulting in a "no data found" response from the LLM.
    -   **Large Data Volumes**: Strategies like pagination, sampling, and summarization will be employed to manage extremely large responses from connectors (e.g., millions of log lines from Loki) to prevent memory exhaustion and ensure efficient LLM processing.

## Performance Considerations

-   **Optimizing Queries**: When interacting with external systems like Prometheus and Loki, it's recommended to specify precise time ranges and aggressive filtering in your natural language queries to minimize the data volume retrieved. This directly impacts response times and resource usage.
-   **LLM Processing**: The time taken for LLM processing is directly proportional to the complexity and volume of the data provided. Efficient data retrieval and summarization are key to maintaining responsiveness.

## Example `config.example.yaml`

This section provides a full example of the `config.example.yaml` structure.
Remember to copy this to `config.yaml` and fill in your actual values.

```yaml
claude:
  api_key: "${ANTHROPIC_API_KEY}"
  model: "claude-3-sonnet-20240229"

kubernetes:
    # IMPORTANT: The `kubeconfig_path` parameter requires rigorous sanitization and escaping
    # in the application code to prevent path traversal and command injection vulnerabilities.
    # Ensure that any usage of this path in shell commands or system calls is properly secured.
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
  api_key: "${ARGUS_MONITOR_API_KEY}"
```
