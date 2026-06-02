# argus-ai — AI Integration Agent Rules

## Role
You build and maintain Argus AI: an AI infrastructure assistant powered by Google Gemini
API tool use, with read-only connectors to Kubernetes, Prometheus, Loki, ArgoCD, and
optionally argus-monitor's database.

## Stack
- **AI**: Google Gemini API (generative-ai SDK)
- **Backend**: NestJS + TypeScript
- **Frontend**: React embeddable chat component
- **Config**: `@nestjs/config` (ConfigModule) — environment variables + `config.yaml`
- **Testing**: Jest + `@nestjs/testing` with mocked `ConfigService`

## Repo Structure
```
src/
  app.module.ts           # Root module — ConfigModule (global), ChatModule, LlmModule, ConnectorsModule
  app.controller.ts       # Health check endpoint
  app.service.ts          # Core application service
  chat/                   # Chat API module (REST endpoint + React widget)
  connectors/
    connectors.module.ts  # Registers and exports all connectors
    utils/
      connector-error.ts  # Graceful degradation utility (timeout + structured errors + log sanitization)
    k8s-prometheus.connector.ts
    kubernetes.connector.ts
    loki.connector.ts     # LogQL query wrapper
    argocd.connector.ts   # ArgoCD API client
  llm/                    # LLM integration
    gemini/               # Gemini API client (GeminiService)
    llm.service.ts        # Timeout, retry, token guard, safe logging, health check
    llm.controller.ts     # GET /health/llm endpoint
    llm.module.ts         # Registers LlmService + LlmController
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

### Graceful Degradation Pattern

Every connector method must use `withConnectorErrorHandling`:

```typescript
import { withConnectorErrorHandling, ConnectorErrorResult } from './utils/connector-error';

@Injectable()
export class MyConnector {
  async getData(): Promise<MyData | ConnectorErrorResult<MyData>> {
    return withConnectorErrorHandling('my-connector', async () => {
      // Actual connector logic
      return await this.api.fetchData();
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
- **10-second timeout** (configurable via third parameter)
- **Structured error responses**: `{ error: "<name> unavailable", data: null }`
- **Safe logging**: connector name, error type, duration — API keys/tokens auto-redacted

### Example: Adding a connector to ConnectorsModule

```typescript
// src/connectors/connectors.module.ts
import { Module } from '@nestjs/common';
import { K8sPrometheusConnector } from './k8s-prometheus.connector';
import { KubernetesConnector } from './kubernetes.connector';
import { LokiConnector } from './loki.connector';
import { ArgoCDConnector } from './argocd.connector';

@Module({
  providers: [K8sPrometheusConnector, KubernetesConnector, LokiConnector, ArgoCDConnector],
  exports: [K8sPrometheusConnector, KubernetesConnector, LokiConnector, ArgoCDConnector],
})
export class ConnectorsModule {}
```

## LLM Service Architecture

The `LlmService` (`src/llm/llm.service.ts`) wraps all Gemini API calls with:

- **30-second timeout** — calls exceeding this return `504 Gateway Timeout`. Timeout errors are not retried.
- **Automatic retry** — on 5xx server errors, the call is retried once. If both attempts fail, the client receives `502 Bad Gateway`.
- **Token limit guard** — prompts exceeding 50,000 estimated tokens are truncated by removing the oldest conversation history first.
- **Safe logging** — the service never logs full prompt or response content. All log output is sanitized via `sanitizeForLog()` which redacts API keys, tokens, and secrets.
- **Health check** — `GET /health/llm` makes a cheap test call to the Gemini API and returns `{ ok: boolean, latencyMs: number }`.

Options are configurable via the `LLM_SERVICE_OPTIONS` injection token:

```typescript
export const LLM_SERVICE_OPTIONS = 'LLM_SERVICE_OPTIONS';

export interface LlmServiceOptions {
  timeoutMs?: number;       // Default: 30000
  maxPromptTokens?: number; // Default: 50000
  maxRetries?: number;      // Default: 1
}
```

### Error Mapping

LLM errors are mapped to appropriate HTTP status codes:
- **429 / rate limit**: `429 Too Many Requests`
- **401 / auth failure**: `401 Unauthorized`
- **Timeout**: `504 Gateway Timeout`
- **5xx / server error**: `502 Bad Gateway`

## The Tools Claude Can Call (read-only always)
```typescript
get_pod_status(namespace: string, label_selector?: string)
get_prometheus_metric(query: string, start: string, end: string)
get_loki_logs(service: string, start: string, end: string, level?: string)
get_argocd_app_status(app_name: string)
get_recent_github_runs(repo: string, branch?: string)
get_recent_alerts(user_id: string, hours: number)      // argus-monitor connector
get_wallet_activity(wallet_id: string, hours: number)  // argus-monitor connector
```

## Security Rules (strictest in the project)
- **NEVER** add write operations to any connector — every connector is read-only
- **NEVER** let Claude suggest destructive shell commands in its output — filter them
- **NEVER** store user query history or log content in plaintext — encrypt at rest
- **NEVER** hardcode API keys — use `ConfigService` + environment variables only
- **NEVER** commit `config.yaml` (contains real endpoint URLs) — only `config.example.yaml`
- **ALWAYS** add a health check to every connector before using it
  - If endpoint unreachable: return graceful error, not a crash
- **ALWAYS** wrap connector methods with `withConnectorErrorHandling()` for graceful degradation
- **ALWAYS** cap Loki log queries to 500 lines max to avoid context overflow
- **ALWAYS** cap Prometheus queries to 24h range unless explicitly extended
- **ALWAYS** test connectors with stub/mock responses before integration tests
- **ALWAYS** use `@nestjs/testing` `Test.createTestingModule` with mocked `ConfigService` for connector tests
- **ALWAYS** wrap LLM calls with timeout (30s default), retry (once on 5xx), and token guard (50k)
- **ALWAYS** use `sanitizeForLog()` before logging any LLM-related data — never log full prompts or responses

## Adding a New Connector
1. Create the connector class in `src/connectors/` implementing the `Connector` interface
2. Use `ConfigService` for configuration (inject via constructor)
3. Add health check method `isHealthy(): Promise<boolean>`
4. **Wrap all public methods** with `withConnectorErrorHandling('<name>', ...)` from `./utils/connector-error`
5. Register in `src/connectors/connectors.module.ts` (providers + exports)
6. Add to `config.example.yaml` with placeholder values
7. Write unit tests with stubbed HTTP responses (see `connector-error.spec.ts` for error handling pattern)
8. Update `docs/connectors.md` with available methods and example questions
9. Escalate to PM — new connectors always require PM review before merging

## PR Format
```
Title: [ai] short description

Body:
## What changed
<which connector or feature>

## Example questions now answerable
- "..."
- "..."

## Security review
- Is this connector truly read-only? (yes/no — explain)
- What data can Claude now see? (be explicit)
- Health check implemented? (yes/no)
- Graceful degradation implemented? (yes/no — wrapped with withConnectorErrorHandling?)
- Safe logging ensured? (yes/no — no secrets in logs)

## Testing
- Unit tests added? (yes/no — list test file)
- Tests pass? (yes/no)
```
