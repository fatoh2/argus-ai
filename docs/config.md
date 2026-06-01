# Configuration

Argus AI uses a `config.yaml` file for all its operational settings. This file defines how Argus AI connects to your various infrastructure components (Kubernetes, Prometheus, Loki, ArgoCD, GitHub Actions, Argus Monitor) and configures the underlying Large Language Model (LLM).

A `config.example.yaml` is provided in the root of the repository, which you should copy to `config.yaml` and modify.

Argus AI performs basic validation on API keys and tokens to ensure their presence and correct format.
1.  Ensure your `config.yaml` is valid YAML. Consider using a YAML linter to catch syntax errors early.
2.  Copy `config.example.yaml` to `config.yaml`:
    ```bash
    cp config.example.yaml config.yaml
    ```
3.  Edit `config.yaml` to fill in your specific values for API keys, endpoints, and other settings.

**Important Security Note:** Sensitive fields (like API keys and tokens) in `config.yaml` are designed to be populated via environment variables (e.g., `${ANTHROPIC_API_KEY}`). **Never commit `config.yaml` to Git if it contains sensitive information!**

Sensitive information like API keys should ideally be provided via environment variables, especially in production environments. Values provided via environment variables will override those specified in `config.yaml`. The `config.yaml` can reference environment variables using the `${ENV_VAR_NAME}` syntax.

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
  token: "${GITHUB_TOKEN}" # For GitHub Actions, prefer the 'workflow' scope for tokens over 'repo' for least privilege.

argus_monitor:
  database_url: "${ARGUS_MONITOR_DB_URL}" # Read-only replica
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

