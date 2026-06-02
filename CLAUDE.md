# CLAUDE.md

This document outlines the coding standards and architectural principles for the Argus AI project, specifically tailored for development with Claude as an AI assistant.

## 1. Architecture Principles

- **Modularity**: Components should be loosely coupled and highly cohesive.
- **Scalability**: Design for horizontal scaling where possible.
- **Resilience**: Implement graceful degradation and error handling.
- **Security**: Prioritize security at every layer.
- **Observability**: Ensure systems are easily monitorable and debuggable.
- **API-First**: Design APIs before implementation.
- **Idempotency**: Operations should produce the same result if executed multiple times.

## 2. Code Structure

### NestJS Application Structure

- **`src/main.ts`**: Application entry point.
- **`src/app.module.ts`**: Root module.
- **`src/modules/`**: Contains feature modules (e.g., `chat`, `connectors`, `auth`).
  - Each module should have its own `*.module.ts`, `*.controller.ts`, `*.service.ts`, `*.resolver.ts` (if GraphQL), and `*.spec.ts` files.
- **`src/common/`**: Shared utilities, decorators, interceptors, pipes, filters.
- **`src/config/`**: Configuration management (e.g., `config.service.ts`, `configuration.ts`).
- **`src/database/`**: Database-related code (e.g., TypeORM entities, migrations).
- **`src/interfaces/`**: TypeScript interfaces and types.
- **`src/connectors/`**: External service integrations (e.g., Kubernetes, ArgoCD, Prometheus).

### File Naming Conventions

- `feature-name.module.ts`
- `feature-name.controller.ts`
- `feature-name.service.ts`
- `feature-name.resolver.ts`
- `feature-name.guard.ts`
- `feature-name.interceptor.ts`
- `feature-name.pipe.ts`
- `feature-name.filter.ts`
- `feature-name.entity.ts`
- `feature-name.interface.ts`
- `feature-name.dto.ts`
- `feature-name.spec.ts` (for tests)

## 3. TypeScript Best Practices

- **Strict Typing**: Always use strict TypeScript.
- **Interfaces over Types**: Prefer interfaces for object shapes.
- **Readonly Properties**: Use `readonly` for properties that should not be reassigned.
- **Enums**: Use `enum` for a set of named constants.
- **Async/Await**: Prefer `async/await` for asynchronous operations.
- **Error Handling**: Use `try/catch` blocks for error handling.
- **Type Guards**: Use type guards for narrowing types.

## 4. API Design (GraphQL & REST)

- **Consistency**: Maintain consistent naming conventions and data structures.
- **Versioning**: Use API versioning (e.g., `/v1/`).
- **Pagination**: Implement pagination for large collections.
- **Filtering/Sorting**: Provide options for filtering and sorting.
- **Error Responses**: Standardize error response formats.

## 5. Connectors

Connectors are responsible for integrating with external systems (Kubernetes, ArgoCD, Prometheus, etc.).

### `withConnectorErrorHandling()` Utility

All connector methods that interact with external services **must** be wrapped with `withConnectorErrorHandling()` to ensure graceful degradation and consistent error responses.

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

  async getOtherData(): Promise<OtherData | ConnectorErrorResult<OtherData>> {
    return withConnectorErrorHandling('my-connector', async () => {
      // Logic that doesn't involve HTTP requests or needs a signal
      return { value: 'some-data' };
    }, 5000); // Custom 5-second timeout
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
import { sanitizeLog } from './utils/sanitize-log';

const sensitiveData = 'Bearer my-secret-token-123';
const sanitized = sanitizeLog(sensitiveData); // 'Bearer [REDACTED]'
```

This utility automatically redacts sensitive information (API keys, bearer tokens, etc.) from log messages to prevent accidental exposure.

## 6. Testing

- **Unit Tests**: Use Jest for unit testing services, controllers, and utilities.
- **Integration Tests**: Test the interaction between components.
- **End-to-End Tests**: Use Supertest for testing API endpoints.
- **Test Coverage**: Aim for high test coverage.
- **Mocking**: Use mocks for external dependencies.

## 7. Logging

- **Winston**: Use Winston for structured logging.
- **Log Levels**: Use appropriate log levels (debug, info, warn, error).
- **Context**: Include relevant context in log messages.

## 8. Configuration

- **Environment Variables**: Use environment variables for sensitive configuration.
- **Config Module**: Use NestJS `ConfigModule` for managing configuration.
- **Validation**: Validate configuration using Joi or class-validator.

## 9. Security

- **Authentication/Authorization**: Implement robust authentication and authorization.
- **Input Validation**: Validate all incoming input.
- **Rate Limiting**: Implement rate limiting to prevent abuse.
- **CORS**: Configure CORS appropriately.
- **Helmet**: Use Helmet for setting security-related HTTP headers.

## 10. Documentation

- **README.md**: High-level project overview.
- **API Documentation**: Use Swagger/OpenAPI for API documentation.
- **Code Comments**: Use JSDoc for code comments.
- **Architecture Decision Records (ADRs)**: Document significant architectural decisions.
