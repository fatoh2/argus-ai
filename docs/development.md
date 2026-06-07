# Development Guide

This guide provides instructions for setting up your development environment, running Argus AI locally, adding new features, and testing.

## Local Development Setup

1.  **Clone the repository**:
    ```bash
    git clone https://github.com/fatoh2/argus-ai.git
    cd argus-ai
    ```

    > **Note**: The `.gitignore` includes `argus-ai/` to prevent accidental nested clones by automation agents. If you see this directory, it is a stray artifact and can be safely deleted.

2.  **One-command setup (optional but recommended)**:
    ```bash
    bash scripts/setup.sh
    ```
    This checks prerequisites (Node.js v20+, npm, Docker), creates `.env` from `.env.example`, installs npm dependencies, and pulls Docker images for the dev stack. After it completes, skip ahead to step 6.

    > **Note**: If you prefer to configure things manually, follow steps 3–7 instead.

3.  **Install dependencies** (manual alternative):
    ```bash
    npm install
    ```

4.  **Makefile shortcuts (recommended)**:

    A `Makefile` provides one-command shortcuts for common development tasks. After installing dependencies, you can use:

    ```bash
    make help    # Show all available commands
    make up      # Start Docker dev stack + NestJS watch mode
    make down    # Stop Docker dev stack
    make check   # Type-check + lint (tsc --noEmit && npm run lint)
    make test    # Run tests (npm test)
    make chat MSG="hello"  # Send a message to the chat API
    make health  # Check LLM health endpoint (GET /health/llm)
    make logs    # Tail Docker logs
    ```

    The `make up` command runs `docker compose -f docker-compose.dev.yml up -d` followed by `npm run start:dev`, so it starts the full observability stack and the NestJS app in one step.

    > **Prerequisite**: `make` is typically pre-installed on Linux and macOS. Verify with `make --version`. If missing, install via `sudo apt-get install -y build-essential` (Linux) or Xcode Command Line Tools (macOS).

5.  **Configure Environment**: 
    Copy `config.example.yaml` to `config.yaml` and fill in placeholder values. For local development, you can use local instances of Prometheus, Loki, etc., or mock their responses.
    ```bash
    cp config.example.yaml config.yaml
    # Edit config.yaml
    ```
    **Never commit `config.yaml` to Git!**

    You can also use a `.env` file for environment variables. The app uses `@nestjs/config` which loads `.env` automatically. Copy `.env.example` to `.env` and fill in your DeepSeek API key:

    ```bash
    cp .env.example .env
    # Edit .env — set DEEPSEEK_API_KEY=your-key-here
    ```

    To enable Kubernetes tool-use, set `KUBECONFIG` in your `.env`:
    ```
    KUBECONFIG=/path/to/your/kubeconfig
    ```

6.  **Run Locally with Docker Compose**:

    The `docker-compose.dev.yml` file provides a complete local observability stack so you can test connectors without a real Kubernetes cluster. The production `docker-compose.yml` also includes Prometheus, Loki, and Promtail services for integrated observability in production deployments.

    ```bash
    # Start the full stack (or use `make up` for one-command start)
    docker compose -f docker-compose.dev.yml up -d
    ```

    This starts the following services:

    | Service | Image | Port | Purpose |
    |---------|-------|------|---------|
    | argus-ai | local build | 3000 | NestJS app, auto-wired to local Prometheus/Loki |
    | prometheus | prom/prometheus:latest | 9090 | Self-scraping metrics, also scrapes argus-ai |
    | loki | grafana/loki:latest | 3100 | Log aggregation |
    | promtail | grafana/promtail:latest | — | Ships host logs to Loki |
    | grafana | grafana/grafana:latest | 3001 | Visualises Prometheus + Loki (auto-provisioned datasources) |

    > **Note**: The production `docker-compose.yml` also includes Prometheus, Loki, and Promtail (without Grafana) for production deployments. The dev stack adds Grafana for visualization.

    **Verify the stack is running**:
    ```bash
    # Prometheus
    curl http://localhost:9090/-/healthy

    # Loki
    curl http://localhost:3100/ready

    # Grafana (open in browser)
    open http://localhost:3001
    ```

    The app is auto-configured via environment variables in `docker-compose.dev.yml`:
    - `PROMETHEUS_URL=http://prometheus:9090`
    - `LOKI_URL=http://loki:3100`

    > **Security Note**: Grafana uses anonymous admin access (`GF_AUTH_ANONYMOUS_ENABLED=true`, `GF_AUTH_ANONYMOUS_ORG_ROLE=Admin`) for dev convenience. This is acceptable only on a trusted local machine. Never deploy the dev docker-compose file to production. See [Security Best Practices](security.md) for details.

    **Stop the stack**:
    ```bash
    docker compose -f docker-compose.dev.yml down
    # Or use: make down
    ```

7.  **Run Locally without Docker (Node.js only)**:

    To start just the NestJS backend without the observability stack:
    ```bash
    npm run start:dev
    ```
    The backend will run on `http://localhost:3000`. You will need a separate Prometheus and Loki instance (or mock their responses).

    > **Note**: The `/chat` endpoint is rate-limited to 20 requests per minute per IP. During development, you can test this by sending 21 requests within 60 seconds — the 21st should return `429 Too Many Requests` with a `Retry-After` header. Rate limit hits are logged with a hashed IP and timestamp.

## Testing Kubernetes Tool-Use Locally

To test the agentic tool-use feature against a real Kubernetes cluster:

1. **Set up a local cluster** (e.g., k3d, kind, minikube):
   ```bash
   # Example with k3d
   k3d cluster create argus-test
   ```

2. **Export your kubeconfig**:
   ```bash
   k3d kubeconfig merge argus-test -d ~/.kube/config 2>/dev/null || true
   export KUBECONFIG=~/.kube/config
   ```

3. **Run the app**:
   ```bash
   npm run start:dev
   ```

4. **Send a query**:
   ```bash
   curl -X POST http://localhost:3000/chat \
       -H "Content-Type: application/json" \
       -d '{"message": "What pods are running?"}'
   ```

   The LLM will call `list_pods`, get real pod data, and return a formatted response.

## Project Structure

```
scripts/
  setup.sh              # One-command local setup (prerequisites, .env, deps, Docker images)
Makefile                   # Dev command shortcuts (make up, make check, make test, etc.)
docker-compose.dev.yml     # Local dev stack: argus-ai + Prometheus + Loki + Grafana
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
  app.module.ts           # Root module — registers ConfigModule (global), ChatModule, LlmModule, ConnectorsModule
  app.controller.ts       # Health check endpoint
  app.service.ts          # Core application service
  main.ts                 # Bootstrap — global ValidationPipe with whitelist + forbidNonWhitelisted
  chat/                   # Chat API module (REST endpoint)
    chat.controller.ts    # POST /chat — input sanitization (strips control chars)
    chat.module.ts        # ThrottlerModule (20 req/min) + ChatRateLimitGuard
    chat-rate-limit.guard.ts  # Custom rate limit guard with hashed IP logging
    dto/
      chat.dto.ts         # ChatDto — IsString, MaxLength(4000)
  connectors/             # Read-only infrastructure connectors
    connectors.module.ts  # Registers and exports all connectors
    kubernetes.connector.ts  # Real K8s API client via @kubernetes/client-node
    prometheus/
      prometheus.connector.ts  # PromQL query wrapper
    loki.connector.ts     # LogQL query wrapper
    argocd.connector.ts   # ArgoCD API client
    utils/
      connector-error.ts  # Graceful degradation utility (timeout + AbortController + structured errors + log sanitization)
  llm/                    # LLM integration with agentic tool-use
    llm.module.ts         # LlmModule — imports DeepSeekModule + GeminiModule + ConnectorsModule
    llm.service.ts        # LlmService — wires tools into every chat call
    llm.controller.ts     # GET /health/llm — LLM health check endpoint
    deepseek/             # DeepSeek V3 API client (primary LLM)
      deepseek.service.ts # Agentic loop: sends tools, executes tool_calls, feeds results back (max 5 iterations)
    gemini/               # Google Gemini API client (optional fallback)
    tools/
      tool-registry.service.ts  # Tool schemas + executor — routes tool calls to connectors
config.example.yaml       # Template — copy to config.yaml, never commit config.yaml
```

## Adding a New Tool

To add a new LLM-callable tool:

1. **Add a method to the relevant connector** (e.g., `KubernetesConnector.listDeployments()`)
2. **Register the tool in `ToolRegistryService`** — add a schema to `getToolSchemas()` and a case to `executeTool()`
3. **Write tests** for both the connector method and the tool execution path

## Testing

### Running Tests

```bash
# Run all tests
npm test

# Type-check only
npx tsc --noEmit

# Full check (type-check + lint)
make check
```

### Writing Tests

- Tests use Jest with `@nestjs/testing` and mocked `ConfigService`
- Connector tests should test both online and offline modes
- LLM tests should mock the HTTP layer (use `nock` or `jest.spyOn` on `fetch`)
- Tool registry tests should verify schema structure and execution routing

## Architecture Overview

### Agentic Tool-Use Flow

```
User Query → POST /chat → LlmService → DeepSeekService.chat()
                                              │
                                    ┌─────────▼─────────┐
                                    │  Send query +     │
                                    │  tool schemas to   │
                                    │  DeepSeek API      │
                                    └─────────┬─────────┘
                                              │
                                    ┌─────────▼─────────┐
                                    │ Model responds     │
                                    │ with tool_calls?   │
                                    └─────────┬─────────┘
                                              │
                                   Yes ┌──────┴──────┐ No
                                      ▼               ▼
                           ┌─────────────────┐   ┌──────────┐
                           │ Execute tool via │   │ Return   │
                           │ ToolRegistry     │   │ final    │
                           │ → Connector      │   │ response │
                           └────────┬────────┘   └──────────┘
                                    │
                           ┌────────▼────────┐
                           │ Feed result back │
                           │ to model (loop)  │
                           │ max 5 iterations │
                           └─────────────────┘
```

### Graceful Degradation

All connectors follow the same pattern:
- If the required environment variable is not set → offline mode (no network calls)
- If the API is unreachable → structured error response (not a crash)
- All HTTP requests use AbortController with a 10-second timeout
- Error logs redact sensitive information automatically
