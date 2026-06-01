# Argus AI — Your Autonomous Infrastructure Assistant

Argus AI is an intelligent assistant designed to help DevOps teams understand and troubleshoot their infrastructure using natural language. Powered by Anthropic's Claude API, it connects to your existing Kubernetes, Prometheus, Loki, ArgoCD, and GitHub Actions instances to provide real-time insights, incident summaries, and diagnostic information.

## What it Does

- **Natural Language Queries**: Ask questions about your infrastructure in plain English.
- **Multi-Source Integration**: Gathers data from Kubernetes, Prometheus, Loki, ArgoCD, and GitHub Actions.
- **Incident Analysis**: Quickly diagnose issues, summarize incidents, and suggest next steps.
- **Proactive Monitoring (Future)**: Identify potential problems before they impact users.

## Demo

![Demo GIF Placeholder](https://via.placeholder.com/800x450?text=Demo+GIF+Coming+Soon)

## Supported Connectors

Argus AI currently supports read-only integration with:

- **Kubernetes**: Pod status, deployments, events.
- **Prometheus**: Metric queries, historical data.
- **Loki**: Log aggregation and analysis.
- **ArgoCD**: Application status and synchronization.
- **GitHub Actions**: Workflow run status and history.
- **Argus Monitor (Optional)**: Alerts and wallet activity from the Argus Monitor platform.

## Quickstart

To get Argus AI up and running in your environment:

1.  **Clone the repository**:
    ```bash
    git clone https://github.com/fatoh2/argus-ai.git
    cd argus-ai
    ```
2.  **Configure your connectors**:
    Copy `config.example.yaml` to `config.yaml` and fill in your API endpoints and credentials.
    ```bash
    cp config.example.yaml config.yaml
    # Edit config.yaml with your settings
    ```
    **Never commit `config.yaml` to Git!**
3.  **Install dependencies**:
    ```bash
    npm install
    ```
4.  **Run locally (for development/testing)**:
    ```bash
    npm run start:dev
    ```
    This will start the NestJS backend and the React chat UI.
5.  **Deploy to Kubernetes**:
    Refer to the `k8s/ai-service/` Helm chart for production deployment instructions.

For detailed configuration, connector setup, and example queries, please refer to the `docs/` directory.

## Documentation

- [Connectors](docs/connectors.md)
- [Configuration](docs/config.md)
- [Example Queries](docs/examples.md)
- [Development Guide](docs/development.md)

## Contributing

We welcome contributions! Please see our [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.
