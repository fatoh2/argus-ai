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

| Variable | Description | Required |
|---|---|---|
| `GEMINI_API_KEY` | Your API key for the Google Gemini API | Yes |
| `KUBECONFIG_PATH` | Path to your Kubernetes kubeconfig file | No (uses in-cluster if omitted) |
| `PROMETHEUS_URL` | URL of your Prometheus instance (e.g., `http://localhost:9090`) | No |
| `LOKI_URL` | URL of your Loki instance (e.g., `http://localhost:3100`) | No |
| `ARGOCD_URL` | URL of your ArgoCD instance (e.g., `https://argocd.example.com`) | No |
| `ARGOCD_AUTH_TOKEN` | Authentication token for ArgoCD | No |
| `GITHUB_TOKEN` | Personal Access Token (PAT) for GitHub, with `workflow` scope | No |
| `ARGUS_MONITOR_DB_URL` | Database connection string for the Argus Monitor (read-only replica) | No |

## Connector Configuration

### Kubernetes

- `kubeconfig_path`: Path to your kubeconfig file. Supports `~` expansion and environment variables (e.g., `${KUBECONFIG_PATH}`). If left empty, Argus AI will attempt to use in-cluster configuration (suitable when running inside a Kubernetes cluster).

```yaml
kubernetes:
  kubeconfig_path: "~/.kube/config"
```

### Prometheus

- `url`: URL of your Prometheus instance.

```yaml
prometheus:
  url: "http://localhost:9090"
```

### Loki

- `url`: URL of your Loki instance.

```yaml
loki:
  url: "http://localhost:3100"
```

### ArgoCD

- `url`: URL of your ArgoCD instance.
- `token`: ArgoCD authentication token. Populated via environment variable (e.g., `${ARGOCD_AUTH_TOKEN}`).

```yaml
argocd:
  url: "https://argocd.example.com"
  token: "${ARGOCD_AUTH_TOKEN}"
```

### GitHub Actions

- `token`: GitHub Personal Access Token with `workflow` scope. Populated via environment variable (e.g., `${GITHUB_TOKEN}`).

```yaml
github_actions:
  token: "${GITHUB_TOKEN}"
```

### Argus Monitor (Optional)

- `database_url`: The database URL for the Argus Monitor PostgreSQL instance.

```yaml
argus_monitor:
  database_url: "${ARGUS_MONITOR_DB_URL}"
```

## How Connectors Use ConfigService

All connectors inject `ConfigService` to read their configuration:

```typescript
@Injectable()
export class LokiConnector {
  constructor(private configService: ConfigService) {
    this.baseUrl = this.configService.get<string>('loki.url', 'http://localhost:3100');
  }
}
```

## Error Handling and Resilience

- **Invalid Configuration**: The application will perform structural and format validation on connector configurations (e.g., URLs, paths, tokens). Syntactically incorrect YAML in `config.yaml` will result in an application startup error.
- **Network Connectivity**: Temporary network failures to external connectors are handled gracefully with retry mechanisms.
- **Empty/Null/Large Responses**:
  - **Empty/Null Data**: Processed gracefully, resulting in a "no data found" response.
  - **Large Data Volumes**: Strategies like pagination, sampling, and summarization are employed to manage large responses (e.g., Loki queries capped at 500 lines).
