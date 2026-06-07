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

    To enable ArgoCD tool-use, set `ARGOCD_URL` and `ARGOCD_TOKEN` in your `.env`:
    ```
    ARGOCD_URL=https://argocd.example.com
    ARGOCD_TOKEN=your-argocd-token
    ```

6.  **Run Locally with Docker Compose**:

    The `docker-compose.dev.yml` file provides a complete local observability stack so you can test connectors without a real Kubernetes cluster.

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
       -d '{"message": "What pods are running in my cluster?"}'
   ```

## Testing ArgoCD Tool-Use Locally

To test the agentic ArgoCD tool-use feature:

1. **Set up a local ArgoCD instance** (e.g., in k3d):
   ```bash
   # Create a cluster with ArgoCD
   k3d cluster create argus-test
   kubectl create namespace argocd
   kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml
   ```

2. **Get the ArgoCD admin password**:
   ```bash
   kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath="{.data.password}" | base64 -d
   ```

3. **Generate an API token**:
   ```bash
   argocd login localhost:8080 --username admin --password <password>
   argocd account generate-token --account admin
   ```

4. **Set environment variables**:
   ```bash
   export ARGOCD_URL=https://localhost:8080
   export ARGOCD_TOKEN=your-generated-token
   ```

5. **Run the app**:
   ```bash
   npm run start:dev
   ```

6. **Send a query**:
   ```bash
   curl -X POST http://localhost:3000/chat \
       -H "Content-Type: application/json" \
       -d '{"message": "What ArgoCD applications are deployed?"}'
   ```

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
  connectors/
    connectors.module.ts  # Registers and exports all connectors
    utils/
      connector-error.ts  # Graceful degradation utility (timeout + AbortController + structured errors + log sanitization)
      connector-error.spec.ts  # Tests for error handling utility
    k8s-prometheus.connector.ts
    kubernetes.connector.ts  # Real K8s connector via @kubernetes/client-node
    loki.connector.ts     # LogQL query wrapper
    argocd.connector.ts   # ArgoCD API client
  llm/                    # LLM integration (DeepSeek V3 primary, Gemini optional fallback)
    llm.module.ts         # LlmModule — imports DeepSeekModule + GeminiModule, registers LlmService
    llm.service.ts        # LlmService — tool-use loop with 30s timeout, retry, token guard
    llm.service.spec.ts   # Tests for LlmService
    llm.controller.ts     # GET /health/llm — LLM health check endpoint (returns 200 if LLM is responsive)
    llm.controller.spec.ts# Tests for LlmController
    deepseek/             # DeepSeek V3 API client (primary LLM)
      deepseek.service.ts # Agentic loop: sends tools, executes tool_calls, feeds results back (max 5 iterations)
    gemini/               # Google Gemini API client (optional fallback)
    tools/
      tool-registry.service.ts  # Central registry of LLM-callable tool schemas + executor
      tool-registry.service.spec.ts  # Tests for ToolRegistryService
  public/                 # Static assets served by the app
    index.html            # Chat dashboard UI (vanilla JS, no build step)
config.example.yaml       # Template — copy to config.yaml, never commit config.yaml
```

## Adding a New Connector

1. Create a new file in `src/connectors/` (e.g., `my-service.connector.ts`)
2. Implement the connector as an `@Injectable()` class with:
   - `isHealthy(): Promise<boolean>` for health checks
   - Read-only methods wrapped with `withConnectorErrorHandling('<name>', ...)`
3. Register the connector in `ConnectorsModule` (providers + exports)
4. Add a tool schema in `ToolRegistryService.getToolSchemas()` and a case in `executeTool()`
5. Add configuration to `config.example.yaml` and document in `.env.example`
6. Write unit tests (Jest) for the connector and tool registry entries

## Running Tests

```bash
# Run all tests
npm test

# Run specific test file
npx jest --testPathPattern="argocd.connector"

# Run with coverage
npm test -- --coverage
```

## Code Quality

```bash
# TypeScript type-check
npx tsc --noEmit

# Lint
npm run lint

# Both (via Makefile)
make check
```
