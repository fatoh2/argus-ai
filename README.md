# Argus AI — Your Autonomous Infrastructure Assistant

Argus AI is an intelligent assistant designed to help DevOps teams understand and troubleshoot their infrastructure using natural language. Powered by Anthropic's Claude API, it connects to your existing Kubernetes, Prometheus, Loki, ArgoCD, and GitHub Actions instances to provide real-time insights, incident summaries, and diagnostic information.


## Features

- **Natural Language Queries**: Interact with your infrastructure using plain English. Ask questions like "What's the status of my web-app deployment?" or "Why did the database pod restart?"
- **Multi-Source Integration**: Seamlessly gathers and correlates data from various infrastructure components including Kubernetes, Prometheus, Loki, ArgoCD, and GitHub Actions.
- **Incident Analysis**: Quickly diagnose issues by summarizing incidents, identifying potential root causes, and suggesting actionable next steps based on aggregated data.
- **Proactive Monitoring (Future)**: Future enhancements will enable Argus AI to proactively identify potential problems and anomalies before they impact users.
- **Extensible Connector Architecture**: Easily add new read-only connectors to integrate with additional tools and platforms.

## Demo

![Demo GIF Placeholder](https://via.placeholder.com/800x450?text=Demo+GIF+Coming+Soon)

## Supported Connectors

Argus AI currently supports read-only integration with:

- **Kubernetes**: Pod status, deployments, events, and resource utilization.
- **Prometheus**: Metric queries, historical data, and alert status.
- **Loki**: Log aggregation, searching, and analysis.
- **ArgoCD**: Application status, synchronization health, and deployment history.
- **GitHub Actions**: Workflow run status, history, and job details.
- **Argus Monitor (Optional)**: Alerts and wallet activity from the Argus Monitor platform.

## Quickstart

This repository includes the `argus-ai` submodule, which contains the core backend application logic for the AI assistant. It is designed to be a self-contained service that can be deployed independently or as part of a larger system.

1.  **Prerequisites**: Ensure you have Node.js (v18+) and npm installed.

2.  **Clone the repository and initialize submodule**:
    ```bash
    git clone https://github.com/fatoh2/argus-ai.git
    cd argus-ai
    git submodule update --init --recursive
    ```

3.  **Configure your connectors**:
    Copy `config.example.yaml` to `config.yaml`. This file defines the structure for your connector configurations.
    ```bash
    cp config.example.yaml config.yaml
    ```
    **Sensitive fields (like API keys and tokens) in `config.yaml` are designed to be populated via environment variables (e.g., `${ANTHROPIC_API_KEY}`). Set these environment variables in your shell or a `.env` file.**
    **Never commit `config.yaml` to Git if it contains sensitive information!**

4.  **Install dependencies**:
    ```bash
    npm install
    ```

5.  **Run locally (for development/testing)**:
    ```bash
    npm run start:dev
    ```
    This will start the NestJS backend.

For detailed configuration, connector setup, and example queries, please refer to the `docs/` directory.


## Security Best Practices

- **User Query Sanitization**: All natural language queries from users are rigorously sanitized and validated to prevent prompt injection and other forms of injection attacks, ensuring the integrity and security of interactions with the LLM and underlying systems.
- **Secure Environment Variables**: Sensitive information is loaded and validated securely from environment variables, minimizing the risk of exposure.
- **Configuration Validation**: Connector configurations, including API keys and URLs, undergo basic structural and format validation to prevent misconfigurations and potential vulnerabilities.
- **Least Privilege**: When configuring GitHub tokens, prefer the `workflow` scope over `repo` scope unless broader access is strictly necessary.

## Documentation

- [Connectors](docs/connectors.md) — how each connector works (K8s, Prometheus, Loki, ArgoCD, GitHub Actions)
- [Configuration](docs/config.md) — full config reference, env vars, connector setup
- [Deployment Guide](docs/deployment.md) — how to deploy Argus AI to various environments
- [Example Queries](docs/examples.md) — example queries and AI responses (postmortem, incident summary, pod restart analysis)
- [Development Guide](docs/development.md) — adding new connectors, running locally, testing

## Contributing

We welcome contributions! Please see our [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.
