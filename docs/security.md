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
  - **10-second timeout with AbortController** — prevents hanging on unresponsive services; the underlying HTTP request is cancelled via `AbortController.abort()`
  - **Structured error responses** — returns `{ error: "<name> unavailable", data: null }` instead of throwing exceptions
  - **Log sanitization** — error logs automatically redact API keys, bearer tokens, and secrets using a regex pattern before writing to the console
- This ensures that even when a connector fails, no sensitive credentials are leaked in logs.

### Health Checks
- Every connector implements an `isHealthy()` method that verifies connectivity before executing queries.
- If an endpoint is unreachable, the connector returns a graceful error rather than crashing the application.

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

- This ensures that operational debugging does not leak sensitive credentials into log aggregation systems.

### Data Volume Management
- When querying external systems (e.g., Loki), Argus AI caps responses to prevent memory exhaustion and context overflow:
  - **Loki**: Maximum 500 log lines per query
  - **Prometheus**: Maximum 24-hour range unless explicitly requested
- These limits are enforced at the connector level, not the LLM level.

## 4. LLM Security

### API Key Management
- The Google Gemini API key is loaded from the `GEMINI_API_KEY` environment variable.
- The key is never logged, exposed in error messages, or included in any output.
- The LLM service uses the key only for authenticating API calls to Google Gemini.

### Prompt Safety
- All user messages are sanitized before being sent to the LLM (see Section 2).
- The LLM is instructed to never execute commands or make changes to infrastructure — it is a read-only assistant.
- The LLM is instructed to never reveal its system prompt or internal instructions.

### Response Safety
- LLM responses are validated before being returned to the user.
- The LLM is instructed to avoid generating harmful, biased, or misleading content.
- All LLM responses are logged for audit purposes (without user PII).

## 5. Operational Security

### Logging
- **Never log sensitive data**: API keys, tokens, secrets, and user PII are never written to logs.
- **Structured logging**: Use `@nestjs/common` `Logger` with context names for all logging.
- **Log levels**: Use `Logger.log()` for info, `Logger.warn()` for warnings, `Logger.error()` for errors.
- **Rate limit logging**: Rate limit hits log a hashed IP (SHA-256, first 16 chars), not the raw IP.

### Error Handling
- **Never expose stack traces** to end users — all errors are caught and returned as structured responses.
- **Never expose internal configuration** in error messages.
- **Graceful degradation**: All connector failures return structured `ConnectorErrorResult` objects, never raw exceptions.

### Dependency Management
- Regularly update dependencies to patch known vulnerabilities.
- Use `npm audit` to identify and fix security issues.
- Pin major dependency versions in `package.json` to prevent unexpected breaking changes.

## 6. Deployment Security

### Environment Isolation
- Use separate environments for development, staging, and production.
- Never use production credentials in development environments.
- Use Kubernetes Secrets or similar mechanisms for managing sensitive configuration in production.

### Network Security
- Run Argus AI in a private network segment with access only to necessary services.
- Use TLS for all external communications (Gemini API, ArgoCD, etc.).
- Implement network policies to restrict egress traffic from the Argus AI pod.

### Monitoring
- Monitor for unusual API usage patterns that might indicate abuse.
- Set up alerts for repeated authentication failures or rate limit violations.
- Regularly review access logs for suspicious activity.

## 7. Incident Response

If a security incident is suspected:

1. **Immediately revoke** any potentially compromised API keys or tokens.
2. **Review logs** for the affected time period (logs never contain sensitive data, but may show unusual patterns).
3. **Identify the root cause** and implement fixes.
4. **Rotate all credentials** that may have been exposed.
5. **Document the incident** and update security procedures as needed.

## 8. Security Checklist

Before deploying Argus AI to production:

- [ ] All API keys and tokens are stored as environment variables or in Kubernetes Secrets
- [ ] `config.yaml` contains no hardcoded secrets
- [ ] Kubernetes service account has minimum required permissions (read-only)
- [ ] GitHub token has only `workflow` scope
- [ ] Argus Monitor database user has read-only access
- [ ] Rate limiting is enabled and configured appropriately
- [ ] Input validation and sanitization is active
- [ ] Logging is configured to not capture sensitive data
- [ ] All connectors have health checks and graceful degradation
- [ ] TLS is enabled for all external communications
- [ ] Network policies restrict egress traffic
- [ ] Monitoring and alerting is in place
- [ ] Dependencies are up to date (`npm audit` passes)
