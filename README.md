# Argus AI

Argus AI is an intelligent assistant designed to help DevOps teams understand and troubleshoot their infrastructure using natural language. Powered by Google's Gemini API, it connects to your existing Kubernetes, Prometheus, Loki, ArgoCD, and GitHub Actions instances to provide real-time insights, incident summaries, and diagnostic information.

## Features

- **Natural Language Queries**: Interact with your infrastructure using plain English. Ask questions like "What's the status of my web-app deployment?" or "Why did the database pod restart?"
- **Multi-Source Integration**: Seamlessly gathers and correlates data from various infrastructure components including Kubernetes, Prometheus, Loki, ArgoCD, and GitHub Actions.
- **Incident Analysis**: Quickly diagnose issues by summarizing incidents, identifying potential root causes, and suggesting actionable next steps based on aggregated data.
- **Proactive Monitoring (Future)**: Future enhancements will enable Argus AI to proactively identify potential problems and anomalies before they impact users.
- **Extensible Connector Architecture**: Easily add new read-only connectors to integrate with additional tools and platforms.
- **Rate Limited API**: The `/chat` endpoint is rate-limited to 20 requests per minute per IP to prevent abuse.

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

- **User Query Sanitization**: All natural language queries from users are rigorously sanitized and validated to prevent prompt injection and other forms of injection attacks, ensuring the integrity and security of interactions with the LLM and underlying systems.
- **Input Validation**: The `/chat` endpoint validates message length (max 4000 characters) and strips control characters. Empty messages are rejected with a `400 Bad Request`.
- **Rate Limiting**: The `/chat` endpoint is rate-limited to 20 requests per minute per IP. Rate-limit hits are logged with a hashed IP for monitoring.
- **Read-Only Access**: Argus AI is designed to operate with **read-only access** to all integrated connectors (Kubernetes, Prometheus, Loki, ArgoCD, GitHub Actions, Argus Monitor). Ensure that the credentials provided are scoped to the minimum necessary read-only permissions.
- **Secure Credential Management**: Use environment variables or a secure secret management system (e.g., Kubernetes Secrets, CI/CD secret management) for all sensitive information. Never hardcode API keys or tokens in configuration files.
- **Data Volume Management**: Argus AI employs strategies to manage potentially large data volumes, such as capping Loki log queries at 500 lines and Prometheus queries to 24-hour ranges.

See [Security Best Practices](docs/security.md) for full details.

## Documentation

- [Configuration Reference](docs/configuration.md) — Full configuration guide
- [Connectors](docs/connectors.md) — Available connectors and example queries
- [Development Guide](docs/development.md) — Local development setup and testing
- [Example Queries](docs/examples.md) — Example queries and expected AI responses
- [Security Best Practices](docs/security.md) — Security considerations

## License

This project is licensed under the MIT License.
