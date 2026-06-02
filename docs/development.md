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

    You can also check LLM health:
    ```bash
    curl http://localhost:3000/health/llm
    # {"ok":true,"latencyMs":150}
    ```

## Project Structure

```
src/
  app.module.ts           # Root module — registers ConfigModule, ChatModule, LlmModule, ConnectorsModule
  app.controller.ts       # Health check endpoint
  app.service.ts          # Core application service
  chat/                   # Chat API module (REST endpoint + React widget)
  connectors/             # Read-only connector implementations
    connectors.module.ts  # Registers and exports all connectors
    utils/
      connector-error.ts  # Graceful degradation utility (timeout + structured errors + log sanitization)
    k8s-prometheus.connector.ts
    kubernetes.connector.ts
    loki.connector.ts     # Loki log querying (LogQL)
    argocd.connector.ts   # ArgoCD application status
  llm/                    # LLM integration (Gemini API)
    gemini/               # Gemini API client
    llm.service.ts        # Timeout, retry, token guard, safe logging, health check
    llm.controller.ts     # GET /health/llm endpoint
    llm.module.ts         # Registers LlmService + LlmController
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

- **10-second timeout** — calls that exceed this return `{ error: "<name> unavailable", data: null }`
- **Structured errors** — callers always get a predictable shape, never an unhandled exception
- **Safe logging** — logs include connector name, error type, and duration; API keys and tokens are automatically redacted
- **Custom timeout** — the third parameter accepts a custom timeout in milliseconds

## LLM Service Architecture

The `LlmService` (`src/llm/llm.service.ts`) wraps all Gemini API calls with:

- **30-second timeout** — calls exceeding this return `504 Gateway Timeout`. Timeout errors are not retried.
- **Automatic retry** — on 5xx server errors, the call is retried once. If both attempts fail, the client receives `502 Bad Gateway`.
- **Token limit guard** — prompts exceeding 50,000 estimated tokens are truncated by removing the oldest conversation history first.
- **Safe logging** — the service never logs full prompt or response content. All log output is sanitized via `sanitizeForLog()` which redacts API keys, tokens, and secrets.
- **Health check** — `GET /health/llm` makes a cheap test call to the Gemini API and returns `{ ok: boolean, latencyMs: number }`.

Options are configurable via the `LLM_SERVICE_OPTIONS` injection token:

```typescript
{
  timeoutMs: 30000,       // Hard timeout in ms
  maxPromptTokens: 50000, // Max estimated tokens before truncation
  maxRetries: 1,          // Retry attempts on 5xx errors
}
```

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
- **Error Handling Tests**: The `connector-error.spec.ts` file tests timeout behavior, success/failure paths, and log sanitization (verifying that API keys are redacted from logs).
- **LLM Service Tests**: The `llm.service.spec.ts` file tests timeout behavior, retry logic, token truncation, safe logging, and health check functionality using mocked `GeminiService` and configurable `LLM_SERVICE_OPTIONS`.
- **LLM Controller Tests**: The `llm.controller.spec.ts` file tests the `GET /health/llm` endpoint with mocked `LlmService`.

To run all tests:
```bash
npm test
```

To run tests in watch mode:
```bash
npm run test:watch
```
