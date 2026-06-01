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

Sensitive information like API keys should ideally be provided via environment variables, especially in production environments. The `config.yaml` can reference environment variables using the `${ENV_VAR_NAME}` syntax.

Example:

```yaml
claude:
  api_key: ${ANTHROPIC_API_KEY}
  model: claude-3-sonnet-20240229

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
  # For GitHub Actions, prefer the workflow scope for tokens over repo for least privilege.
  token: ${GITHUB_TOKEN} # For GitHub Actions, prefer the workflow scope for tokens over repo for least privilege.


argus_monitor:
  database_url: ${ARGUS_MONITOR_DB_URL} # Read-only replica

# Example `config.example.yaml`
# This section provides a full example of the `config.example.yaml` structure.
# Remember to copy this to `config.yaml` and fill in your actual values.

# claude:
#   api_key: "${ANTHROPIC_API_KEY}"
#   model: claude-3-sonnet-20240229

# kubernetes:
#   kubeconfig_path: "/path/to/your/kubeconfig" # Or use in-cluster service account

# prometheus:
#   url: "http://localhost:9090"

# loki:
#   url: "http://localhost:3100"

# argocd:
#   url: "https://argocd.example.com"
#   token: "${ARGOCD_AUTH_TOKEN}"

# github_actions:
#   token: "${GITHUB_TOKEN}"

# argus_monitor:
#   database_url: "${ARGUS_MONITOR_DB_URL}"
  database_url: ${ARGUS_MONITOR_DB_URL} # Read-only replica

