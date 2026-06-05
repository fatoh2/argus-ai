# Argus AI

Argus AI is an intelligent assistant designed to help DevOps teams understand and troubleshoot their infrastructure using natural language. Powered by DeepSeek V3 (with optional Gemini fallback), it connects to your existing Kubernetes, Prometheus, Loki, ArgoCD, and GitHub Actions instances to provide real-time insights, incident summaries, and diagnostic information.

## Features

- **Agentic Kubernetes Tool-Use**: Argus AI can query live Kubernetes clusters — list pods, deployments, namespaces, fetch pod logs, and describe deployments. The LLM decides which tools to call based on your question, executes them, and synthesizes the results into a natural-language answer.
- **Chat Dashboard UI**: A built-in web chat dashboard served at `http://localhost:3000/` — no separate frontend build needed. Just start the app and open your browser.
- **Natural Language Queries**: Interact with your infrastructure using plain English. Ask questions like "What's the status of my web-app deployment?" or "Why did the database pod restart?"
- **Multi-Source Integration**: Seamlessly gathers and correlates data from various infrastructure components including Kubernetes, Prometheus, Loki, ArgoCD, and GitHub Actions.
- **Incident Analysis**: Quickly diagnose issues by summarizing incidents, identifying potential root causes, and suggesting actionable next steps based on aggregated data.
- **Graceful Degradation**: All connectors handle timeouts and failures gracefully — if a service is unreachable, the underlying HTTP request is cancelled via AbortController and the LLM receives a structured error and informs the user instead of crashing.
- **Safe Logging**: Error logs automatically redact API keys, bearer tokens, and secrets — no sensitive credentials leak into log aggregation systems.
- **Input Validation & Sanitization**: The `/chat` endpoint validates message length (max 4000 characters), strips control characters and null bytes, and rejects empty messages with a `400 Bad Request`.
- **Rate Limited API**: The `/chat` endpoint is rate-limited to 20 requests per minute per IP. Rate-limit hits are logged with a hashed IP for monitoring.
- **Real AI Responses**: The `/chat` endpoint is wired to the LLM service — queries return real AI-generated answers powered by DeepSeek V3 (with optional Gemini fallback), not stubs. Chat history is preserved across turns for contextual conversations.
- **LLM Error Resilience**: LLM calls have a 30-second hard timeout (returns `504 Gateway Timeout`), automatic retry on 5xx errors (up to 1 retry), and a 50k-token prompt limit guard that truncates oldest history first. A `GET /health/llm` endpoint provides LLM health monitoring with latency tracking.
- **LLM Error Classification**: LLM errors are mapped to appropriate HTTP status codes — rate limits return `429 Too Many Requests`, auth failures return `401 Unauthorized`, and server errors return `502 Bad Gateway`.
- **Proactive Monitoring (Future)**: Future enhancements will enable Argus AI to proactively identify potential problems and anomalies before they impact users.
- **Extensible Connector Architecture**: Easily add new read-only connectors to integrate with additional tools and platforms. The `ToolRegistryService` provides a central registry for LLM-callable tools — new connectors can be added by registering their schemas and executors.
- **One-Command Setup**: Run `bash scripts/setup.sh` on a fresh clone to check prerequisites (Node.js v20+, npm, Docker), create `.env` from `.env.example`, install dependencies, and pull Docker images — all in one step.
- **Local Dev Stack**: A `docker-compose.dev.yml` provides a complete local observability stack (Prometheus, Loki, Grafana) for testing connectors without a real Kubernetes cluster. A `Makefile` provides one-command shortcuts for common dev tasks (`make up`, `make check`, `make test`, etc.).

## Demo

[Link to demo video/gif]

Argus AI currently supports read-only integration with:

- **Kubernetes**: Pod status, deployments, namespaces, events, and pod logs — queried live via `@kubernetes/client-node`.
- **Prometheus**: Metric queries, historical data, and alert status.
- **Loki**: Log aggregation, searching, and analysis — including error summarization across time ranges.
- **ArgoCD**: Application sync status, health checks, and cluster-wide deployment summaries.
- **GitHub Actions**: Workflow run status, history, and job details.
- **Argus Monitor (Optional)**: Alerts and wallet activity from the Argus Monitor platform.

## Quickstart: Get Argus AI Querying in 10 Minutes

This guide will help any DevOps team point Argus AI at their Kubernetes cluster and start querying within 10 minutes.

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

4.  **Configure environment** (manual alternative):
    ```bash
    cp .env.example .env
    # Edit .env — set DEEPSEEK_API_KEY=your-key-here
    npm install
    ```

5.  **Start the app**:

    **Option A — Dev stack (observability + hot reload)**:
    ```bash
    make up
    ```
    This starts the Docker dev stack (Prometheus, Loki, Grafana) and the NestJS app in watch mode. The app is available at `http://localhost:3000`.

    **Option B — Production stack (Redis + argus-ai)**:
    ```bash
    docker compose up -d
    ```
    This starts Redis and the argus-ai app. The app is available at `http://localhost:3000`.

    **Option C — Node.js only**:
    ```bash
    npm run start:dev
    ```
    This starts the NestJS backend alone. You will need a separate Redis, Prometheus, and Loki instance.

6.  **Open the dashboard**: Navigate to `http://localhost:3000` in your browser. You'll see the Argus AI chat dashboard with example prompts to get started.

7.  **Start Querying!**
    You can interact with Argus AI via the web dashboard or directly via the API:

    ```bash
    curl -X POST http://localhost:3000/chat \
      -H "Content-Type: application/json" \
      -d '{"message": "What pods are running in my cluster?"}'
    ```

    If you have a kubeconfig available, Argus AI will query your live cluster and return real data. Without one, it gracefully reports that the Kubernetes connector is offline.

### Connecting to a Kubernetes Cluster

To let Argus AI query your live Kubernetes cluster:

1. **Export your kubeconfig** to `./.kube/config` in the project root:
   ```bash
   mkdir -p .kube
   cp ~/.kube/config .kube/config
   ```

2. **Set the `KUBECONFIG` environment variable** in `.env`:
   ```
   KUBECONFIG=/kube/config
   ```

3. **Restart the app**. When running via Docker Compose, the `./.kube` directory is automatically mounted into the container at `/kube` (read-only). The connector loads the kubeconfig from `KUBECONFIG` and starts answering live queries.

   > **Security**: The `.kube/` directory is gitignored. Never commit kubeconfig files to the repository.

### Example Queries

Once connected to a cluster, try these:

- *"What pods are running in my cluster?"* — lists all pods with status, ready count, and restarts
- *"How many deployments are in the default namespace?"* — lists deployments with replica counts and images
- *"What namespaces exist?"* — lists all namespaces
- *"Describe the nginx deployment"* — shows replica counts, conditions, and container image
- *"Show me the logs for pod web-app-xyz in default"* — fetches recent log lines

## Architecture

Argus AI uses an **agentic tool-use loop**:

1. User sends a natural-language query to `POST /chat`
2. `LlmService` sends the query to DeepSeek V3 along with tool schemas (from `ToolRegistryService`)
3. The model decides whether to answer directly or call a tool (e.g., `list_pods`, `list_deployments`)
4. If the model requests a tool call, `ToolRegistryService` executes it against the live infrastructure connector
5. The result is fed back to the model, which synthesizes a natural-language answer
6. The loop repeats (up to 5 iterations) until the model produces a final answer

All connectors are strictly read-only. The tool schemas are defined in `ToolRegistryService` and can be extended to support Prometheus, Loki, ArgoCD, and other connectors.

## Project Structure

```
src/
  app.module.ts           # Root module — ConfigModule (global), ChatModule, LlmModule, ConnectorsModule
  app.controller.ts       # Health check endpoint
  app.service.ts          # Core application service
  main.ts                 # Bootstrap — global ValidationPipe with whitelist, serves public/ dashboard
  chat/                   # Chat API module (REST endpoint)
    chat.controller.ts    # POST /chat — input sanitization (strips control chars)
    chat.module.ts        # ThrottlerModule (20 req/min) + ChatRateLimitGuard
    chat-rate-limit.guard.ts  # Custom rate limit guard with hashed IP logging
    dto/
      chat.dto.ts         # ChatDto — IsString, MaxLength(4000)
  connectors/
    connectors.module.ts  # Registers and exports all connectors
    utils/
      connector-error.ts  # Graceful degradation utility (timeout + AbortController + structured errors + log sanitization)
    kubernetes.connector.ts  # Real K8s connector via @kubernetes/client-node (listPods, listDeployments, listNamespaces, describeDeployment, getPodLogs)
    loki.connector.ts     # LogQL query wrapper
    argocd.connector.ts   # ArgoCD API client
  llm/                    # LLM integration (DeepSeek V3 primary, Gemini optional fallback)
    llm.module.ts         # LlmModule — imports DeepSeekModule + GeminiModule, registers LlmService
    llm.service.ts        # LlmService — tool-use loop with 30s timeout, retry, token guard
    llm.controller.ts     # GET /health/llm — LLM health check endpoint
    deepseek/             # DeepSeek V3 API client (primary LLM) with agentic tool-use loop
    gemini/               # Google Gemini API client (optional fallback)
    tools/
      tool-registry.service.ts  # Central registry of LLM-callable tool schemas + executor
  health/                 # Health check module
    health.controller.ts  # GET /health — overall system health
    health.service.ts     # Health check logic
  public/                 # Static assets served by the app
    index.html            # Chat dashboard UI (vanilla JS, no build step)
```

## Configuration

See [docs/configuration.md](docs/configuration.md) for full configuration reference.

Key environment variables:

| Variable | Description | Required |
|---|---|---|
| `DEEPSEEK_API_KEY` | DeepSeek V3 API key (primary LLM) | **Yes** |
| `KUBECONFIG` | Path to kubeconfig file for live cluster queries | No |
| `GEMINI_API_KEY` | Google Gemini API key (optional fallback) | No |

## Development

See [docs/development.md](docs/development.md) for local development setup and testing.

## Security

See [docs/security.md](docs/security.md) for security best practices.
