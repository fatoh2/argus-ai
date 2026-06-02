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
  llm/                    # Gemini LLM integration
    llm.module.ts         # LlmModule — imports GeminiModule, registers LlmService
    llm.service.ts        # LlmService — tool-use loop with timeout, retry, token guard
    llm.service.spec.ts   # Tests for LlmService
    llm.controller.ts     # GET /health/llm — LLM health check endpoint
    llm.controller.spec.ts# Tests for LlmController
    gemini/               # Google Gemini API client
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
- **ALWAYS** cap Prometheus queries to 24h range unless explicitly requested
- **ALWAYS** use `ConfigService` for all configuration — never `process.env` directly
- **ALWAYS** use `class-validator` decorators on all DTOs
- **ALWAYS** add `@IsString()` and `@MaxLength()` to message fields
- **ALWAYS** add unit tests for new connectors (stub HTTP, mock ConfigService)
- **ALWAYS** add unit tests for new LLM methods
- **ALWAYS** add e2e tests for new endpoints
- **ALWAYS** use `sanitizeLog()` before writing any log that might contain user input or connector responses
- **ALWAYS** add `@IsOptional()` + `@IsString()` for optional DTO fields
- **ALWAYS** use `@nestjs/config` `ConfigService.get<T>('path', default)` with a type parameter and default value
- **ALWAYS** use `@nestjs/testing` `Test.createTestingModule` with mocked `ConfigService` in connector tests
- **ALWAYS** use `@nestjs/testing` `Test.createTestingModule` with mocked `LlmService` in controller tests
- **ALWAYS** use `@nestjs/testing` `Test.createTestingModule` with mocked dependencies in service tests
- **ALWAYS** use `SuperTest` + `@nestjs/testing` for e2e tests
- **ALWAYS** use `beforeEach` for test setup, not `beforeAll`
- **ALWAYS** stub HTTP calls in connector tests — never make real network requests
- **ALWAYS** test the `isHealthy()` method returns `false` when the connector is unreachable
- **ALWAYS** test the `isHealthy()` method returns `true` when the connector is reachable
- **ALWAYS** test error handling returns `ConnectorErrorResult` shape on failure
- **ALWAYS** test log sanitization redacts API keys and tokens
- **ALWAYS** test timeout behavior returns structured error
- **ALWAYS** test correct typing for array results from connectors
- **ALWAYS** use `@nestjs/throttler` `@SkipThrottle()` on health check endpoints
- **ALWAYS** use `@nestjs/throttler` `@Throttle()` with custom limits where needed
- **ALWAYS** add `@HttpCode(HttpStatus.OK)` to POST endpoints that don't create resources
- **ALWAYS** add `@ApiTags()` and `@ApiOperation()` decorators to controllers
- **ALWAYS** use `@nestjs/swagger` for API documentation
- **ALWAYS** use `@nestjs/config` `ConfigModule.forRoot({ isGlobal: true })` in `app.module.ts`
- **ALWAYS** use `@nestjs/common` `Logger` for logging — never `console.log`
- **ALWAYS** use `@nestjs/common` `ValidationPipe` with `{ whitelist: true, forbidNonWhitelisted: true }` globally
- **ALWAYS** use `@nestjs/common` `HttpException` with appropriate status codes for error responses
- **ALWAYS** use `@nestjs/common` `NotFoundException`, `BadRequestException`, `GatewayTimeoutException` for specific error cases
- **ALWAYS** use `@nestjs/bull` `InjectQueue()` for BullMQ queue injection
- **ALWAYS** use `@nestjs/bull` `Process()` decorator for queue processors
- **ALWAYS** use `@nestjs/schedule` `@Cron()` for scheduled tasks
- **ALWAYS** use `@nestjs/axios` `HttpService` for HTTP requests — it integrates with NestJS lifecycle
- **ALWAYS** use `firstValueFrom()` to convert `HttpService` observables to promises
- **ALWAYS** pass `AbortSignal` from `withConnectorErrorHandling` to `http.get({ signal })` for proper request cancellation on timeout
- **ALWAYS** use `@nestjs/config` `ConfigModule.forRoot({ load: [yamlLoader] })` for YAML config loading
- **ALWAYS** use `js-yaml` `load()` to parse `config.yaml` in a custom config loader
- **ALWAYS** use `@nestjs/core` `APP_PIPE` for global pipe registration
- **ALWAYS** use `@nestjs/core` `APP_GUARD` for global guard registration
- **ALWAYS** use `@nestjs/core` `APP_FILTER` for global exception filter registration
- **ALWAYS** use `@nestjs/core` `APP_INTERCEPTOR` for global interceptor registration
- **ALWAYS** use `@nestjs/testing` `Test.createTestingModule` for integration tests
- **ALWAYS** use `@nestjs/testing` `Test.createTestingModule` with `compile()` and `init()` for e2e tests
- **ALWAYS** use `@nestjs/swagger` `SwaggerModule.setup()` for API docs
- **ALWAYS** use `@nestjs/common` `Logger.log()` for info, `Logger.warn()` for warnings, `Logger.error()` for errors
- **ALWAYS** use `@nestjs/common` `Logger` with context name: `new Logger('MyService')`
- **ALWAYS** use `@nestjs/common` `Injectable()` decorator for all services
- **ALWAYS** use `@nestjs/common` `Controller()` decorator for all controllers
- **ALWAYS** use `@nestjs/common` `Module()` decorator for all modules
- **ALWAYS** use `@nestjs/common` `Global()` decorator for global modules
- **ALWAYS** use `@nestjs/common` `HttpStatus` enum for status codes
- **ALWAYS** use `@nestjs/common` `ParseUUIDPipe` for UUID validation
- **ALWAYS** use `@nestjs/common` `DefaultValuePipe` for default values
- **ALWAYS** use `@nestjs/common` `ParseIntPipe` for integer validation
- **ALWAYS** use `@nestjs/common` `ParseBoolPipe` for boolean validation
- **ALWAYS** use `@nestjs/common` `ParseArrayPipe` for array validation
- **ALWAYS** use `@nestjs/common` `ParseEnumPipe` for enum validation
- **ALWAYS** use `@nestjs/common` `ParseFloatPipe` for float validation
- **ALWAYS** use `@nestjs/common` `ValidationPipe` with `{ transform: true }` for auto-transformation
- **ALWAYS** use `@nestjs/common` `ValidationPipe` with `{ whitelist: true }` to strip unknown properties
- **ALWAYS** use `@nestjs/common` `ValidationPipe` with `{ forbidNonWhitelisted: true }` to reject unknown properties
- **ALWAYS** use `@nestjs/common` `ValidationPipe` with `{ forbidUnknownValues: true }` to reject unknown values
- **ALWAYS** use `@nestjs/common` `ValidationPipe` with `{ skipMissingProperties: false }` to require all properties
- **ALWAYS** use `@nestjs/common` `ValidationPipe` with `{ skipNullProperties: false }` to reject null values
- **ALWAYS** use `@nestjs/common` `ValidationPipe` with `{ skipUndefinedProperties: false }` to reject undefined values
- **ALWAYS** use `@nestjs/common` `ValidationPipe` with `{ transformOptions: { enableImplicitConversion: true } }` for auto-conversion
- **ALWAYS** use `@nestjs/common` `ValidationPipe` with `{ exceptionFactory: (errors) => new BadRequestException(errors) }` for custom error format
- **ALWAYS** use `@nestjs/common` `ValidationPipe` with `{ validateCustomDecorators: true }` for custom decorators
- **ALWAYS** use `@nestjs/common` `ValidationPipe` with `{ stopAtFirstError: true }` to stop at first error
