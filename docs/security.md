> **Note**: This document reflects the security posture as of the latest release. See [README.md](../README.md) for a quick summary.

# Security Best Practices for Argus AI

This document outlines the security considerations and best practices for deploying and operating Argus AI.

## 1. Configuration Security

### Never Commit Sensitive Data
- **Always use environment variables** for sensitive information such as API keys, tokens, and database connection strings.
- The `config.yaml` file should only contain non-sensitive configuration parameters or references to environment variables using the `${ENV_VAR_NAME}` syntax.
- **Never commit `config.yaml` or `.env` files with actual credentials to Git.**

### Kubeconfig Security
- The `.kube/` directory is gitignored. Never commit kubeconfig files to the repository.
- When mounting a kubeconfig into the Docker container, it is mounted **read-only** (`./.kube:/kube:ro`) to prevent the container from modifying it.
- The Kubernetes connector is strictly **read-only** — it only calls `get`, `list`, and `describe` operations. It never creates, updates, or deletes resources.
- Consider using a dedicated service account with minimal read-only RBAC permissions instead of a full admin kubeconfig.

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
- The Kubernetes connector only calls `get`, `list`, and `describe` API operations — it never creates, updates, or deletes resources.

### Tool Registry Security
- The `ToolRegistryService` only exposes tools that map to read-only connector methods.
- Tool schemas are predefined and hardcoded — the LLM cannot invent new tool calls or modify existing ones.
- Tool execution is routed through a strict `switch` statement — unknown tool names return an error and are never executed against infrastructure.

### Graceful Degradation with Safe Error Handling
- All connector methods are wrapped with `withConnectorErrorHandling()` which provides:
  - **10-second timeout with AbortController** — prevents hanging on unresponsive services; the underlying HTTP request is cancelled via `AbortController.abort()`
  - **Structured error responses** — returns `{ error: "<name> unavailable", data: null }` instead of throwing exceptions
  - **Log sanitization** — error logs automatically redact API keys, bearer tokens, and secrets using a regex pattern before writing to the console
- This ensures that even when a connector fails, no sensitive credentials are leaked in logs.

### Health Checks
- Every connector implements an `isHealthy()` method that can be used to verify connectivity before making operational queries.
- The `GET /health` endpoint provides an overall system health summary.

## 4. LLM Security

### API Key Management
- DeepSeek and Gemini API keys are loaded from environment variables (`DEEPSEEK_API_KEY`, `GEMINI_API_KEY`).
- If `DEEPSEEK_API_KEY` is not set, the app still boots but returns errors on `/chat` — it does not crash.
- If `GEMINI_API_KEY` is not set, the Gemini fallback is gracefully skipped.

### Timeout and Retry Protection
- LLM calls have a **30-second hard timeout** to prevent runaway requests.
- On 5xx server errors, the call is retried once before returning an error to the user.
- Timeout errors are NOT retried — they immediately return `504 Gateway Timeout`.

### Token Limit Guard
- Conversation history is truncated when estimated tokens exceed `LLM_MAX_TOKENS` (default 50k), with oldest messages removed first.
- This prevents excessively long prompts that could lead to degraded model performance or increased costs.

## 5. Deployment Security

### Docker Container Security
- The production `docker-compose.yml` mounts the kubeconfig directory **read-only** (`:ro`).
- The container runs with the default non-root user where possible.
- The `extra_hosts` entry (`host.docker.internal:host-gateway`) is only needed for local development with k3d — remove it in production deployments.

### Network Security
- The `/chat` endpoint is rate-limited to 20 requests per minute per IP.
- All connector communication should be over HTTPS in production.
- Consider deploying behind a reverse proxy (e.g., Nginx, Traefik) for additional security layers (TLS termination, IP whitelisting, WAF).

## 6. Logging Security

### Log Sanitization
- All error logs are sanitized to remove sensitive information before being written.
- The `sanitizeLog()` function uses regex patterns to redact:
  - API keys and tokens (strings of 20+ alphanumeric/underscore/hyphen characters)
  - Bearer tokens in HTTP headers
- Rate limit hits are logged with a **hashed IP** (SHA-256) rather than the raw IP address, protecting user privacy.

## 7. Dependency Security

### Regular Updates
- Keep dependencies up to date, especially `@kubernetes/client-node` and LLM client libraries.
- Monitor for security advisories related to the `@kubernetes/client-node` library.
- Use `npm audit` regularly to check for known vulnerabilities.

### Minimal Dependencies
- Argus AI uses a minimal set of carefully chosen dependencies to reduce the attack surface.
- New dependencies should be evaluated for security posture before addition.
