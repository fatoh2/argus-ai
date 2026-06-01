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

4.  **Run Locally**:
    To start both the NestJS backend and the React chat UI:
    ```bash
    npm run start:dev
    ```
    The backend will typically run on `http://localhost:3000` and the frontend on `http://localhost:3001`.

## Project Structure

-   `apps/ai-service/`: NestJS application for Claude API orchestration and tool dispatch.
-   `apps/chat-ui/`: Embeddable React chat component.
-   `connectors/`: Contains individual read-only connector implementations (Kubernetes, Prometheus, Loki, etc.).
-   `k8s/ai-service/`: Helm chart for Kubernetes deployment.
-   `docker-compose.yml`: For local development with stub connectors.
-   `config.example.yaml`: Template for configuration.

## Adding New Connectors

Follow the detailed steps outlined in [CLAUDE.md](https://github.com/fatoh2/argus-ai/blob/main/CLAUDE.md#adding-a-new-connector). Key steps include:

1.  Create `connectors/{name}/index.ts` implementing the `Connector` interface.
2.  Add a health check method `isHealthy(): Promise<boolean>`.
3.  Update `config.example.yaml`.
4.  Write unit tests with stubbed HTTP responses.
5.  Update `docs/connectors.md` with example questions.
6.  **Escalate to PM**: New connectors always require PM review before merging due to security implications.

## Testing

Argus AI uses Jest for testing.

-   **Unit Tests**: Located alongside the code they test (e.g., `*.spec.ts`). These should use stubbed or mocked dependencies.
-   **Integration Tests**: Test the interaction between components, often using `docker-compose.yml` with stub connectors.

To run all tests:
```bash
npm test
```

To run tests in watch mode during development:
```bash
npm test -- --watch
```

## Code Style and Quality

-   Follow TypeScript best practices.
-   Adhere to the rules specified in [CLAUDE.md](https://github.com/fatoh2/argus-ai/blob/main/CLAUDE.md).
-   Ensure all new code is covered by tests.

## Opening Pull Requests

Before opening a PR, ensure:

-   All tests pass.
-   Your code adheres to the project's quality standards and CLAUDE.md rules.
-   The PR description follows the specified format (see [CLAUDE.md](https://github.com/fatoh2/argus-ai/blob/main/CLAUDE.md#pr-format)).
-   Relevant documentation (e.g., `docs/connectors.md`, `README.md`) is updated.
