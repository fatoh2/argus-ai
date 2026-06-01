# Argus AI

Argus AI is an intelligent assistant designed to help DevOps teams understand and troubleshoot their infrastructure using natural language. Powered by Google's Gemini API, it connects to your existing Kubernetes, Prometheus, Loki, ArgoCD, and GitHub Actions instances to provide real-time insights, incident summaries, and diagnostic information.

## Features

- **Natural Language Queries**: Interact with your infrastructure using plain English. Ask questions like "What's the status of my web-app deployment?" or "Why did the database pod restart?"
- **Multi-Source Integration**: Seamlessly gathers and correlates data from various infrastructure components including Kubernetes, Prometheus, Loki, ArgoCD, and GitHub Actions.
- **Incident Analysis**: Quickly diagnose issues by summarizing incidents, identifying potential root causes, and suggesting actionable next steps based on aggregated data.
- **Proactive Monitoring (Future)**: Future enhancements will enable Argus AI to proactively identify potential problems and anomalies before they impact users.
- **Extensible Connector Architecture**: Easily add new read-only connectors to integrate with additional tools and platforms.

## Demo

[Link to demo video/gif]

Argus AI currently supports read-only integration with:

- **Kubernetes**: Pod status, deployments, events, and resource utilization.
- **Prometheus**: Metric queries, historical data, and alert status.
- **Loki**: Log aggregation, searching, and analysis — including error summarization across time ranges.
- **ArgoCD**: Application status, synchronization health, and cluster-wide health summaries.
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
    **Sensitive fields (like API keys and tokens) in `config.yaml` are designed to be populated via environment variables (e.g., `${ANTHROPIC_API_KEY}`). Set these environment variables in your shell or a `.env` file.**
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
    -d '{"query": "What is the status of my web-app deployment?"}'
    ```

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
- **Secure Environment Variables**: Sensitive information is loaded and validated securely from environment variables, preventing hardcoding of credentials.
- **Least Privilege Access**: Connectors are designed to operate with the minimum necessary permissions, adhering to the principle of least privilege to limit potential impact of compromise.
- **Read-Only Operations**: Argus AI is strictly read-only. It will never execute commands or modify your infrastructure, ensuring a safe diagnostic and monitoring environment.
- **Auditable Interactions**: All interactions and queries are logged for auditing and compliance purposes.

## Contributing

We welcome contributions! Please see our `CONTRIBUTING.md` for guidelines.

## Auto-update rule
When any PR merges to this repo, update relevant docs to reflect the changes.

## Done when
Any DevOps team can point argus-ai at their Prometheus+Loki+K8s cluster and query it within 10 minutes.

## License

This project is licensed under the MIT License.
