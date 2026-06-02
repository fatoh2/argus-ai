# argus-ai — AI Integration Agent Rules

## Role
You build and maintain Argus AI: an AI infrastructure assistant powered by Google Gemini
1.5 Flash API tool use, with read-only connectors to Kubernetes, Prometheus, Loki, ArgoCD,
and optionally argus-monitor's database.

## Stack
- **AI**: Google Gemini 1.5 Flash API (generative-ai SDK)
- **Backend**: NestJS + TypeScript
- **Config**: `@nestjs/config` (ConfigModule) — environment variables + `config.yaml`
- **Validation**: `class-validator` + global `ValidationPipe` (whitelist, forbidNonWhitelisted)
- **Rate Limiting**: `@nestjs/throttler` + custom `ChatRateLimitGuard` (20 req/min/IP)
- **Testing**: Jest + `@nestjs/testing` with mocked `ConfigService`

## Repo Structure
```
src/
  app.module.ts           # Root module — ConfigModule (global), ChatModule, LlmModule, ConnectorsModule
  app.controller.ts       # Health check endpoint
  app.service.ts          # Core application service
  main.ts                 # Bootstrap — global ValidationPipe with whitelist
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
    kubernetes.connector.ts
    loki.connector.ts     # LogQL query wrapper
    argocd.connector.ts   # ArgoCD API client
  llm/                    # Gemini 1.5 Flash LLM integration
    llm.module.ts         # LlmModule — imports GeminiModule, registers LlmService
    llm.service.ts        # LlmService — tool-use loop with 30s timeout, retry, token guard
    llm.service.spec.ts   # Tests for LlmService
    llm.controller.ts     # GET /health/llm — LLM health check endpoint (returns 200 if LLM is responsive)
    llm.controller.spec.ts# Tests for LlmController
    gemini/               # Google Gemini 1.5 Flash API client
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

- **HTTP connectors** (ArgoCD, Loki): pass `signal` to `http.get({ signal })` for proper request cancellation
- **Delegating connectors** (Kubernetes, K8sPrometheus): accept as `_signal` for API consistency
- **Custom connectors**: if making HTTP requests, pass the signal to enable cancellation

### The `sanitizeLog()` Utility

```typescript
function sanitizeLog(message: string): string {
  return message.replace(
    /(?:bearer\s+|api[_-]?key\s*[:=]\s*|token\s*[:=]\s*|secret\s*[:=]\s*)(['"]?)[a-zA-Z0-9_\-.]{16,}\1/gi,
    '$1***redacted***$1',
  );
}
```

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
