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
- **LLM Error Resilience**: LLM calls have a 30-second timeout, automatic retry on 5xx errors, and a 50k-token prompt limit guard. A `GET /health/llm` endpoint provides LLM health monitoring.
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
- **Input Validation**: The `/chat` endpoint uses `class-validator` DTOs to enforce message length (max 4000 characters) and type constraints. Empty messages are rejected with a `400 Bad Request`.
- **Rate Limiting**: The `/chat` endpoint is protected by a rate limit of 20 requests per minute per IP. This prevents abuse and ensures fair usage. Rate-limit hits are logged with a hashed IP for monitoring, without exposing the actual IP address.
- **Credential Redaction**: All error logs are automatically processed by the `sanitizeLog()` utility to redact sensitive information such as API keys, bearer tokens, and other secrets. This prevents accidental leakage of credentials into log aggregation systems.
- **Read-Only Connectors**: All connectors are strictly read-only, preventing the AI from performing any destructive or modifying actions on your infrastructure.
- **No Hardcoded Secrets**: API keys and other sensitive credentials are never hardcoded. They are loaded from environment variables via NestJS `ConfigService`.
- **No `config.yaml` in Git**: The `config.yaml` file, which may contain sensitive endpoint URLs or default values, is explicitly excluded from Git. Only `config.example.yaml` is committed as a template.
- **Graceful Degradation**: Connectors are designed to handle timeouts and failures gracefully. If an external service is unreachable, the AI receives a structured error and informs the user, rather than crashing or exposing internal errors.
- **Limited Data Access**: Connectors are designed to access only the minimum necessary data to fulfill their function. For example, Loki queries are capped at 500 lines, and Prometheus queries are capped at a 24-hour range by default.
- **No Destructive Commands**: The AI's output is filtered to prevent it from suggesting or executing any destructive shell commands.
- **Encrypted History**: User query history and log content are never stored in plaintext. They are encrypted at rest to protect user privacy and data security.

## Development

### Prerequisites

- Node.js (v18+)
- npm
- Docker (for local database/service setup if needed)

### Local Setup

1.  **Clone the repository**:
    ```bash
    git clone https://github.com/fatoh2/argus-ai.git
    cd argus-ai
    ```
2.  **Install dependencies**:
    ```bash
    npm install
    ```
3.  **Create `config.yaml`**:
    ```bash
    cp config.example.yaml config.yaml
    ```
    Edit `config.yaml` to point to your local services (e.g., Prometheus, Loki, Kubernetes).
4.  **Set environment variables**:
    Create a `.env` file in the root directory or set environment variables directly in your shell.
    ```
    GEMINI_API_KEY=YOUR_GEMINI_API_KEY
    # KUBECONFIG_PATH=/path/to/your/kubeconfig # Uncomment if not running in-cluster
    # PROMETHEUS_URL=http://localhost:9090
    # LOKI_URL=http://localhost:3100
    # ARGOCD_URL=https://localhost:8080
    # ARGOCD_AUTH_TOKEN=your_argocd_token
    # GITHUB_TOKEN=your_github_pat
    # ARGUS_MONITOR_DB_URL=postgresql://user:password@host:port/database
    ```
5.  **Run in development mode**:
    ```bash
    npm run start:dev
    ```

### Testing

- **Unit tests**: `npm run test`
- **End-to-end tests**: `npm run test:e2e`
- **Test coverage**: `npm run test:cov`

### Linting and Formatting

- **Lint**: `npm run lint`
- **Format**: `npm run format`

## Deployment

Argus AI is designed to be deployed as a Docker container or directly on a Node.js environment.

### Docker

1.  **Build the Docker image**:
    ```bash
    docker build -t argus-ai .
    ```
2.  **Run the Docker container**:
    ```bash
    docker run -d -p 3000:3000 --env-file .env argus-ai
    ```
    Ensure your `.env` file contains all necessary environment variables (e.g., `GEMINI_API_KEY`, connector URLs).

### Kubernetes

Refer to the `argus-infra` repository for Kubernetes deployment manifests and Helm charts.

## Contributing

We welcome contributions! Please see our [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
