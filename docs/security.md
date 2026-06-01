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

### Input Sanitization
- All user queries are sanitized and validated before being sent to the LLM.
- The `/chat` endpoint validates input structure and rejects malformed requests.
- System prompts are strictly separated from user input to prevent prompt injection.

### Output Filtering
- LLM responses are filtered to prevent the model from suggesting destructive shell commands or providing sensitive credential information.
- The application enforces strict output formatting rules to ensure responses are safe and appropriate.

## 3. Connector Security

### Read-Only Access
- Argus AI is designed to operate with **read-only access** to all integrated connectors (Kubernetes, Prometheus, Loki, ArgoCD, GitHub Actions, Argus Monitor).
- Ensure that the credentials provided to Argus AI (e.g., Kubernetes service accounts, GitHub tokens) are scoped to the minimum necessary read-only permissions.

### Health Checks
- Every connector implements an `isHealthy()` method that verifies connectivity before executing queries.
- If an endpoint is unreachable, the connector returns a graceful error rather than crashing the application.

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
- The underlying implementation considers rate limiting for external API calls to prevent overwhelming connected services.
- Caching mechanisms may be employed for frequently requested, non-sensitive data to improve performance and reduce external API load.

## 4. Deployment Security

### Kubernetes Deployment
- When deploying Argus AI in a Kubernetes cluster, use a dedicated service account with minimal RBAC permissions.
- Store sensitive configuration (API keys, tokens) in Kubernetes Secrets, not in ConfigMaps or environment variables in plaintext.
- Use NetworkPolicies to restrict outbound traffic from the Argus AI pod to only the necessary endpoints (Kubernetes API, Prometheus, Loki, ArgoCD, GitHub API).

### CI/CD Security
- Never store API keys or tokens in CI/CD pipeline configuration files.
- Use CI/CD secret management features (e.g., GitHub Actions secrets) to inject sensitive values at runtime.

## 5. Incident Response

If you suspect a security breach or unauthorized access:

1. **Immediately rotate all API keys and tokens** used by Argus AI.
2. **Review connector access logs** (Kubernetes audit logs, Prometheus query logs, etc.) for any unusual activity.
3. **Check GitHub Actions access logs** for any unauthorized workflow runs.
4. **Report the incident** to the project maintainers.

## 6. Responsible Disclosure

If you discover a security vulnerability in Argus AI, please report it privately to the project maintainers. Do not disclose the vulnerability publicly until it has been addressed.
