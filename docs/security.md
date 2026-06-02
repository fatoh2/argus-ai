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

## 3. Connector Interaction Security

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
- **API Rate Limiting**: The `/chat` endpoint is protected by a rate limiter, allowing a maximum of 20 requests per minute per IP address. This prevents abuse and ensures the stability and availability of the service.
- The underlying implementation considers rate limiting for external API calls to prevent overwhelming connected services.
- Caching mechanisms may be employed for frequently requested, non-sensitive data to improve performance and reduce external API load.

## 4. Deployment Security

### Principle of Least Privilege
- Deploy Argus AI with the principle of least privilege. Ensure its runtime environment (e.g., Kubernetes Pods) has only the necessary permissions and access to resources.

### Regular Updates
- Keep Argus AI dependencies and the underlying operating system/container images regularly updated to patch known vulnerabilities.

### Monitoring and Logging
- Integrate Argus AI's logs with your central logging and monitoring solutions to detect and respond to suspicious activity.
