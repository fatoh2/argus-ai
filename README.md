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

To get Argus AI up and running in your environment:

1.  **Clone the repository**:
    
2.  **Configure your connectors**:
    Copy  to  and fill in your API endpoints and credentials.
    
    **Never commit  to Git!**
3.  **Install dependencies**:
    
4.  **Run locally (for development/testing)**:
    
    This will start the NestJS backend and the React chat UI.
5.  **Deploy to Kubernetes**:
    Refer to the [Deployment Guide](docs/deployment.md) for production deployment instructions using the provided Helm chart.

For detailed configuration, connector setup, and example queries, please refer to the  directory.

## Security Best Practices

- **User Query Sanitization**: All natural language queries from users are rigorously sanitized and validated to prevent prompt injection and other forms of injection attacks, ensuring the integrity and security of interactions with the LLM and underlying systems.
- **Secure Environment Variables**: Sensitive information is loaded and validated securely from environment variables, minimizing the risk of exposure.
- **Configuration Validation**: Connector configurations, including API keys and URLs, undergo basic structural and format validation to prevent misconfigurations and potential vulnerabilities.
- **Least Privilege**: When configuring GitHub tokens, prefer the  scope over  scope unless broader access is strictly necessary.

## Documentation

- [Connectors](docs/connectors.md)
- [Configuration](docs/config.md)
- [Deployment Guide](docs/deployment.md)
- [Example Queries](docs/examples.md)
- [Development Guide](docs/development.md)

## Contributing

We welcome contributions! Please see our [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.
