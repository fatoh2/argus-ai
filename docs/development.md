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
  app.module.ts           # Root module — registers ConfigModule, ChatModule, LlmModule, ConnectorsModule
  app.controller.ts       # Health check endpoint
  app.service.ts          # Core application service
  chat/                   # Chat API module (REST endpoint + React widget)
  connectors/             # Read-only connector implementations
    connectors.module.ts  # Registers and exports all connectors
    k8s-prometheus.connector.ts
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

## Adding New Connectors

Follow the detailed steps outlined in [CLAUDE.md](../CLAUDE.md). Key steps include:

1.  Create the connector class in `src/connectors/` implementing the `Connector` interface.
2.  Add a health check method `isHealthy(): Promise<boolean>`.
3.  Use `ConfigService` for configuration (inject via constructor).
4.  Register the connector in `src/connectors/connectors.module.ts` (add to `providers` and `exports`).
5.  Update `config.example.yaml` with placeholder values.
6.  Write unit tests with stubbed HTTP responses (see `loki.connector.spec.ts` and `argocd.connector.spec.ts` for examples).
7.  Update `docs/connectors.md` with available methods and example questions.
8.  **Escalate to PM**: New connectors always require PM review before merging due to security implications.

## Testing

Argus AI uses Jest for testing.

- **Unit Tests**: Located alongside the code they test (e.g., `*.spec.ts`). These should use stubbed or mocked dependencies.
- **Connector Tests**: Use `@nestjs/testing` `Test.createTestingModule` with mocked `ConfigService`.

To run all tests:
```bash
npm test
```

To run tests in watch mode:
```bash
npm run test:watch
```
