# Argus AI

Argus AI is an intelligent assistant designed to help DevOps teams understand and troubleshoot their infrastructure using natural language. Powered by DeepSeek V3 (with optional Gemini fallback), it connects to your existing Kubernetes, Prometheus, Loki, ArgoCD, and GitHub Actions instances to provide real-time insights, incident summaries, and diagnostic information.

## Features

- **Natural Language Queries**: Interact with your infrastructure using plain English. Ask questions like "What's the status of my web-app deployment?" or "Why did the database pod restart?"
- **Multi-Source Integration**: Seamlessly gathers and correlates data from various infrastructure components including Kubernetes, Prometheus, Loki, ArgoCD, and GitHub Actions.
- **Incident Analysis**: Quickly diagnose issues by summarizing incidents, identifying potential root causes, and suggesting actionable next steps based on aggregated data.
- **Graceful Degradation**: All connectors handle missing environment variables, timeouts, and failures gracefully — if a service is unreachable or unconfigured, the connector operates in offline mode and returns structured empty/offline results instead of crashing. The LLM receives a clear message that the service is unavailable.
- **Safe Logging**: Error logs automatically redact API keys, bearer tokens, and secrets — no sensitive credentials leak into log aggregation systems.
- **Input Validation & Sanitization**: The `/chat` endpoint validates message length (max 4000 characters), strips control characters and null bytes, and rejects empty messages with a `400 Bad Request`.
- **Rate Limited API**: The `/chat` endpoint is rate-limited to 20 requests per minute per IP. Rate-limit hits are logged with a hashed IP for monitoring.
- **Real AI Responses**: The `/chat` endpoint is wired to the LLM service — queries return real AI-generated answers powered by DeepSeek V3 (with optional Gemini fallback), not stubs. Chat history is preserved across turns for contextual conversations.
- **LLM Error Resilience**: LLM calls have a 30-second hard timeout (returns `504 Gateway Timeout`), automatic retry on 5xx errors (up to 1 retry), and a 50k-token prompt limit guard that truncates oldest history first. A `GET /health/llm` endpoint provides LLM health monitoring with latency tracking.
- **LLM Error Classification**: LLM errors are mapped to appropriate HTTP status codes — rate limits return `429 Too Many Requests`, auth failures return `401 Unauthorized`, and server errors return `502 Bad Gateway`.
- **Proactive Monitoring (Future)**: Future enhancements will enable Argus AI to proactively identify potential problems and anomalies before they impact users.
- **Extensible Connector Architecture**: Easily add new read-only connectors to integrate with additional tools and platforms.
- **One-Command Setup**: Run `bash scripts/setup.sh` on a fresh clone to check prerequisites (Node.js v20+, npm, Docker), create `.env` from `.env.example`, install dependencies, and pull Docker images — all in one step.
- **Local Dev Stack**: A `docker-compose.dev.yml` provides a complete local observability stack (Prometheus, Loki, Grafana) for testing connectors without a real Kubernetes cluster. A `Makefile` provides one-command shortcuts for common dev tasks (`make up`, `make check`, `make test`, `make test-local`, `make clean`, etc.).
- **Production Stack**: A `docker-compose.yml` provides the production stack with Redis (redis:7) for queue/job processing. The app waits for Redis to be healthy before starting, and both services have Docker healthchecks configured.
- **Health Endpoint**: `GET /health` returns a detailed health report with per-connector status (`ok`/`degraded`/`unhealthy`) — used by Docker healthchecks and load balancers. Each connector reports its own health via `isHealthy()`. The LLM has a dedicated `GET /health/llm` endpoint with latency tracking.
- **Integration Tests**: Real integration tests boot the full Docker stack, hit the `/health` endpoint, and verify chat input validation end-to-end.
- **`.dockerignore`**: Prevents `node_modules`, `dist`, `.env`, and test artifacts from being copied into Docker images, keeping builds lean and secure.

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
    Copy `config.example.yaml` to `config.yaml`. This file defines the structure for your connector configurations.
    ```bash
    cp config.example.yaml config.yaml
    ```
    **Sensitive fields (like API keys and tokens) in `config.yaml` are designed to be populated via environment variables (e.g., `${DEEPSEEK_API_KEY}`). Set these environment variables in your shell or a `.env` file.**
    **Never commit `config.yaml` to Git if it contains sensitive information!**

    For a quick start with Kubernetes, Prometheus, and Loki, ensure your `config.yaml` has the correct URLs (e.g., for Prometheus and Loki if they are not on localhost) and any necessary authentication details. For Kubernetes, if running in-cluster, you should remove or comment out the `kubeconfig_path` line.

5.  **Install dependencies**:
    ```bash
    npm install
    ```

6.  **Run locally (for development/testing)**:

    **Option A — Makefile (recommended, includes full observability stack)**:
    ```bash
    make up
    ```
    This starts the Docker dev stack (Prometheus, Loki, Grafana) and the NestJS app in watch mode. See the [Development Guide](docs/development.md) for more options.

    **Option B — Production stack (Redis + argus-ai)**:
    ```bash
    docker compose up -d
    ```
    This starts Redis and the argus-ai app with healthchecks. Verify with:
    ```bash
    curl http://localhost:3000/health
    # {"status":"ok","timestamp":"2025-01-01T00:00:00.000Z","connectors":{"kubernetes":true,"prometheus":true,"loki":true,"argocd":true}}
    ```

    **Option C — Node.js only**:
    ```bash
    npm run start:dev
    ```
    This will start the NestJS backend alone, typically on `http://localhost:3000`. You will need a separate Redis, Prometheus, and Loki instance.

7.  **Start Querying!**
    Once the backend is running, you can interact with Argus AI via its API (e.g., using `curl` or a simple client). For example, to query your Kubernetes cluster:

    ```bash
    curl -X POST http://localhost:3000/chat \
        -H "Content-Type: application/json" \
        -d '{"message": "What is the status of my web-app deployment?"}'
    ```

    **Note**: The `/chat` endpoint is rate-limited to 20 requests per minute per IP. If you exceed this limit, you will receive a `429 Too Many Requests` response with a `Retry-After` header.


## Environment Variables

| Variable | Description | Required | Default |
|---|---|---|---|
| `DEEPSEEK_API_KEY` | DeepSeek V3 API key (primary LLM) | **Yes** | — |
| `DEEPSEEK_MODEL` | DeepSeek model override (optional) | No | `deepseek-chat` |
| `DEEPSEEK_URL` | DeepSeek API endpoint override (optional) | No | `https://api.deepseek.com/chat/completions` |
| `GEMINI_API_KEY` | Google Gemini API key (optional fallback) | No | — |
| `REDIS_URL` | Redis connection string for queue/job processing | No | `redis://localhost:6379` |
| `LLM_TIMEOUT_MS` | LLM call timeout in milliseconds | No | `30000` |
| `LLM_MAX_TOKENS` | Maximum prompt tokens before truncation | No | `50000` |
| `LLM_MAX_RETRIES` | Number of retries on 5xx LLM errors | No | `1` |
| `KUBECONFIG` | Path to kubeconfig file | No | (empty — in-cluster config) |
| `PROMETHEUS_URL` | Prometheus URL | No | (empty — offline mode) |
| `LOKI_URL` | Loki URL | No | (empty — offline mode) |
| `ARGOCD_URL` | ArgoCD URL | No | (empty — offline mode) |
| `ARGOCD_TOKEN` | ArgoCD auth token | No | (empty — offline mode) |
| `GITHUB_TOKEN` | GitHub PAT with `workflow` scope | No | — |
| `ARGUS_MONITOR_DB_URL` | Argus Monitor DB connection string | No | — |

## Makefile Commands

| Command | Description |
|---|---|
| `make up` | Start Docker dev stack + NestJS watch mode |
| `make down` | Stop Docker dev stack |
| `make clean` | Stop and remove all containers, networks, and volumes |
| `make check` | Type-check (`tsc --noEmit`) + lint |
| `make test` | Run all tests (`jest --forceExit`) |
| `make test-local` | Boot full stack → health check → tsc → tests → teardown |
| `make chat MSG="hello"` | Send a message to the chat API |
| `make health` | Check LLM health endpoint (`GET /health/llm`) |
| `make logs` | Tail Docker logs |
| `make help` | Show all available commands |

## Project Structure

```
.dockerignore              # Prevents node_modules, .env, dist from entering Docker images
docker-compose.yml         # Production stack: Redis + argus-ai with healthchecks
docker-compose.dev.yml     # Local dev stack: argus-ai + Prometheus + Loki + Grafana
Dockerfile                 # Multi-stage build (npm ci, curl for healthcheck, cache clean)
.env.example               # Template — copy to .env, never commit .env
scripts/
  setup.sh                 # One-command local setup (prerequisites, .env, deps, Docker images)
Makefile                   # Dev command shortcuts
docker/
  prometheus/
    prometheus.yml         # Prometheus config — scrapes itself + argus-ai
  promtail/
    promtail.yml           # Promtail config — ships /var/log/*.log to Loki
  grafana/
    datasources/
      datasources.yaml     # Auto-provisioned Prometheus + Loki datasources
    dashboards/
      dashboards.yaml      # Dashboard provisioning config
src/
  app.controller.ts        # GET / — root endpoint (hello)
  health.controller.ts    # GET /health — detailed health report (ok/degraded/unhealthy)
  health.service.ts       # Aggregates connector health checks
  chat/
    chat.integration.spec.ts  # Integration tests (boots stack, hits /health, validates chat)
  llm/deepseek/
    deepseek.service.spec.ts  # Unit tests for DeepSeek API client
```

## Documentation

- [Development Guide](docs/development.md) — local setup, testing, project structure
- [Configuration](docs/configuration.md) — environment variables and config.yaml reference
- [Connectors](docs/connectors.md) — Kubernetes, Prometheus, Loki, ArgoCD, GitHub Actions
- [Example Queries](docs/examples.md) — natural language query examples
- [Security Best Practices](docs/security.md) — deployment security, input validation, safe logging

## License

MIT
