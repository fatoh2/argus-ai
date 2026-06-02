# Argus AI

Argus AI is an intelligent assistant designed to help DevOps teams understand and troubleshoot their infrastructure using natural language. Powered by Google's Gemini 1.5 Flash API, it connects to your existing Kubernetes, Prometheus, Loki, ArgoCD, and GitHub Actions instances to provide real-time insights, incident summaries, and diagnostic information.

## Features

- **Natural Language Queries**: Interact with your infrastructure using plain English. Ask questions like "What's the status of my web-app deployment?" or "Why did the database pod restart?"
- **Multi-Source Integration**: Seamlessly gathers and correlates data from various infrastructure components including Kubernetes, Prometheus, Loki, ArgoCD, and GitHub Actions.
- **Incident Analysis**: Quickly diagnose issues by summarizing incidents, identifying potential root causes, and suggesting actionable next steps based on aggregated data.
- **Graceful Degradation**: All connectors handle timeouts and failures gracefully — if a service is unreachable, the underlying HTTP request is cancelled via AbortController and the LLM receives a structured error and informs the user instead of crashing.
- **Safe Logging**: Error logs automatically redact API keys, bearer tokens, and secrets — no sensitive credentials leak into log aggregation systems.
- **Input Validation & Sanitization**: The `/chat` endpoint validates message length (max 4000 characters), strips control characters and null bytes, and rejects empty messages with a `400 Bad Request`.
- **Rate Limited API**: The `/chat` endpoint is rate-limited to 20 requests per minute per IP. Rate-limit hits are logged with a hashed IP for monitoring.
- **Real AI Responses**: The `/chat` endpoint is wired to the LLM service — queries return real AI-generated answers powered by Google Gemini 1.5 Flash, not stubs. Chat history is preserved across turns for contextual conversations.
- **LLM Error Resilience**: LLM calls have a 30-second hard timeout (returns `504 Gateway Timeout`), automatic retry on 5xx errors (up to 1 retry), and a 50k-token prompt limit guard that truncates oldest history first. A `GET /health/llm` endpoint provides LLM health monitoring with latency tracking.
- **LLM Error Classification**: LLM errors are mapped to appropriate HTTP status codes — rate limits return `429 Too Many Requests`, auth failures return `401 Unauthorized`, and server errors return `502 Bad Gateway`.
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

1.  **Prerequisites**: Ensure you have Node.js (v20+) and npm installed.

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

    The response is a real AI-generated answer from Google Gemini 1.5 Flash, synthesized from your connected infrastructure data.

    **Note**: The `/chat` endpoint is rate-limited to 20 requests per minute per IP. If you exceed this limit, you will receive a `429 Too Many Requests` response with a `Retry-After` header.

    Refer to [Example Queries](docs/examples.md) for more example queries.

## Configuration

Argus AI uses **NestJS ConfigModule** (`@nestjs/config`) for configuration management. Settings are loaded from:

1. **Environment variables** (highest priority) — set in your shell or a `.env` file
2. **`config.yaml`** — for non-sensitive defaults and connector endpoint URLs

The `ConfigModule` is registered globally in `app.module.ts` with `isGlobal: true`, making `ConfigService` available to all modules without additional imports.

Key environment variables:

| Variable | Description | Required | Default |
|---|---|---|---|
| `GEMINI_API_KEY` | Google Gemini API key | Yes | — |
| `LLM_TIMEOUT_MS` | LLM call timeout in milliseconds | No | `30000` |
| `LLM_MAX_PROMPT_TOKENS` | Maximum prompt tokens before truncation | No | `50000` |
| `LLM_MAX_RETRIES` | Number of retries on 5xx LLM errors | No | `1` |
| `KUBECONFIG_PATH` | Path to kubeconfig file | No | In-cluster config |
| `PROMETHEUS_URL` | Prometheus URL | No | `http://localhost:9090` |
| `LOKI_URL` | Loki URL | No | `http://localhost:3100` |
| `ARGOCD_URL` | ArgoCD URL | No | `https://localhost:8080` |
| `ARGOCD_AUTH_TOKEN` | ArgoCD auth token | No | — |
| `GITHUB_TOKEN` | GitHub PAT with `workflow` scope | No | — |
| `ARGUS_MONITOR_DB_URL` | Argus Monitor DB connection string | No | — |

## Architecture

```
┌─────────────┐     ┌──────────────┐     ┌─────────────────┐
│  User/Client │────▶│  Chat API    │────▶│  LlmService     │
│  (curl, UI)  │     │  POST /chat  │     │  (Gemini 1.5    │
└─────────────┘     └──────────────┘     │   Flash)        │
                                         └────────┬────────┘
                                                  │
                    ┌─────────────────────────────┼─────────────────────────┐
                    │                             │                         │
                    ▼                             ▼                         ▼
          ┌─────────────────┐          ┌──────────────────┐      ┌──────────────────┐
          │  K8s Connector   │          │  Prometheus       │      │  Loki Connector   │
          │  (read-only)     │          │  Connector        │      │  (read-only)      │
          └─────────────────┘          │  (read-only)      │      └──────────────────┘
                                        └──────────────────┘
```

## API

### `POST /chat`

Send a natural language query about your infrastructure.

**Request:**
```json
{
  "message": "What is the status of my web-app deployment?"
}
```

**Response:**
```json
{
  "response": "The web-app deployment in the production namespace has 3/3 pods running. All pods are healthy with no recent restarts."
}
```

**Rate Limiting**: 20 requests per minute per IP. Exceeding this returns `429 Too Many Requests` with a `Retry-After` header.

**Validation**: Messages are limited to 4000 characters. Control characters and null bytes are stripped. Empty messages return `400 Bad Request`.

### `GET /health/llm`

Check if the LLM service is responsive.

**Response:**
```json
{
  "ok": true,
  "latencyMs": 1234
}
```

## Development

See [Development Guide](docs/development.md) for setup instructions, project structure, and contribution guidelines.

## Configuration Reference

- [Configuration Guide](docs/configuration.md) — environment variables and config.yaml
- [Connector Setup](docs/connectors.md) — per-connector configuration details

## Security

See [Security Guide](docs/security.md) for security best practices, input validation, and safe logging.

## License

MIT
