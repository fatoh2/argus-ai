# Argus AI

Argus AI is an intelligent assistant designed to help DevOps teams understand and troubleshoot their infrastructure using natural language. Powered by DeepSeek V3 (with optional Gemini fallback), it connects to your existing Kubernetes, Prometheus, Loki, ArgoCD, and GitHub Actions instances to provide real-time insights, incident summaries, and diagnostic information.

## Features

- **Built-in Chat Dashboard**: A web chat UI is served at `http://localhost:3000/` — no separate frontend build step. Just open the URL in a browser and start asking questions. The dashboard features message bubbles, a live `/health` status indicator, clickable example prompts, and code-block rendering.
- **Natural Language Queries**: Interact with your infrastructure using plain English. Ask questions like "What's the status of my web-app deployment?" or "Why did the database pod restart?"
- **Multi-Source Integration**: Seamlessly gathers and correlates data from various infrastructure components including Kubernetes, Prometheus, Loki, ArgoCD, and GitHub Actions.
- **Incident Analysis**: Quickly diagnose issues by summarizing incidents, identifying potential root causes, and suggesting actionable next steps based on aggregated data.
- **Graceful Degradation**: All connectors handle missing environment variables, timeouts, and failures gracefully — if a service is unreachable or unconfigured, the connector operates in offline mode and returns structured empty/offline results instead of crashing. The LLM receives a clear message that the service is unavailable. The Gemini fallback LLM is also optional — if `GEMINI_API_KEY` is not set, the service marks itself unavailable at startup instead of crashing the entire application.
- **Safe Logging**: Error logs automatically redact API keys, bearer tokens, and secrets — no sensitive credentials leak into log aggregation systems.
- **Input Validation & Sanitization**: The `/chat` endpoint validates message length (max 4000 characters), strips control characters and null bytes, and rejects empty messages with a `400 Bad Request`.
- **Rate Limited API**: The `/chat` endpoint is rate-limited to 20 requests per minute per IP. Rate-limit hits are logged with a hashed IP for monitoring.
- **Real AI Responses**: The `/chat` endpoint is wired to the LLM service — queries return real AI-generated answers powered by DeepSeek V3 (with truly optional Gemini fallback — gracefully skipped if `GEMINI_API_KEY` is not set), not stubs. Chat history is preserved across turns for contextual conversations.
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
    This checks prerequisites (Node.js v20+, npm, Docker), creates `.env` from `.env.example`, installs dependencies, and pulls Docker images. After it completes, skip ahead to step 6.

    > **Note**: If you prefer to configure things manually, follow steps 4–7 instead.

4.  **Install dependencies** (manual alternative):
    ```bash
    npm install
    ```

5.  **Configure Environment**:
    Copy `.env.example` to `.env` and fill in your DeepSeek API key:
    ```bash
    cp .env.example .env
    # Edit .env — set DEEPSEEK_API_KEY=your-key-here
    ```

    > **Note**: Only `DEEPSEEK_API_KEY` is required. The Gemini fallback (`GEMINI_API_KEY`) is optional — if left unset, the app boots normally and uses DeepSeek as the sole LLM.

6.  **Run with Docker Compose**:
    ```bash
    docker compose up -d --build
    ```

    This starts Redis (for queue/job processing) and the Argus AI app. The app waits for Redis to be healthy before starting.

7.  **Open the Chat Dashboard**:
    ```bash
    # Open in your browser
    open http://localhost:3000
    ```
    You'll see the Argus AI chat dashboard — a dark-themed UI with a live health status indicator and clickable example prompts. Start typing your infrastructure questions.

    You can also verify the API directly:
    ```bash
    curl http://localhost:3000/health
    ```

## API Reference

### `GET /`
Serves the Argus AI chat dashboard — a single-page web UI for interacting with the assistant via a browser.

### `POST /chat`
Send a natural language query to Argus AI.

**Request body**:
```json
{
  "message": "What is the status of my web-app deployment?"
}
```

**Response**: Returns the AI-generated answer as a JSON object with the assistant's reply.

**Rate limit**: 20 requests per minute per IP.

### `GET /health`
Returns a detailed health report with per-connector status.

### `GET /health/llm`
Returns LLM health status with latency tracking.

## Architecture

Argus AI is a NestJS application that:

1.  **Serves a chat dashboard** at `GET /` via `NestExpressApplication.useStaticAssets()` — the UI is a single `public/index.html` file with vanilla JavaScript (no build step, no framework).
2.  **Accepts natural language queries** via `POST /chat` — validates and sanitizes input, then routes to the LLM service.
3.  **Routes queries to the LLM** (DeepSeek V3 primary, Gemini fallback) — the LLM decides which connectors to call and synthesizes the results.
4.  **Connects to infrastructure** via read-only connectors (Kubernetes, Prometheus, Loki, ArgoCD, GitHub Actions) — each connector wraps API calls with graceful degradation and structured error handling.

## Project Structure

```
.dockerignore              # Prevents node_modules, .env, dist from entering Docker images
docker-compose.yml         # Production stack: Redis + argus-ai with healthchecks
docker-compose.dev.yml     # Local dev stack: argus-ai + Prometheus + Loki + Grafana
Dockerfile                 # Multi-stage build (npm ci, curl for healthcheck, cache clean)
.env.example               # Template — copy to .env, never commit .env
public/
  index.html               # Chat dashboard UI (vanilla JS, served at /)
scripts/
  setup.sh                 # One-command local setup (prerequisites, .env, deps, Docker images)
Makefile                   # Dev command shortcuts (make up, make check, make test, etc.)
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
  main.ts                  # Bootstrap — NestExpressApplication with useStaticAssets for dashboard
  app.module.ts            # Root module
  ...
```

## Development

See [docs/development.md](docs/development.md) for local development setup, testing, and contribution guidelines.

## Configuration

See [docs/configuration.md](docs/configuration.md) for all configuration options.

## Security

See [docs/security.md](docs/security.md) for security best practices.
