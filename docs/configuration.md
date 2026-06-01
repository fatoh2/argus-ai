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
| `GITHUB_TOKEN` | Personal Access Token (PAT) for GitHub, with `workflow` scope | No | — |
| `ARGUS_MONITOR_DB_URL` | Database connection string for the Argus Monitor (read-only replica) | No | — |

## Connector Setup

Detailed setup instructions for each connector.

### Kubernetes Connector Setup

The Kubernetes connector can operate in two modes:

1.  **In-cluster (Recommended for Production)**: When Argus AI is deployed inside a Kubernetes cluster, it will automatically use the service account credentials assigned to its pod.
    -   Ensure the service account has appropriate read-only permissions (e.g., `get`, `list`, `watch` for pods, deployments, events).
    -   **Do not set `KUBECONFIG_PATH`** in your `config.yaml` or environment variables if deploying in-cluster.

2.  **Out-of-cluster (Recommended for Local Development)**: For local development or when running outside a cluster, you can point Argus AI to a kubeconfig file.
    -   Set the `KUBECONFIG_PATH` environment variable to the path of your kubeconfig file (e.g., `~/.kube/config`).
    -   Ensure the context in your kubeconfig file is correctly configured to access your target cluster.

### Prometheus Connector Setup

1.  **URL Configuration**: Set the `PROMETHEUS_URL` environment variable to the base URL of your Prometheus instance.
    -   Example: `PROMETHEUS_URL=http://localhost:9090`
    -   If Prometheus requires authentication, you will need to configure a reverse proxy or API gateway to handle authentication and forward requests to Prometheus, as Argus AI does not directly support Prometheus authentication.

### Loki Connector Setup

1.  **URL Configuration**: Set the `LOKI_URL` environment variable to the base URL of your Loki instance.
    -   Example: `LOKI_URL=http://localhost:3100`
    -   Similar to Prometheus, if Loki requires authentication, consider using a reverse proxy.

**Available Methods**:

- `isHealthy()` — Health check via `/ready` endpoint
- `queryRange(options)` — Execute a LogQL range query (limit capped at 500)
- `queryLogs(labelSelector, start?, end?, level?, limit?)` — Query logs for a specific label selector
- `summarizeErrors(hours?, labelSelector?)` — Summarize error logs from the last N hours

### ArgoCD Connector Setup

1.  **URL Configuration**: Set the `ARGOCD_URL` environment variable to the base URL of your ArgoCD instance.
    -   Example: `ARGOCD_URL=https://argocd.example.com`
2.  **Authentication (Optional)**: If your ArgoCD instance requires authentication, provide an authentication token.
    -   Set the `ARGOCD_AUTH_TOKEN` environment variable with a valid token. This token should have read-only access to the applications you wish to monitor.
    -   You can generate an ArgoCD authentication token via the ArgoCD CLI or UI.

**Available Methods**:

- `isHealthy()` — Health check via `/api/v1/session/userinfo`
- `getAppStatus(appName)` — Get sync/health status for a specific application
- `listApps()` — List all applications with their status
- `getClusterSummary()` — Get a human-readable cluster health summary

### GitHub Actions Connector Setup

1.  **Personal Access Token (PAT)**: Create a GitHub Personal Access Token (PAT).
    -   Go to GitHub -> Settings -> Developer settings -> Personal access tokens -> Tokens (classic) -> Generate new token.
    -   Grant the token the `workflow` scope (least privilege) or `repo` scope for private repositories.
    -   Set the `GITHUB_TOKEN` environment variable to your generated PAT.
    -   Example: `GITHUB_TOKEN=ghp_YOUR_GITHUB_PAT`

### Argus Monitor Connector Setup

1.  **Database URL**: Set the `ARGUS_MONITOR_DB_URL` environment variable to the connection string of your Argus Monitor database (preferably a read-only replica).
    -   Example: `ARGUS_MONITOR_DB_URL=postgresql://user:password@host:5432/argus_monitor_db`
    -   Ensure the provided user has read-only permissions to the necessary tables.

## Security Best Practices

-   **Principle of Least Privilege**: Ensure all API tokens and credentials have the minimum necessary permissions.
-   **Environment Variables for Secrets**: Never hardcode sensitive information directly into `config.yaml` or any other committed file. Use environment variables.
-   **Read-Only Connectors**: All Argus AI connectors are designed to be read-only, preventing accidental or malicious modifications to your infrastructure.
-   **Regular Audits**: Periodically review access logs and API usage for any suspicious activity.
-   **Network Segmentation**: Deploy Argus AI in a segmented network environment to limit its access to critical systems.
