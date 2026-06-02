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

### LLM Guardrails
- In addition to input sanitization, Argus AI employs LLM-specific guardrails and prompt engineering techniques to minimize the risk of the LLM generating harmful, biased, or insecure responses.

## 3. LLM Interaction Security

### Safe Logging
- The `LlmService` **never logs full prompt or response content**. Only metadata (token count, message count, attempt number) is logged.
- All log output is sanitized via the `sanitizeForLog()` utility which redacts:
  - API keys and tokens (alphanumeric strings 20+ characters)
  - URLs that may contain credentials
  - JSON fields named `apiKey`, `token`, `secret`, or `password`
- This ensures that even if a prompt accidentally contains sensitive data, it will not appear in logs.

### Token Limit Guard
- Prompts exceeding 50,000 estimated tokens are automatically truncated by removing the oldest conversation history first.
- This prevents context overflow attacks and limits the blast radius of any single request.

### Timeout Protection
- LLM calls have a hard **30-second timeout**. If the Gemini API does not respond within this window, the call is aborted and the client receives a `504 Gateway Timeout` response.
- This prevents slow or malicious LLM responses from tying up server resources indefinitely.

### Retry Policy
- On 5xx server errors (Internal Server Error, Service Unavailable), the call is retried **once**.
- Timeout errors and 4xx client errors are **never retried** — they fail immediately with appropriate HTTP status codes.
- This prevents cascading failures while avoiding unnecessary retries on client errors.

### Error Classification
- LLM errors are mapped to appropriate HTTP status codes:
  - **429 / rate limit**: `429 Too Many Requests`
  - **401 / auth failure**: `401 Unauthorized`
  - **Timeout**: `504 Gateway Timeout`
  - **5xx / server error**: `502 Bad Gateway`
- This ensures clients receive meaningful, non-leaky error responses.

## 4. Connector Interaction Security

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
- A `sanitizeLog()` utility automatically redacts values matching common credential patterns (bearer tokens, API keys, secrets) from log output.
- This ensures that operational debugging does not leak sensitive credentials into log aggregation systems.

### Data Volume Management
- When querying external systems (e.g., Prometheus, Loki), Argus AI employs strategies to manage potentially large data volumes, such as:
    - Specifying time ranges and filtering aggressively in queries.
    - Capping Loki log queries at 500 lines maximum to prevent context overflow.
    - Capping Prometheus queries to 24-hour ranges unless explicitly extended.
    - Implementing pagination or sampling where appropriate to prevent memory exhaustion and performance degradation.

### Network Connectivity and Error Handling
- Argus AI implements robust error handling for network connectivity issues when interacting with external connectors.
- Temporary network failures are handled with retries, and persistent failures are reported gracefully without exposing sensitive internal information.

### Rate Limiting and Caching
- **API Rate Limiting**: The `/chat` endpoint is protected by a rate limiter, allowing a maximum of 20 requests per minute per IP address. This prevents abuse and ensures the stability and availability of the service.
- The underlying implementation considers rate limiting for external APIs (e.g., Gemini API) and handles `429 Too Many Requests` responses gracefully by returning a structured error to the user.

## 5. Deployment Security

### Network Security
- Deploy Argus AI within a private network or behind a reverse proxy (e.g., Nginx, API Gateway) to restrict access to the API.
- Use HTTPS in production to encrypt all traffic between clients and the Argus AI server.
- Ensure that the connectors (Kubernetes API, Prometheus, Loki, etc.) are only accessible from the Argus AI server's network.

### Secret Management
- For production deployments, use a dedicated secret management solution (e.g., Kubernetes Secrets, HashiCorp Vault, AWS Secrets Manager) to store and inject environment variables.
- Avoid storing secrets in plaintext configuration files or environment variable files on disk.

### Monitoring and Auditing
- Monitor Argus AI's logs for unusual patterns, such as repeated authentication failures or unexpected error types.
- Audit the connectors' access logs to verify that Argus AI is only performing read operations.
- Monitor the `GET /health/llm` endpoint to track LLM API availability and latency over time.

## 6. Incident Response

If a security incident is suspected (e.g., potential credential exposure, unauthorized access):

1. **Immediately revoke and rotate** any potentially compromised API keys, tokens, or credentials.
2. **Review Argus AI logs** for any signs of unauthorized activity or data access.
3. **Audit connector access logs** to verify the scope of any potential breach.
4. **Update credentials** and redeploy Argus AI with the new secrets.
5. **Document the incident** and implement measures to prevent recurrence.
