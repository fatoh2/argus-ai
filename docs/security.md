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
- The `config.example.yaml` file uses environment variable references (e.g., `${DEEPSEEK_API_KEY}`, `${ARGOCD_AUTH_TOKEN}`) to indicate where sensitive values should be provided. These placeholders are designed to prevent accidental exposure of credential formats.

### Docker Compose Dev Environment Security
- The `docker-compose.dev.yml` file enables **Grafana anonymous admin access** (`GF_AUTH_ANONYMOUS_ENABLED=true`, `GF_AUTH_ANONYMOUS_ORG_ROLE=Admin`) for local development convenience.
- **This is acceptable only for local development on a trusted machine.** Never deploy the dev docker-compose file to a production or internet-facing environment.
- The dev stack uses default passwords and no TLS — it is intentionally insecure for ease of use.
- For production, use the production Helm chart with proper authentication, TLS, and network policies.

### Docker Compose Production Stack Security
- The production `docker-compose.yml` includes Redis (redis:7) with no authentication configured by default.
- **For production deployments**, configure Redis with a password (`requirepass`) and use TLS for connections.
- The `argus-ai` service depends on Redis being healthy before starting, preventing race conditions.
- Both services have Docker healthchecks configured to ensure service availability.

### `.dockerignore` Security
- The `.dockerignore` file excludes `node_modules`, `dist`, `.git`, `.env`, `.env.*`, `coverage`, and `tests` from Docker builds.
- This prevents accidental inclusion of sensitive files (like `.env` with API keys) in Docker images.
- It also reduces image size by excluding development artifacts.

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
- In addition to input sanitization, Argus AI employs LLM-specific guardrails and prompt engineering techniques to minimize the risk of the LLM generating harmful, biased, or insecure responses. The DeepSeek V3 system prompt instructs the model to never reveal API keys, tokens, or sensitive configuration.

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
- Every connector implements an `isHealthy()` method for monitoring.
- The application exposes `GET /health` for basic health checks (used by Docker healthchecks and load balancers).
- The LLM service exposes `GET /health/llm` for LLM-specific health monitoring with latency tracking.

## 4. API Security

### Rate Limiting
- The `/chat` endpoint is rate-limited to **20 requests per minute per IP** using `@nestjs/throttler` and a custom `ChatRateLimitGuard`.
- Rate-limit hits are logged with a **hashed IP** (SHA-256) for monitoring without storing raw IP addresses.
- The response includes a `Retry-After` header so clients can back off appropriately.

### Input Validation
- All API inputs are validated using `class-validator` DTOs with strict type checking and length limits.
- A global `ValidationPipe` with `whitelist: true` and `forbidNonWhitelisted: true` rejects unexpected fields.
- Control characters and null bytes are stripped from user messages before processing.

## 5. Logging Security

### Credential Redaction
- All error logs are processed through a `sanitizeLog()` function that automatically redacts:
  - API keys (matches patterns like `sk-...`, `api-...`, `key-...`)
  - Bearer tokens in Authorization headers
  - Common secret patterns (passwords, tokens, secrets)
- The redaction uses regex patterns to find and replace sensitive data with `[REDACTED]`.
- This prevents accidental credential leakage in log aggregation systems (e.g., Loki, CloudWatch).

### No Sensitive Data in Logs
- Connector errors log only: connector name, error type, and duration.
- Rate limit hits log only: hashed IP and timestamp.
- LLM errors log only: error type and status code.
- Never log raw API keys, tokens, or user messages.

## 6. Docker Security

### Multi-stage Build
- The `Dockerfile` uses a multi-stage build:
  - **Builder stage**: Installs all dependencies with `npm ci` and compiles TypeScript.
  - **Production stage**: Copies only the compiled `dist/` and installs production dependencies with `npm ci --only=production`, then cleans the npm cache.
- This minimizes the final image size and excludes development tools and source code.

### Minimal Base Image
- The production stage uses `node:20-alpine` as the base image, which is a minimal Linux distribution.
- Only `curl` is added (via `apk add --no-cache curl`) for Docker healthchecks.
- No other packages or tools are installed in the production image.

### Healthchecks
- The `argus-ai` service in `docker-compose.yml` has a healthcheck: `curl -sf http://localhost:3000/health`
- The `redis` service has a healthcheck: `redis-cli ping`
- Healthchecks ensure containers are actually serving traffic before they are considered healthy.

### `.dockerignore`
- The `.dockerignore` prevents `node_modules`, `dist`, `.git`, `.env`, `.env.*`, `coverage`, and `tests` from being included in Docker build context.
- This is critical for security (prevents leaking `.env` files) and performance (smaller build context).

## 7. Deployment Security

### Production Checklist
Before deploying to production:
- [ ] Use Kubernetes Secrets or a secrets manager for all sensitive environment variables
- [ ] Configure Redis with a password and TLS
- [ ] Disable Grafana anonymous admin access (dev stack only)
- [ ] Use TLS/HTTPS for all external endpoints
- [ ] Set `NODE_ENV=production`
- [ ] Configure network policies to restrict pod-to-pod communication
- [ ] Use read-only service accounts for Kubernetes connector
- [ ] Enable audit logging for all connectors
- [ ] Regularly rotate API keys and tokens
- [ ] Monitor health endpoints and set up alerts
