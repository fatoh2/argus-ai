> **Note**: This document reflects the security posture as of the latest release. See [README.md](../README.md) for a quick summary.

# Security Best Practices for Argus AI

This document outlines the security considerations and best practices for deploying and operating Argus AI.

## 1. Configuration Security

### Never Commit Sensitive Data
- **Always use environment variables** for sensitive information such as API keys, tokens, and database connection strings.
- The `config.yaml` file should only contain non-sensitive configuration parameters or references to environment variables using the `${ENV_VAR_NAME}` syntax.
- **Never commit `config.yaml` or `.env` files with actual credentials to Git.**

### Secure Environment Variable Usage
- Argus AI uses **NestJS ConfigModule** (`@nestjs/config`) to securely load and validate environment variables.
- The `ConfigModule` is registered globally in `app.module.ts` with `isGlobal: true`, making `ConfigService` available to all modules.
- Environment variables are loaded from `.env` files (for local development) or the system environment (for production).
- Ensure that environment variables are set securely in your deployment environment (e.g., Kubernetes Secrets, CI/CD secret management).

### Input Validation for Credentials
- All API keys, tokens, and connection strings provided via `config.yaml` or environment variables are validated for basic presence and structural integrity.
- Malformed or missing critical credentials will result in application startup failures, preventing insecure operation.

### `config.example.yaml` Placeholders
- The `config.example.yaml` file uses environment variable references (e.g., `${ARGOCD_AUTH_TOKEN}`) to indicate where sensitive values should be provided. These placeholders are designed to prevent accidental exposure of credential formats.

## 2. User Query Security (Prompt Injection Prevention)

### Robust Input Sanitization
- **All natural language queries submitted by users are subject to rigorous sanitization and validation** before being processed by the Large Language Model (LLM) or used to construct API calls to external connectors.
- This process aims to prevent various injection attacks, including:
    - **Prompt Injection**: Malicious prompts designed to trick the LLM into revealing sensitive information, bypassing security controls, or performing unintended actions.
    - **Command Injection**: If the query is used to construct shell commands (not a primary use case for Argus AI, but a general concern).
    - **API Call Injection**: If the query is parsed to construct specific API calls (e.g., Prometheus query language, Kubernetes API parameters), improper sanitization could lead to injection vulnerabilities in those underlying systems.

### Input Validation Layers
The `/chat` endpoint implements multiple layers of input validation:

1. **DTO Validation**: `ChatDto` uses `class-validator` decorators (`@IsString()`, `@MaxLength(4000)`) to validate message structure and length.
2. **Global ValidationPipe**: `main.ts` registers a global `ValidationPipe` with `whitelist: true` and `forbidNonWhitelisted: true`, ensuring only expected fields are accepted and unknown fields are rejected.
3. **Control Character Stripping**: The `ChatController` strips control characters (`\x00-\x08`, `\x0B`, `\x0C`, `\x0E-\x1F`, `\x7F`) and null bytes from messages before processing.
4. **Empty Message Rejection**: After sanitization, empty messages are rejected with a `400 Bad Request`.

### LLM Guardrails
- In addition to input sanitization, Argus AI employs LLM-specific guardrails and prompt engineering techniques to minimize the risk of the LLM generating harmful, biased, or insecure responses.

## 3. Connector Interaction Security

### Read-Only Access
- Argus AI is designed to operate with **read-only access** to all integrated connectors (Kubernetes, Prometheus, Loki, ArgoCD, GitHub Actions, Argus Monitor).
- Ensure that the credentials provided to Argus AI (e.g., Kubernetes service accounts, GitHub tokens) are scoped to the minimum necessary read-only permissions.

### Graceful Degradation with Safe Error Handling
- All connector methods are wrapped with `withConnectorErrorHandling()` which provides:
  - **10-second timeout** — prevents hanging on unresponsive services
  - **Structured error responses** — returns `{ error: "<name> unavailable", data: null }` instead of throwing exceptions
  - **Log sanitization** — error logs automatically redact API keys, bearer tokens, and secrets using a regex pattern before writing to the console
- This ensures that even when a connector fails, no sensitive credentials are leaked in logs.

### Health Checks
- Every connector implements an `isHealthy()` method that verifies connectivity before executing queries.
- If an endpoint is unreachable, the connector returns a graceful error rather than crashing the application.

### Timeout Protection
- All connector calls are wrapped with a **10-second timeout** via the shared `withConnectorErrorHandling()` utility.
- If a connector hangs or is unreachable, the call is aborted and a structured `ConnectorErrorResult` is returned instead of blocking the request indefinitely.
- This prevents cascading failures — a slow or dead connector will not hold up the entire query pipeline.

### Sanitized Error Logging
- Connector error logs include the connector name, error type, and duration, but **never API keys, tokens, or secrets**.
- A `sanitizeLog()` utility automatically redacts values matching common credential patterns from log output:

```typescript
function sanitizeLog(message: string): string {
  return message.replace(
    /(?:bearer\s+|api[_-]?key\s*[:=]\s*|token\s*[:=]\s*|secret\s*[:=]\s*)(['"]?)[a-zA-Z0-9_\-.]{16,}\1/gi,
    '$1***redacted***$1',
  );
}
```

- This ensures that operational debugging does not leak sensitive credentials into log aggregation systems.

### Data Volume Management
- When querying external systems (e.g., Prometheus, Loki), Argus AI employs strategies to manage potentially large data volumes, such as:
    - Specifying time ranges and filtering aggressively in queries.
    - Capping Loki log queries at 500 lines maximum to prevent context overflow.
    - Capping Prometheus queries to 24-hour ranges unless explicitly extended.
    - Implementing pagination or sampling where appropriate to prevent memory exhaustion and performance degradation.

### Network Connectivity and Error Handling
- Argus AI implements robust error handling for network connectivity issues when interacting with external connectors.
- Temporary network failures are handled gracefully, and persistent failures are reported without exposing sensitive internal information.

## 4. API Security

### Rate Limiting
- The `/chat` endpoint is protected by a custom `ChatRateLimitGuard` that enforces a maximum of **20 requests per minute per IP address**.
- When the limit is exceeded, the API returns a `429 Too Many Requests` response with a `Retry-After` header (in seconds).
- Rate limit hits are logged with a **hashed IP** (SHA-256, first 16 characters) and timestamp for monitoring, without storing raw IP addresses.
- The rate limiter respects the `X-Forwarded-For` header for reverse proxy deployments.

### Input Validation
- All API inputs are validated using `class-validator` decorators on DTOs.
- A global `ValidationPipe` with `whitelist: true` and `forbidNonWhitelisted: true` ensures only expected fields are accepted.
- Control characters and null bytes are stripped from user messages before processing.

### No Destructive Commands
- The AI's output is filtered to prevent it from suggesting or executing any destructive shell commands.
- All connectors are strictly read-only — no write operations are exposed to the LLM.
- The system prompt and tool definitions explicitly forbid destructive actions.

### Encrypted History
- User query history and log content are never stored in plaintext.
- They are encrypted at rest to protect user privacy and data security.
- Rate-limit monitoring uses hashed IPs (SHA-256, first 16 characters) rather than raw IP addresses.

### No Hardcoded Secrets
- API keys and other sensitive credentials are never hardcoded in source code.
- All secrets are loaded from environment variables via NestJS `ConfigService`.
- The `config.yaml` file is excluded from Git via `.gitignore` — only `config.example.yaml` is committed.

### Limited Data Access
- Connectors are designed to access only the minimum necessary data to fulfill their function. For example, Loki queries are capped at 500 lines, and Prometheus queries are capped at a 24-hour range by default.

## 5. Logging Security

### Never Log Credentials
- All log messages are sanitized to remove API keys, bearer tokens, and secrets before output.
- The `sanitizeLog()` utility is applied to all connector error logs.
- Logs contain operational information (connector name, error type, duration) but never sensitive credentials.

### Hashed IP Logging
- Rate limit hits log a hashed version of the client IP (SHA-256, first 16 characters) rather than the raw IP address.
- This allows monitoring and abuse detection without storing personally identifiable information.

## 6. Deployment Security

### Environment-Specific Configuration
- Use different `.env` files or environment variable configurations for development, staging, and production environments.
- Never share production credentials with development environments.

### Kubernetes Secrets
- When deploying to Kubernetes, store sensitive environment variables as Kubernetes Secrets.
- Mount secrets as environment variables or volume mounts, never hardcode them in configuration files.

### Regular Updates
- Keep all dependencies up to date to patch known vulnerabilities.
- Regularly review and update connector permissions to ensure least-privilege access.
