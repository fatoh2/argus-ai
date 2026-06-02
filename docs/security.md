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

### Nested Clone Prevention
- The `.gitignore` includes `argus-ai/` to prevent automation agents from accidentally cloning the repository inside itself.
- This is a defense-in-depth measure: if an agent's working directory is inside the repo and it runs `git clone` targeting the same repo, the clone is ignored by Git and will not be tracked or committed.
- Stray nested clones can be safely deleted with `rm -rf argus-ai/`.

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
  - **10-second timeout with AbortController** — prevents hanging on unresponsive services; the underlying HTTP request is cancelled via `AbortController.abort()`
  - **Structured error responses** — returns `{ error: "<name> unavailable", data: null }` instead of throwing exceptions
  - **Log sanitization** — error logs automatically redact API keys, bearer tokens, and secrets using a regex pattern before writing to the console
- This ensures that even when a connector fails, no sensitive credentials are leaked in logs.

### Health Checks
- Every connector implements an `isHealthy()` method that verifies connectivity before executing queries.
- If an endpoint is unreachable, the connector returns a graceful error rather than crashing the application.
- The LLM service also exposes `GET /health/llm` which returns `{ ok: boolean, latencyMs: number }`.

### Timeout Protection
- All connector calls are wrapped with a **10-second timeout** via the shared `withConnectorErrorHandling()` utility.
- The timeout uses `AbortController` to cancel the underlying HTTP request — a slow or dead connector will not hold up the entire query pipeline or leave dangling connections.
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

## 4. LLM Security

### Safe Logging
The LLM service (`LlmService`) implements its own `sanitizeForLog()` utility that redacts:
- Alphanumeric strings 20+ characters (API keys, tokens)
- URLs containing potential tokens
- JSON fields named `apiKey`, `token`, `secret`, `password`

The LLM service **never logs full prompt or response content** — only metadata (token count, message count, attempt number, success/failure status).

### Error Classification
LLM errors are mapped to appropriate HTTP status codes to prevent information leakage:

| Error Type | HTTP Status | Logged As |
|---|---|---|
| Timeout | `504 Gateway Timeout` | `LLM request timed out` |
| Rate limit / quota | `429 Too Many Requests` | `LLM rate limit exceeded` |
| Auth failure | `401 Unauthorized` | `LLM authentication failed` |
| Server error | `502 Bad Gateway` | `LLM service unavailable after retries` |

Error messages are sanitized before logging — the original error message is passed through `sanitizeForLog()` to redact any embedded secrets.

### Token Limit Guard
- Prompts exceeding 50k estimated tokens are truncated by removing oldest messages first.
- This prevents excessively large prompts from being sent to the LLM API, reducing the risk of prompt injection through accumulated history.

### Timeout Protection
- LLM calls have a **30-second hard timeout** enforced via `Promise.race`.
- Timeout errors are NOT retried — they fail fast with `504 Gateway Timeout`.
- This prevents a malicious or buggy prompt from holding the LLM connection indefinitely.

## 5. Deployment Security

### Network Security
- Deploy Argus AI within a private network or behind a reverse proxy.
- Use HTTPS for all external communications.
- Restrict network access to only the necessary endpoints (Kubernetes API, Prometheus, Loki, ArgoCD, GitHub API).

### Secrets Management
- Use a secrets management solution (e.g., Kubernetes Secrets, HashiCorp Vault, AWS Secrets Manager) for production deployments.
- Avoid hardcoding secrets in configuration files or environment variables in plain text.

### Regular Updates
- Keep all dependencies up to date to patch known vulnerabilities.
- Regularly update the Gemini API client library and other dependencies.
- Monitor security advisories for the NestJS framework and related packages.

## See Also

- [Configuration Reference](configuration.md) — environment variable setup
- [Development Guide](development.md) — local development setup
- [Connectors Documentation](connectors.md) — connector architecture
