# Argus AI

Argus AI is an intelligent assistant designed to help DevOps teams understand and troubleshoot their infrastructure using natural language. Powered by DeepSeek V3 (with optional Gemini fallback), it connects to your existing Kubernetes, Prometheus, Loki, and ArgoCD instances to provide real-time insights, incident summaries, and diagnostic information.

## Features

- **Natural Language Queries**: Interact with your infrastructure using plain English. Ask questions like "What's the status of my web-app deployment?" or "Why did the database pod restart?"
- **Agentic Tool Use**: The LLM autonomously decides which infrastructure systems to query via OpenAI-compatible function calling, runs the read-only connectors, and synthesizes the live results into an answer. It can chain multiple tool calls in one turn (e.g. list deployments **and** namespaces) before responding.
- **Web Chat Dashboard**: A built-in chat UI is served at `/` (e.g. `http://localhost:3000`) — no separate frontend needed. It renders markdown tables, code blocks, and lists, shows a live health indicator, and talks to the same `/chat` endpoint.
- **Multi-Source Integration**: Seamlessly gathers and correlates data from various infrastructure components including Kubernetes, Prometheus, Loki, and ArgoCD.
- **Incident Analysis**: Quickly diagnose issues by summarizing incidents, identifying potential root causes, and suggesting actionable next steps based on aggregated data.
- **Graceful Degradation**: All connectors handle timeouts and failures gracefully — if a service is unreachable, the underlying HTTP request is cancelled via AbortController and the LLM receives a structured error and informs the user instead of crashing.
- **Safe Logging**: Error logs automatically redact API keys, bearer tokens, and secrets — no sensitive credentials leak into log aggregation systems.
- **Input Validation & Sanitization**: The `/chat` endpoint validates message length (max 4000 characters), strips control characters and null bytes, and rejects empty messages with a `400 Bad Request`.
- **Rate Limited API**: The `/chat` endpoint is rate-limited to 20 requests per minute per IP. Rate-limit hits are logged with a hashed IP for monitoring.
- **Real AI Responses**: The `/chat` endpoint is wired to the LLM service — queries return real AI-generated answers powered by DeepSeek V3 (with optional Gemini fallback), not stubs. Chat history is preserved across turns for contextual conversations.
- **LLM Error Resilience**: LLM calls have a 30-second hard timeout (returns `504 Gateway Timeout`), automatic retry on 5xx errors (up to 1 retry), and a 50k-token prompt limit guard that truncates oldest history first. A `GET /health/llm` endpoint provides LLM health monitoring with latency tracking.
- **LLM Error Classification**: LLM errors are mapped to appropriate HTTP status codes — rate limits return `429 Too Many Requests`, auth failures return `401 Unauthorized`, and server errors return `502 Bad Gateway`.
- **Proactive Monitoring (Future)**: Future enhancements will enable Argus AI to proactively identify potential problems and anomalies before they impact users.
- **Extensible Connector Architecture**: Easily add new read-only connectors to integrate with additional tools and platforms.
- **One-Command Setup**: Run `bash scripts/setup.sh` on a fresh clone to check prerequisites (Node.js v20+, npm, Docker), create `.env` from `.env.example`, install dependencies, and pull Docker images — all in one step.
- **Local Dev Stack**: A `docker-compose.dev.yml` provides a complete local observability stack (Prometheus, Loki, Grafana) for testing connectors without a real Kubernetes cluster. A `Makefile` provides one-command shortcuts for common dev tasks (`make up`, `make check`, `make test`, etc.).

## Demo

[Link to demo video/gif]

Argus AI exposes read-only connectors to the LLM as callable tools. The model
picks the right one(s) per question:

- **Kubernetes** (`list_pods`, `list_deployments`, `list_namespaces`, `get_pod_logs`): pod/deployment status, ready/restart counts, namespaces, and pod logs. Connects via the `KUBECONFIG` file using `@kubernetes/client-node`.
- **Prometheus** (`query_metrics`): instant PromQL queries for any metric (CPU, memory, request rates, target health).
- **Loki** (`query_logs`, `summarize_errors`): LogQL queries and grouped error-log summaries over a time range.
- **ArgoCD** (`list_argocd_apps`, `get_argocd_app`, `argocd_summary`): application sync status, health checks, and cluster-wide deployment summaries.

> Connectors with no configuration (missing env var) degrade gracefully — they
> report themselves offline to the model rather than failing the request.
> Planned: GitHub Actions and Argus Monitor connectors (not yet wired as tools).

## Quickstart: Get Argus AI Querying in 10 Minutes

This guide will help any DevOps team point Argus AI at their Prometheus+Loki+K8s cluster and start querying within 10 minutes.

1.  **Prerequisites**: Ensure you have Node.js (v20+), npm, and Docker installed. The setup script will verify all of these for you.

2.  **Clone the repository**:
    ```bash
    git clone https://github.com/fatoh2/argus-ai.git
    cd argus-ai
    ```

    > **Note**: The `.gitignore` includes `argus-ai/` to prevent accidental nested clones (e.g., if an automation agent clones the repo inside itself). If you see this directory appear, it is a stray artifact and can be safely deleted.

3.  **One-command setup (recommended)**:
    ```bash
    bash scripts/setup.sh
    ```
    This checks prerequisites (Node.js v20+, npm, Docker), creates `.env` from `.env.example`, installs dependencies, and pulls Docker images. After it completes, skip to step 6 to run the app.

    > **Note**: If you prefer to configure things manually, follow steps 4–6 instead.

4.  **Configure your connectors**:
    Copy `config.example.yaml` to `config.yaml`. This file defines the structure for your connector endpoints and credentials. Edit the values to match your infrastructure.

    ```bash
    cp config.example.yaml config.yaml
    ```

    > **Note**: The `config.yaml` file is gitignored and will not be committed. Environment variables in `.env` take precedence over `config.yaml` values.

5.  **Set environment variables**:
    Copy `.env.example` to `.env` and fill in your API keys and connector URLs:

    ```bash
    cp .env.example .env
    ```

    At minimum, set `DEEPSEEK_API_KEY` to your DeepSeek V3 API key. All connectors are optional — leave their URLs blank to run in offline mode (the LLM will report them as unavailable).

6.  **Run the app**:
    ```bash
    make up
    ```
    This starts the NestJS server (port 3000) and the local dev stack (Prometheus on 9090, Loki on 3100, Grafana on 3001).

7.  **Query it**:
    ```bash
    curl http://localhost:3000/chat \
      -H "Content-Type: application/json" \
      -d '{"message": "What pods are running in the default namespace?"}'
    ```

    Or open `http://localhost:3000` in your browser for the built-in chat dashboard.

## Configuration

Argus AI uses **NestJS ConfigModule** (`@nestjs/config`) for configuration management. Settings are loaded from:

1. **Environment variables** (highest priority) — set in your shell or a `.env` file
2. **`config.yaml`** — for non-sensitive defaults and connector endpoint URLs

The `ConfigModule` is registered globally in `app.module.ts` with `isGlobal: true`, making `ConfigService` available to all modules without additional imports.

Key environment variables:

| Variable | Description | Required | Default |
|---|---|---|---|
| `DEEPSEEK_API_KEY` | DeepSeek V3 API key (primary LLM) | Yes | — |
| `GEMINI_API_KEY` | Google Gemini API key (optional fallback) | No | — |
| `LLM_TIMEOUT_MS` | LLM call timeout in milliseconds | No | `30000` |
| `LLM_MAX_TOKENS` | Maximum prompt tokens before truncation | No | `50000` |
| `LLM_MAX_RETRIES` | Number of retries on 5xx LLM errors | No | `1` |
| `KUBECONFIG` | Path to a kubeconfig file. When unset, the Kubernetes tools report offline. | No | — |
| `PROMETHEUS_URL` | Prometheus base URL (enables `query_metrics`). | No | — |
| `LOKI_URL` | Loki base URL (enables `query_logs` / `summarize_errors`). | No | — |
| `ARGOCD_URL` | ArgoCD base URL (enables the ArgoCD tools). | No | — |
| `ARGOCD_TOKEN` | ArgoCD bearer token for API auth. | No | — |
| `GITHUB_TOKEN` | GitHub PAT with `workflow` scope (for planned GitHub Actions connector) | No | — |
| `ARGUS_MONITOR_DB_URL` | Argus Monitor DB connection string (for planned Argus Monitor connector) | No | — |

> **Migration notes**:
> - `KUBECONFIG_PATH` was renamed to `KUBECONFIG`. The old name is still supported with a deprecation warning but will be removed in a future release. Please migrate to `KUBECONFIG`.
> - `ARGOCD_AUTH_TOKEN` was renamed to `ARGOCD_TOKEN`. The old name is still supported with a deprecation warning but will be removed in a future release. Please migrate to `ARGOCD_TOKEN`.

## Architecture

```
┌─────────────┐     ┌──────────────┐     ┌─────────────────┐
│  User/Client │────▶│  Chat API    │────▶│  LlmService     │
│  (curl, UI)  │     │  POST /chat  │     │  (DeepSeek V3   │
└─────────────┘     └──────────────┘     │   + Gemini)     │
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

### `GET /health`

Returns the health status of all connectors and the LLM service.

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2025-01-15T10:30:00.000Z",
  "connectors": {
    "kubernetes": true,
    "prometheus": true,
    "loki": false,
    "argocd": true
  },
  "llm": {
    "status": "ok",
    "latency": 1234
  }
}
```

## Development

### Prerequisites

- Node.js v20+
- npm
- Docker & Docker Compose

### Setup

```bash
# Clone the repo
git clone https://github.com/fatoh2/argus-ai.git
cd argus-ai

# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Start the dev stack (Prometheus, Loki, Grafana)
make up
```

### Makefile Commands

| Command | Description |
|---|---|
| `make up` | Start the full stack (app + dev observability) |
| `make down` | Stop all containers |
| `make check` | Run TypeScript type checking (`tsc --noEmit`) |
| `make test` | Run unit tests |
| `make test-local` | Boot full stack and run integration tests |
| `make logs` | Tail logs from all services |

### Project Structure

```
src/
├── main.ts                          # Application entry point
├── app.module.ts                    # Root module (ConfigModule, feature modules)
├── app.controller.ts                # Health endpoint
├── app.service.ts                   # App-level logic
├── health.service.ts                # Connector health aggregation
├── health.controller.ts             # GET /health endpoint
├── chat/
│   ├── chat.module.ts               # Chat feature module
│   ├── chat.controller.ts           # POST /chat endpoint
│   ├── chat.service.ts              # Chat orchestration
│   └── chat.gateway.ts              # WebSocket gateway (future)
├── connectors/
│   ├── connectors.module.ts         # Connector registration
│   ├── kubernetes.connector.ts      # K8s pod/deployment/namespace queries
│   ├── prometheus/
│   │   └── prometheus.connector.ts  # PromQL instant + range queries
│   ├── loki.connector.ts            # LogQL queries + error summarization
│   ├── argocd.connector.ts          # ArgoCD app status + cluster summary
│   └── utils/
│       └── connector-error.ts       # Structured error helpers
├── llm/
│   ├── llm.module.ts                # LLM feature module
│   ├── llm.service.ts               # LLM orchestration (routing, retry, timeout)
│   ├── llm.controller.ts            # LLM-specific endpoints
│   ├── deepseek/
│   │   ├── deepseek.module.ts
│   │   └── deepseek.service.ts      # DeepSeek V3 API client
│   └── gemini/
│       ├── gemini.module.ts
│       ├── gemini.service.ts        # Gemini API client (fallback)
│       ├── gemini.types.ts
│       └── systemPrompt.ts          # System prompt for the LLM
└── health.service.spec.ts           # Health service tests
```

## Security

See [docs/security.md](docs/security.md) for:
- API key management and rotation
- Connector authentication (bearer tokens, kubeconfig)
- Rate limiting and input validation
- Error log redaction of secrets
- Network security and TLS considerations

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request to the `develop` branch

## License

MIT
