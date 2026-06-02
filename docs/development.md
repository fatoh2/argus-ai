# Development Guide

This guide provides instructions for setting up your development environment, running Argus AI locally, adding new features, and testing.

## Local Development Setup

1.  **Clone the repository**:
    ```bash
    git clone https://github.com/fatoh2/argus-ai.git
    cd argus-ai

> **Note**: The `.gitignore` includes `argus-ai/` to prevent accidental nested clones by automation agents. If you see this directory, it is a stray artifact and can be safely deleted.

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

    You can also use a `.env` file for environment variables. The app uses `@nestjs/config` which loads `.env` automatically. Copy `.env.example` to `.env` and fill in your DeepSeek API key:

    ```bash
    cp .env.example .env
    # Edit .env — set DEEPSEEK_API_KEY=your-key-here
    ```

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
  llm/                    # LLM integration (DeepSeek V3 primary, Gemini optional fallback)
    llm.module.ts         # LlmModule — imports DeepSeekModule, registers LlmService and LlmController
    llm.service.ts        # LlmService — tool-use loop with 30s timeout, retry, 50k token guard, health check, error mapping
    llm.service.spec.ts   # Tests for LlmService
    llm.controller.ts     # POST /llm/run-tool-use-loop + GET /health/llm — LLM health check endpoint
    llm.controller.spec.ts# Tests for LlmController
    deepseek/             # DeepSeek V3 API client (primary LLM)
    gemini/               # Google Gemini API client (optional fallback)
config.example.yaml       # Template — copy to config.yaml, never commit config.yaml
.env.example              # Template — copy to .env, never commit .env with secrets
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

The `LlmService` is the core LLM integration layer. It wraps the DeepSeek V3 API (primary) with:

### Timeout Protection

Uses `Promise.race` between the DeepSeek call and a timeout promise. If the call exceeds `LLM_TIMEOUT_MS` (default 30s), it rejects with `504 Gateway Timeout`. Timeout errors are NOT retried — they fail fast.

### Token Limit Guard

The `truncateHistory()` function estimates token count using `Math.ceil(text.length / 4)` and removes oldest messages first when the total exceeds `LLM_MAX_TOKENS` (default 50k).

### Retry Logic

On 5xx server errors, the call is retried up to `LLM_MAX_RETRIES` times (default 1). Non-retryable errors (4xx, auth failures, rate limits) fail immediately.

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
export class LokiConnector {
  async queryLogs(query: string, start: string, end: string): Promise<LokiResult[] | ConnectorErrorResult> {
    return withConnectorErrorHandling('Loki', 'queryLogs', async () => {
      const response = await fetch(`${this.baseUrl}/loki/api/v1/query_range?query=${encodeURIComponent(query)}&start=${start}&end=${end}`);
      if (!response.ok) {
        throw new Error(`Loki returned status ${response.status}`);
      }
      const data = await response.json();
      return data.data.result;
    });
  }
}
```

### How It Works

The `withConnectorErrorHandling` utility:

1. Wraps the connector call with a 10-second timeout using `AbortController`
2. Catches any errors (timeout, network, HTTP) and returns a structured `ConnectorErrorResult`
3. Sanitizes error messages for logging (redacts API keys, tokens, secrets)
4. Never throws — always returns either the expected result or a `ConnectorErrorResult`

## Adding a New Connector

To add a new read-only connector:

1. Create a new file in `src/connectors/` (e.g., `my-tool.connector.ts`)
2. Implement a class with methods wrapped in `withConnectorErrorHandling()`
3. Register it in `connectors.module.ts`
4. Add configuration to `config.yaml` and `.env.example`
5. Add the connector to the system prompt in `src/llm/gemini/systemPrompt.ts`
6. Write tests in a `.spec.ts` file

## Testing

```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:cov

# Run tests in watch mode
npm run test:watch
```

All new code should include unit tests. Connector tests should mock external HTTP calls.
