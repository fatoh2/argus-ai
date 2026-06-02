# Development Guide

This guide provides instructions for setting up your development environment, running Argus AI locally, adding new features, and testing.

## Local Development Setup

1.  **Clone the repository**:
    ```bash
    git clone https://github.com/fatoh2/argus-ai.git
    cd argus-ai
    ```

2.  **Install dependencies**:
    ```bash
    npm install
    ```

3.  **Configure Environment**: 
    Copy `config.example.yaml` to `config.yaml` and fill in placeholder values. For local development, you can use local instances of Prometheus, Loki, etc., or mock their responses.
    ```bash
    cp config.example.yaml config.yaml
    # Edit config.yaml
    ```
    **Never commit `config.yaml` to Git!**

    You can also use a `.env` file for environment variables. The app uses `@nestjs/config` which loads `.env` automatically.

4.  **Run Locally**:
    To start the NestJS backend:
    ```bash
    npm run start:dev
    ```
    The backend will typically run on `http://localhost:3000`.
    > **Note**: The `/chat` endpoint is rate-limited to 20 requests per minute per IP. During development, you can test this by sending 21 requests within 60 seconds — the 21st should return `429 Too Many Requests` with a `Retry-After` header. Rate limit hits are logged with a hashed IP and timestamp.

## Project Structure

```
src/
  app.module.ts           # Root module — registers ConfigModule (global), ChatModule, LlmModule, ConnectorsModule
  app.controller.ts       # Health check endpoint
  app.service.ts          # Core application service
  main.ts                 # Bootstrap — global ValidationPipe with whitelist + forbidNonWhitelisted
  chat/                   # Chat API module (REST endpoint)
    chat.controller.ts    # POST /chat — input sanitization (strips control chars) + validation
    chat.module.ts        # ThrottlerModule (20 req/min) + ChatRateLimitGuard
    chat-rate-limit.guard.ts  # Custom rate limit guard with hashed IP logging + Retry-After header
    dto/
      chat.dto.ts         # ChatDto — message validation (IsString, MaxLength 4000)
  connectors/             # Read-only connector implementations
    connectors.module.ts  # Registers and exports all connectors
    utils/
      connector-error.ts  # Graceful degradation utility (timeout + AbortController + structured errors + log sanitization)
      connector-error.spec.ts  # Tests for error handling utility
    k8s-prometheus.connector.ts
    kubernetes.connector.ts
    loki.connector.ts     # Loki log querying (LogQL)
    argocd.connector.ts   # ArgoCD application status
  llm/                    # LLM integration (Gemini API)
    llm.module.ts         # LlmModule — imports GeminiModule, registers LlmService and LlmController
    llm.service.ts        # LlmService — tool-use loop with 30s timeout, retry, 50k token guard, health check, error mapping
    llm.service.spec.ts   # Tests for LlmService
    llm.controller.ts     # POST /llm/run-tool-use-loop + GET /health/llm — LLM health check endpoint
    llm.controller.spec.ts# Tests for LlmController
    gemini/               # Google Gemini API client
config.example.yaml       # Template — copy to config.yaml, never commit config.yaml
```

## Configuration Architecture

Argus AI uses **NestJS ConfigModule** (`@nestjs/config`) for configuration management:

- `ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' })` is registered in `app.module.ts`
- All connectors inject `ConfigService` to read their configuration
- Settings are loaded from environment variables (highest priority) and `config.yaml` (defaults)
- The `isGlobal: true` flag means any module can inject `ConfigService` without importing `ConfigModule`

### How Connectors Use ConfigService

```typescript
@Injectable()
export class LokiConnector {
  constructor(private configService: ConfigService) {
    this.baseUrl = this.configService.get<string>('loki.url', 'http://localhost:3100');
  }
}
```

## LLM Service Architecture

The `LlmService` is the core LLM integration layer. It wraps the Gemini API with:

### Timeout Protection

Uses `Promise.race` between the Gemini call and a timeout promise. If the call exceeds `timeoutMs` (default 30s), it rejects with `504 Gateway Timeout`. Timeout errors are NOT retried — they fail fast.

### Token Limit Guard

The `truncateConversation()` function estimates token count using `Math.ceil(text.length / 4)` and removes oldest messages first when the total exceeds `maxPromptTokens` (default 50k).

### Retry Logic

On 5xx server errors, the call is retried up to `maxRetries` times (default 1). Non-retryable errors (4xx, auth failures, rate limits) fail immediately.

### Error Classification

The `mapErrorToHttpException()` method maps errors to appropriate HTTP status codes:

| Error Type | HTTP Status |
|---|---|
| Timeout | `504 Gateway Timeout` |
| Rate limit / quota | `429 Too Many Requests` |
| Auth failure | `401 Unauthorized` |
| Server error (retries exhausted) | `502 Bad Gateway` |
| Generic | `502 Bad Gateway` |

### Health Check

`checkHealth()` sends a minimal prompt (`"Respond with just: ok"`) with a 10s internal timeout. Returns `{ ok: boolean, latencyMs: number }`. On failure, `ok` is `false` — the error is caught gracefully and never thrown.

### Safe Logging

The `sanitizeForLog()` utility redacts:
- Alphanumeric strings 20+ characters (API keys, tokens)
- URLs containing potential tokens
- JSON fields named `apiKey`, `token`, `secret`, `password`

## Graceful Degradation Pattern

All connector methods should be wrapped with the `withConnectorErrorHandling` utility to ensure graceful degradation when external services are unavailable.

### Usage

```typescript
import { withConnectorErrorHandling, ConnectorErrorResult } from './utils/connector-error';

@Injectable()
export class MyConnector {
  async getData(): Promise<MyData | ConnectorErrorResult<MyData>> {
    return withConnectorErrorHandling('my-connector', async (signal) => {
      // Your actual connector logic here
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

### What it provides

- **10-second timeout with AbortController** — calls that exceed this return `{ error: "<name> unavailable", data: null }` (configurable via third parameter). The underlying HTTP request is cancelled via `AbortController.abort()`.
- **Structured errors** — callers always get a predictable shape, never an unhandled exception
- **Safe logging** — logs include connector name, error type, and duration; API keys and tokens are automatically redacted via `sanitizeLog()`
- **Custom timeout** — the third parameter accepts a custom timeout in milliseconds

### AbortSignal Parameter

The factory function receives an `AbortSignal` as its first argument:

```typescript
fn: (signal: AbortSignal) => Promise<T>
```

- **HTTP connectors** (ArgoCD, Loki): pass `signal` to `http.get({ signal })` for proper request cancellation
- **Delegating connectors** (Kubernetes, K8sPrometheus): accept as `_signal` for API consistency
- **Custom connectors**: if making HTTP requests, pass the signal to enable cancellation

### The `sanitizeLog()` Utility

The `sanitizeLog()` function automatically redacts sensitive information from error logs:

```typescript
function sanitizeLog(message: string): string {
  return message.replace(
    /(?:bearer\s+|api[_-]?key\s*[:=]\s*|token\s*[:=]\s*|secret\s*[:=]\s*)(['"]?)[a-zA-Z0-9_\-.]{16,}\1/gi,
    '$1***redacted***$1',
  );
}
```

## Testing

### Running Tests

```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:cov

# Run tests in watch mode
npm run test:watch
```

### Writing Tests

- Use Jest with `@nestjs/testing` and mocked `ConfigService`
- Test files should be co-located with their source files as `*.spec.ts`
- Mock external dependencies (Gemini API, Kubernetes client, etc.)
- Test both success and failure paths (timeouts, errors, empty responses)

## Adding a New Connector

1. Create the connector file in `src/connectors/`
2. Implement `isHealthy(): Promise<boolean>`
3. Wrap all public methods with `withConnectorErrorHandling('<name>', ...)`
4. Register in `ConnectorsModule` (providers + exports)
5. Add configuration to `config.example.yaml`
6. Write tests in a co-located `*.spec.ts` file

## See Also

- [Configuration Reference](configuration.md) — full env var reference
- [Connectors Documentation](connectors.md) — detailed connector architecture
- [Security Best Practices](security.md) — security considerations
