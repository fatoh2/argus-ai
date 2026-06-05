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
    make clean   # Stop and remove all containers, networks, and volumes
    make check   # Type-check + lint (tsc --noEmit && npm run lint)
    make test    # Run tests (jest --forceExit)
    make test-local  # Boot full stack, run tsc + tests, hit /health endpoint
    make chat MSG="hello"  # Send a message to the chat API
    make health  # Check LLM health endpoint (GET /health/llm)
    make logs    # Tail Docker logs
    ```

    The `make up` command runs `docker compose -f docker-compose.dev.yml up -d` followed by `npm run start:dev`, so it starts the full observability stack and the NestJS app in one step.

    The `make test-local` command boots the production `docker-compose.yml` stack (Redis + argus-ai), waits for the `/health` endpoint to respond, runs `tsc --noEmit`, runs `npm test`, then tears everything down. This is the gate for CI — do not open a PR if `make test-local` fails.

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

    > **Note**: Only `DEEPSEEK_API_KEY` is required. The Gemini fallback (`GEMINI_API_KEY`) is optional — if left unset, the app boots normally and uses DeepSeek as the sole LLM. No crash, no error.

6.  **Run Locally with Docker Compose**:

    **Option A — Dev stack (observability + hot reload)**:
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
    # App health
    curl http://localhost:3000/health

    # Open the chat dashboard in your browser
    open http://localhost:3000

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

    **Option B — Production stack (Redis + argus-ai)**:
    The `docker-compose.yml` file provides the production stack with Redis for queue/job processing.

    ```bash
    docker compose up -d
    ```

    This starts:

    | Service | Image | Port | Purpose |
    |---------|-------|------|---------|
    | redis | redis:7 | 6379 | Queue/job processing backend |
    | argus-ai | local build | 3000 | NestJS app with healthcheck |

    The app waits for Redis to be healthy before starting. Both services have Docker healthchecks configured.

    **Verify**:
    ```bash
    curl http://localhost:3000/health
    # {"status":"ok","timestamp":"2025-01-01T00:00:00.000Z","connectors":{"kubernetes":true,"prometheus":true,"loki":true,"argocd":true}}
    ```

    **Stop**:
    ```bash
    docker compose down
    # Or use: make clean  (removes volumes too)
    ```

8.  **Open the Chat Dashboard**:
    Navigate to `http://localhost:3000` in your browser. The chat dashboard is served as a static HTML/JS file — no separate frontend build step required. You'll see example prompts and a live health status indicator.

9.  **Start Querying!**
    Once the backend is running, you can interact with Argus AI via the web dashboard or its API:

    ```bash
    curl -X POST http://localhost:3000/chat \
        -H "Content-Type: application/json" \
        -d '{"message": "What is the status of my web-app deployment?"}'
    ```

    > **Note**: The `/chat` endpoint is rate-limited to 20 requests per minute per IP. If you exceed this limit, you will receive a `429 Too Many Requests` response with a `Retry-After` header.

7.  **Run Locally without Docker (Node.js only)**:

    To start just the NestJS backend without the observability stack:
    ```bash
    npm run start:dev
    ```
    The backend will run on `http://localhost:3000`. You will need a separate Redis, Prometheus, and Loki instance (or mock their responses).

    > **Note**: The `/chat` endpoint is rate-limited to 20 requests per minute per IP. During development, you can test this by sending 21 requests within 60 seconds — the 21st should return `429 Too Many Requests` with a `Retry-After` header. Rate limit hits are logged with a hashed IP and timestamp.

## Testing

Argus AI uses **Jest** with `ts-jest` for testing. Tests are co-located with source files as `*.spec.ts` files.

### Running Tests

```bash
# Run all tests
make test
# or
npm test

# Run with coverage
npm run test:cov

# Run in watch mode
npm run test:watch
```

### Integration Tests

Integration tests are in `src/chat/chat.integration.spec.ts`. They boot the full Docker stack, hit the `/health` endpoint, and validate chat input validation end-to-end.

To run integration tests locally:
```bash
make test-local
```

This command:
1. Boots `docker-compose.yml` (Redis + argus-ai)
2. Waits for the `/health` endpoint to respond (up to 60s)
3. Runs `tsc --noEmit`
4. Runs `npm test`
5. Tears down all containers and volumes

### Test Files

| File | Type | What it tests |
|---|---|---|
| `src/chat/chat.integration.spec.ts` | Integration | `GET /health`, `POST /chat` validation (empty, too long, missing body) |
| `src/llm/deepseek/deepseek.service.spec.ts` | Unit | DeepSeek API payload building, success/error responses, history inclusion |
| `src/llm/llm.service.spec.ts` | Unit | LLM service tool-use loop, timeout, retry, token guard |
| `src/llm/llm.controller.spec.ts` | Unit | LLM health check endpoint |
| `src/connectors/utils/connector-error.spec.ts` | Unit | Graceful degradation utility (timeout, error handling, log sanitization) |
| `src/connectors/kubernetes.connector.spec.ts` | Unit | Kubernetes connector methods |
| `src/connectors/prometheus/prometheus.connector.spec.ts` | Unit | Prometheus connector methods |

### `--forceExit`

The `test` script uses `jest --forceExit` to handle NestJS open handles that persist after integration tests complete. This is safe because all tests are self-contained and clean up after themselves.

## Project Structure

```
.dockerignore              # Prevents node_modules, .env, dist from entering Docker images
docker-compose.yml         # Production stack: Redis + argus-ai with healthchecks
docker-compose.dev.yml     # Local dev stack: argus-ai + Prometheus + Loki + Grafana
Dockerfile                 # Multi-stage build (npm ci, curl for healthcheck, cache clean, copies public/)
.env.example               # Template — copy to .env, never commit .env
public/
  index.html               # Chat dashboard UI (vanilla JS, no build step)
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
  app.module.ts           # Root module — registers ConfigModule (global), ChatModule, LlmModule, ConnectorsModule
  health.controller.ts    # GET /health — detailed health report (ok/degraded/unhealthy)
  health.service.ts       # Aggregates connector health checks
  app.controller.ts       # GET / — root endpoint (hello)
  app.service.ts          # Core application service
  main.ts                 # Bootstrap — NestExpressApplication, global ValidationPipe, useStaticAssets('public')
  chat/                   # Chat API module (REST endpoint)
    chat.controller.ts    # POST /chat — input sanitization (strips control chars)
    chat.module.ts        # ThrottlerModule (20 req/min) + ChatRateLimitGuard
    chat-rate-limit.guard.ts  # Custom rate limit guard with hashed IP logging
    dto/
      chat.dto.ts         # ChatDto — IsString, MaxLength(4000)
    chat.integration.spec.ts  # Integration tests (boots stack, hits /health, validates chat)
  connectors/
    connectors.module.ts  # Registers and exports all connectors
    utils/
      connector-error.ts  # Graceful degradation utility (timeout + AbortController + structured errors + log sanitization)
      connector-error.spec.ts  # Tests for error handling utility
    k8s-prometheus.connector.ts
    kubernetes.connector.ts
    loki.connector.ts     # LogQL query wrapper
    argocd.connector.ts   # ArgoCD API client
  llm/                    # LLM integration (DeepSeek V3 primary, Gemini optional fallback)
    llm.module.ts         # LlmModule — imports DeepSeekModule + GeminiModule, registers LlmService
    llm.service.ts        # LlmService — tool-use loop with 30s timeout, retry, token guard
    llm.service.spec.ts   # Tests for LlmService
    llm.controller.ts     # GET /health/llm — LLM health check endpoint
    llm.controller.spec.ts# Tests for LlmController
    deepseek/             # DeepSeek V3 API client (primary LLM)
      deepseek.service.ts
      deepseek.service.spec.ts  # Unit tests for DeepSeek API client
    gemini/               # Google Gemini API client (optional fallback)
config.example.yaml       # Template — copy to config.yaml, never commit config.yaml
```

## Adding a New Feature

1.  Create a feature branch from `develop`:
    ```bash
    git checkout develop
    git checkout -b feature/issue-{number}-{short-description}
    ```

2.  Implement your changes following the patterns in [CLAUDE.md](../CLAUDE.md).

3.  Write tests — co-locate `*.spec.ts` files next to source files.

4.  Verify everything passes:
    ```bash
    make check    # tsc --noEmit + lint
    make test     # jest --forceExit
    ```

5.  Open a PR to `develop`.

## Docker Build Notes

- The `Dockerfile` uses a multi-stage build: `npm ci` in the builder stage, then `npm ci --only=production && npm cache clean --force` in the runtime stage.
- `curl` is installed in the runtime image (`apk add --no-cache curl`) for Docker healthchecks.
- The `public/` directory (chat dashboard UI) is copied into the runtime image.
- The `.dockerignore` file excludes `node_modules`, `dist`, `.env`, `coverage`, `tests`, and `*.md` from the Docker build context to keep images lean.
