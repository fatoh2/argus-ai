# Argus AI

Argus AI is an intelligent assistant designed to help DevOps teams understand and troubleshoot their infrastructure using natural language. Powered by Google's Gemini API, it connects to your existing Kubernetes, Prometheus, Loki, ArgoCD, and GitHub Actions instances to provide real-time insights, incident summaries, and diagnostic information.

## Features

- **Natural Language Queries**: Interact with your infrastructure using plain English. Ask questions like "What's the status of my web-app deployment?" or "Why did the database pod restart?"
- **Multi-Source Integration**: Seamlessly gathers and correlates data from various infrastructure components including Kubernetes, Prometheus, Loki, ArgoCD, and GitHub Actions.
- **Incident Analysis**: Quickly diagnose issues by summarizing incidents, identifying potential root causes, and suggesting actionable next steps based on aggregated data.
- **Graceful Degradation**: All connectors handle timeouts and failures gracefully — if a service is unreachable, the LLM receives a structured error and informs the user instead of crashing.
- **Safe Logging**: Error logs automatically redact API keys, bearer tokens, and secrets — no sensitive credentials leak into log aggregation systems.
- **Input Validation & Sanitization**: The `/chat` endpoint validates message length (max 4000 characters), strips control characters and null bytes, and rejects empty messages with a `400 Bad Request`.
- **Rate Limited API**: The `/chat` endpoint is rate-limited to 20 requests per minute per IP. Rate-limit hits are logged with a hashed IP for monitoring.
- **Proactive Monitoring (Future)**: Future enhancements will enable Argus AI to proactively identify potential problems and anomalies before they impact users.
- **Extensible Connector Architecture**: Easily add new read-only connectors to integrate with additional tools and platforms.

## Demo

[Link to demo video/gif]

Argus AI currently supports read-only integration with:

- **Kubernetes**: Pod status, deployments, events, and resource utilization.
- **Prometheus**: Metric queries, historical data, and alert status.
- **Loki**: Log aggregation, searching, and analysis — including error summarization across time ranges.
- **ArgoCD**: Application sync status, health checks, and cluster-wide deployment summaries.
- **GitHub Actions**: Workflow run status, history, and job details.
- **Argus Monitor (Optional)**: Alerts and wallet activity from the Argus Monitor platform.

## Quickstart: Get Argus AI Querying in 10 Minutes

This guide will help any DevOps team point Argus AI at their Prometheus+Loki+K8s cluster and start querying within 10 minutes.

1.  **Prerequisites**: Ensure you have Node.js (v18+) and npm installed.

2.  **Clone the repository**:
    ```bash
    git clone https://github.com/fatoh2/argus-ai.git
    cd argus-ai
    ```

3.  **Configure your connectors**:
    Copy `config.example.yaml` to `config.yaml`. This file defines the structure for your connector configurations.
    ```bash
    cp config.example.yaml config.yaml
    ```
    **Sensitive fields (like API keys and tokens) in `config.yaml` are designed to be populated via environment variables (e.g., `${GEMINI_API_KEY}`). Set these environment variables in your shell or a `.env` file.**
    **Never commit `config.yaml` to Git if it contains sensitive information!**

    For a quick start with Kubernetes, Prometheus, and Loki, ensure your `config.yaml` has the correct URLs (e.g., for Prometheus and Loki if they are not on localhost) and any necessary authentication details. For Kubernetes, if running in-cluster, you should remove or comment out the `kubeconfig_path` line.

4.  **Install dependencies**:
    ```bash
    npm install
    ```

5.  **Run locally (for development/testing)**:
    ```bash
    npm run start:dev
    ```
    This will start the NestJS backend, typically on `http://localhost:3000`.

6.  **Start Querying!**
    Once the backend is running, you can interact with Argus AI via its API (e.g., using `curl` or a simple client). For example, to query your Kubernetes cluster:

    ```bash
    curl -X POST http://localhost:3000/chat \
    -H "Content-Type: application/json" \
    -d '{"message": "What is the status of my web-app deployment?"}'
    ```

    **Note**: The `/chat` endpoint is rate-limited to 20 requests per minute per IP. If you exceed this limit, you will receive a `429 Too Many Requests` response with a `Retry-After` header.

    Refer to [Example Queries](docs/examples.md) for more example queries.

## Configuration

Argus AI uses **NestJS ConfigModule** (`@nestjs/config`) for configuration management. Settings are loaded from:

1. **Environment variables** (highest priority) — set in your shell or a `.env` file
2. **`config.yaml`** — for non-sensitive defaults and connector endpoint URLs

The `ConfigModule` is registered globally in `app.module.ts` with `isGlobal: true`, making `ConfigService` available to all modules without additional imports.

Key environment variables:

| Variable | Description | Required |
|---|---|---|
| `GEMINI_API_KEY` | Google Gemini API key | Yes |
| `KUBECONFIG_PATH` | Path to kubeconfig (omit for in-cluster) | No |
| `PROMETHEUS_URL` | Prometheus endpoint | No (default: `http://localhost:9090`) |
| `LOKI_URL` | Loki endpoint | No (default: `http://localhost:3100`) |
| `ARGOCD_URL` | ArgoCD endpoint | No (default: `https://localhost:8080`) |
| `ARGOCD_AUTH_TOKEN` | ArgoCD auth token | No |
| `GITHUB_TOKEN` | GitHub PAT with `workflow` scope | No |
| `ARGUS_MONITOR_DB_URL` | Argus Monitor read-only DB URL | No |

See [Configuration Reference](docs/configuration.md) for full details.

## Security Best Practices

- **User Query Sanitization**: All natural language queries from users are rigorously sanitized and validated to prevent prompt injection and other forms of injection attacks. The `/chat` endpoint strips control characters and null bytes before processing.
- **Input Validation**: The `/chat` endpoint validates message length (max 4000 characters) and strips control characters. Empty messages are rejected with a `400 Bad Request`. A global `ValidationPipe` with `whitelist: true` and `forbidNonWhitelisted: true` ensures only expected fields are accepted.
- **Rate Limiting**: The `/chat` endpoint is rate-limited to 20 requests per minute per IP. Rate-limit hits are logged with a hashed IP for monitoring, and a `Retry-After` header is set on `429` responses.
- **Safe Logging**: All connector error logs automatically redact API keys, bearer tokens, and secrets using a regex pattern before writing to the console. Error logs include connector name, error type, and duration — never credentials.
- **Graceful Degradation**: All connector methods are wrapped with `withConnectorErrorHandling()` which provides a 10-second timeout, structured error responses (`{ error: "...", data: null }`), and safe logging.
- **Read-Only Access**: Argus AI is designed to operate with **read-only access** to all integrated connectors (Kubernetes, Prometheus, Loki, ArgoCD, GitHub Actions, Argus Monitor). Ensure that the credentials provided are scoped to the minimum necessary read-only permissions.
- **Health Checks**: Every connector implements an `isHealthy()` method that verifies connectivity before executing queries. If an endpoint is unreachable, the connector returns a graceful error rather than crashing the application.

See [Security Best Practices](docs/security.md) for more details.

## Architecture

```
src/
  app.module.ts           # Root module — registers ConfigModule (global), ChatModule, LlmModule, ConnectorsModule
  app.controller.ts       # Health check endpoint
  app.service.ts          # Core application service
  main.ts                 # Bootstrap — global ValidationPipe with whitelist
  chat/                   # Chat API module (REST endpoint)
    chat.controller.ts    # POST /chat — input sanitization + validation
    chat.module.ts        # ThrottlerModule (20 req/min) + ChatRateLimitGuard
    chat-rate-limit.guard.ts  # Custom rate limit guard with hashed IP logging
    dto/chat.dto.ts       # ChatDto — message validation (max 4000 chars)
  connectors/             # Read-only connector implementations
    connectors.module.ts  # Registers and exports all connectors
    utils/
      connector-error.ts  # Graceful degradation utility (timeout + structured errors + log sanitization)
    k8s-prometheus.connector.ts
    kubernetes.connector.ts
    loki.connector.ts     # Loki log querying (LogQL)
    argocd.connector.ts   # ArgoCD application status
  llm/                    # LLM integration (Gemini API)
config.example.yaml       # Template — copy to config.yaml, never commit config.yaml
```

## Development

See [Development Guide](docs/development.md) for setup instructions, testing, and how to add new connectors.

## Related Projects

- **argus-infra**: Kubernetes homelab platform (Terraform, Ansible k3s, ArgoCD, Prometheus)
- **argus-monitor**: Blockchain monitoring SaaS (NestJS, React, PostgreSQL, BullMQ)
