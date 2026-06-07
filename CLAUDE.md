# argus-ai — AI Integration Agent Rules

## Role
You build and maintain Argus AI: an AI infrastructure assistant powered by DeepSeek V3
(primary) with optional Gemini 1.5 Flash fallback, using OpenAI-compatible API tool use,
with read-only connectors to Kubernetes, Prometheus, Loki, ArgoCD,
and optionally argus-monitor's database.

## Stack
- **AI**: DeepSeek V3 (primary, OpenAI-compatible API) + Gemini 1.5 Flash (optional fallback)
- **Backend**: NestJS + TypeScript
- **K8s Client**: `@kubernetes/client-node` (v1.4.0+) — loads `KUBECONFIG` env var
- **Config**: `@nestjs/config` (ConfigModule) — environment variables + `config.yaml`
- **Validation**: `class-validator` + global `ValidationPipe` (whitelist, forbidNonWhitelisted)
- **Rate Limiting**: `@nestjs/throttler` + custom `ChatRateLimitGuard` (20 req/min/IP)
- **Testing**: Jest + `@nestjs/testing` with mocked `ConfigService`
- **Local Dev**: Docker Compose (`docker-compose.dev.yml`) with Prometheus, Loki, Grafana
- **Dev Shortcuts**: `Makefile` with `make up`, `make down`, `make check`, `make test`, `make chat`, `make health`, `make logs`

## Standing Rules

### Never clone this repo inside itself
The `.gitignore` includes `argus-ai/` to prevent accidental nested clones. If you are an agent operating inside this repo, do NOT run `git clone` targeting this same repository — it creates a nested copy that wastes disk space and confuses tooling. If you find an `argus-ai/` directory inside the repo, it is a stray artifact and should be deleted.

### Never commit kubeconfig files
The `.kube/` directory is gitignored. Never add kubeconfig files to the repository.

## Repo Structure
```
docker-compose.yml         # Production stack: Redis + argus-ai (with optional kubeconfig mount)
docker-compose.dev.yml     # Local dev stack: argus-ai + Prometheus + Loki + Grafana
scripts/
  setup.sh              # One-command local setup (prerequisites, .env, deps, Docker images)
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
  health/                 # Health check module
    health.controller.ts  # GET /health — overall system health
    health.service.ts     # Health check logic
    health.service.spec.ts  # Tests for HealthService
  public/                 # Static assets served by the app
    index.html            # Chat dashboard UI (vanilla JS, no build step)
config.example.yaml       # Template — copy to config.yaml, never commit config.yaml
```

## Connector Architecture

All connectors:
- Are `@Injectable()` classes in `src/connectors/`
- Use `ConfigService` for configuration (injected via constructor)
- Implement `isHealthy(): Promise<boolean>` for health checks
- Are registered in `ConnectorsModule` (providers + exports)
- Are strictly read-only
- **Wrap all public methods** with `withConnectorErrorHandling('<name>', ...)` from `./utils/connector-error`

### Kubernetes Connector (special case)
The Kubernetes connector uses `@kubernetes/client-node` and loads configuration from the
`KUBECONFIG` environment variable (not `ConfigService`). It has two modes:
- **Online**: `KUBECONFIG` is set → loads kubeconfig, creates API clients
- **Offline**: `KUBECONFIG` is not set → returns structured offline markers

Available methods: `listPods`, `listDeployments`, `listNamespaces`, `describeDeployment`, `getPodLogs`.

### Graceful Degradation Pattern

Every connector method must use `withConnectorErrorHandling`:

```typescript
import { withConnectorErrorHandling, ConnectorErrorResult } from './utils/connector-error';

@Injectable()
export class MyConnector {
  async getData(): Promise<MyData | ConnectorErrorResult<MyData>> {
    return withConnectorErrorHandling('my-connector', async (signal) => {
      // Actual connector logic
      // Pass signal to HTTP requests for proper cancellation on timeout
      return await this.api.fetchData({ signal });
    });
  }

  async isHealthy(): Promise<boolean> {
    try {
      const result = await this.getData();
      return !(result && typeof result === 'object' && 'error' in result);
    } catch {
      return false;
    }
  }
}
```

The utility provides:
- **10-second timeout with AbortController** (configurable via third parameter) — cancels the underlying HTTP request on timeout
- **Structured error responses**: `{ error: "<name> unavailable", data: null }`
- **Safe logging**: connector name, error type, duration — API keys/tokens auto-redacted via `sanitizeLog()`

### AbortSignal Parameter

The factory function receives an `AbortSignal` as its first argument:

```typescript
fn: (signal: AbortSignal) => Promise<T>
```

## Tool Registry Architecture

The `ToolRegistryService` (at `src/llm/tools/tool-registry.service.ts`) is the central registry
of LLM-callable tools. It provides:

1. **Tool schemas** — OpenAI/DeepSeek-compatible function-calling schemas via `getToolSchemas()`
2. **Tool execution** — routes tool calls to connectors via `executeTool(name, args)`

Currently registered tools:

| Tool Name | Description | Connector Method |
|---|---|---|
| `list_pods` | List Kubernetes pods with status, ready count, and restarts | `KubernetesConnector.listPods()` |
| `list_deployments` | List deployments with ready/available replicas and image | `KubernetesConnector.listDeployments()` |
| `list_namespaces` | List all namespaces in the cluster | `KubernetesConnector.listNamespaces()` |
| `get_pod_logs` | Fetch recent log lines from a specific pod | `KubernetesConnector.getPodLogs()` |
| `query_metrics` | Run an instant PromQL query against Prometheus and return current values | `PrometheusConnector.instantQuery()` |
| `query_logs` | Query logs from Loki using a LogQL label selector over a time range | `LokiConnector.queryLogs()` |
| `summarize_errors` | Summarize error-level logs from Loki over the last N hours, grouped by source and message | `LokiConnector.summarizeErrors()` |

To add a new tool:
1. Add a schema to `getToolSchemas()`
2. Add a case to the `switch` in `executeTool()`
3. Inject the relevant connector into `ToolRegistryService`

## Agentic Tool-Use Loop

The `DeepSeekService.chat()` method implements an agentic loop:

1. Sends the user query + tool schemas to the model
2. If the model returns `tool_calls`, executes them via `ToolRegistryService`
3. Feeds results back to the model
4. Repeats until the model produces a final answer (max 5 iterations)

The `LlmService.runToolUseLoop()` orchestrates this with timeout, retry, and Gemini fallback.
