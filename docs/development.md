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
      connector-error.ts  # Graceful degradation utility (timeout + structured errors + log sanitization)
      connector-error.spec.ts  # Tests for error handling utility
    k8s-prometheus.connector.ts
    kubernetes.connector.ts
    loki.connector.ts     # Loki log querying (LogQL)
    argocd.connector.ts   # ArgoCD application status
  llm/                    # LLM integration (Gemini API)
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

## Graceful Degradation Pattern

All connector methods should be wrapped with the `withConnectorErrorHandling` utility to ensure graceful degradation when external services are unavailable.

### Usage

```typescript
import { withConnectorErrorHandling, ConnectorErrorResult } from './utils/connector-error';

@Injectable()
export class MyConnector {
  async getData(): Promise<MyData | ConnectorErrorResult<MyData>> {
    return withConnectorErrorHandling('my-connector', async () => {
      // Your actual connector logic here
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

### What it provides

- **10-second timeout** — calls that exceed this return `{ error: "<name> unavailable", data: null }` (configurable via third parameter)
- **Structured errors** — callers always get a predictable shape, never an unhandled exception
- **Safe logging** — logs include connector name, error type, and duration; API keys and tokens are automatically redacted via `sanitizeLog()`
- **Custom timeout** — the third parameter accepts a custom timeout in milliseconds

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

This ensures that if an error message contains an API key or bearer token, it is replaced with `***redacted***` before being written to the console.

## Adding New Connectors

Follow the detailed steps outlined in [CLAUDE.md](../CLAUDE.md). Key steps include:

1.  Create the connector class in `src/connectors/` implementing the `Connector` interface.
2.  Add a health check method `isHealthy(): Promise<boolean>`.
3.  Use `ConfigService` for configuration (inject via constructor).
4.  **Wrap all public methods** with `withConnectorErrorHandling('<name>', ...)` from `./utils/connector-error`.
5.  Register the connector in `src/connectors/connectors.module.ts` (add to `providers` and `exports`).
6.  Update `config.example.yaml` with placeholder values.
7.  Write unit tests with stubbed HTTP responses (see `connector-error.spec.ts` for the error handling pattern).
8.  Update `docs/connectors.md` with available methods and example questions.
9.  **Escalate to PM**: New connectors always require PM review before merging due to security implications.

## Testing

Argus AI uses Jest for testing.

- **Unit Tests**: Located alongside the code they test (e.g., `*.spec.ts`). These should use stubbed or mocked dependencies.
- **Connector Tests**: Use `@nestjs/testing` `Test.createTestingModule` with mocked `ConfigService`.
- **Error Handling Tests**: The `connector-error.spec.ts` file tests timeout behavior, success/failure paths, and log sanitization (verifying that API keys are redacted from logs). Tests cover:
  - Successful connector calls return the expected result
  - Thrown errors return structured `ConnectorErrorResult`
  - Timeouts return structured `ConnectorErrorResult`
  - Logs contain connector name, error type, and duration
  - API keys and tokens are redacted from log output
  - Correct typing for array results

To run all tests:
```bash
npm test
```

To run tests in watch mode:
```bash
npm run test:watch
```

## Input Validation & Sanitization

The `/chat` endpoint implements multiple layers of input validation:

1. **DTO Validation**: `ChatDto` uses `class-validator` decorators (`@IsString()`, `@MaxLength(4000)`) to validate message structure and length.
2. **Global ValidationPipe**: `main.ts` registers a global `ValidationPipe` with `whitelist: true` and `forbidNonWhitelisted: true`, ensuring only expected fields are accepted.
3. **Control Character Stripping**: The `ChatController` strips control characters (`\x00-\x08`, `\x0B`, `\x0C`, `\x0E-\x1F`, `\x7F`) and null bytes from messages before processing.
4. **Empty Message Rejection**: After sanitization, empty messages are rejected with a `400 Bad Request`.

## Rate Limiting

The `/chat` endpoint is protected by a custom `ChatRateLimitGuard`:

- **Limit**: 20 requests per minute per IP
- **Response**: `429 Too Many Requests` with a `Retry-After` header (in seconds)
- **Logging**: Rate limit hits are logged with a hashed IP (SHA-256, first 16 chars) and timestamp
- **IP Detection**: Respects `X-Forwarded-For` header for reverse proxy setups
