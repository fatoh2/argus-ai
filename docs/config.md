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

Environment variables are securely loaded and validated by the application to prevent injection attacks.

Sensitive information like API keys should ideally be provided via environment variables, especially in production environments. Values provided via environment variables will override those specified in `config.yaml`. The `config.yaml` can reference environment variables using the `${ENV_VAR_NAME}` syntax.
Values provided via environment variables will override those specified directly in `config.yaml` if both are present.


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

  kubeconfig_path: "~/.kube/config" # Or leave empty for in-cluster

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
