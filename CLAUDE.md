# argus-ai — AI Integration Agent Rules

## Role
You build and maintain Argus AI: an AI infrastructure assistant powered by Google Gemini
API tool use, with read-only connectors to Kubernetes, Prometheus, Loki, ArgoCD, and
optionally argus-monitor's database.

## Stack
- **AI**: Google Gemini API (generative-ai SDK)
- **Backend**: NestJS + TypeScript
- **Frontend**: React embeddable chat component
- **Config**: `@nestjs/config` (ConfigModule) — environment variables + `config.yaml`
- **Testing**: Jest + `@nestjs/testing` with mocked `ConfigService`

## Repo Structure
```
src/
  app.module.ts           # Root module — ConfigModule (global), ChatModule, LlmModule, ConnectorsModule
  app.controller.ts       # Health check endpoint
  app.service.ts          # Core application service
  chat/                   # Chat API module (REST endpoint + React widget)
  connectors/
    connectors.module.ts  # Registers and exports all connectors
    k8s-prometheus.connector.ts
    loki.connector.ts     # LogQL query wrapper
    argocd.connector.ts   # ArgoCD API client
  llm/                    # Gemini LLM integration
config.example.yaml       # Template — copy to config.yaml, never commit config.yaml
```

## Connector Architecture

All connectors:
- Are `@Injectable()` classes in `src/connectors/`
- Use `ConfigService` for configuration (injected via constructor)
- Implement `isHealthy(): Promise<boolean>` for health checks
- Are registered in `ConnectorsModule` (providers + exports)
- Are strictly read-only

### Example: Adding a connector to ConnectorsModule

```typescript
// src/connectors/connectors.module.ts
import { Module } from '@nestjs/common';
import { K8sPrometheusConnector } from './k8s-prometheus.connector';
import { LokiConnector } from './loki.connector';
import { ArgoCDConnector } from './argocd.connector';

@Module({
  providers: [K8sPrometheusConnector, LokiConnector, ArgoCDConnector],
  exports: [K8sPrometheusConnector, LokiConnector, ArgoCDConnector],
})
export class ConnectorsModule {}
```

## The Tools Claude Can Call (read-only always)
```typescript
get_pod_status(namespace: string, label_selector?: string)
get_prometheus_metric(query: string, start: string, end: string)
get_loki_logs(service: string, start: string, end: string, level?: string)
get_argocd_app_status(app_name: string)
get_recent_github_runs(repo: string, branch?: string)
get_recent_alerts(user_id: string, hours: number)      // argus-monitor connector
get_wallet_activity(wallet_id: string, hours: number)  // argus-monitor connector
```

## Non-Negotiable Rules
- **NEVER** add write operations to any connector — every connector is read-only
- **NEVER** let Claude suggest destructive shell commands in its output — filter them
- **NEVER** store user query history or log content in plaintext — encrypt at rest
- **NEVER** hardcode API keys — use `ConfigService` + environment variables only
- **NEVER** commit `config.yaml` (contains real endpoint URLs) — only `config.example.yaml`
- **ALWAYS** add a health check to every connector before using it
  - If endpoint unreachable: return graceful error, not a crash
- **ALWAYS** cap Loki log queries to 500 lines max to avoid context overflow
- **ALWAYS** cap Prometheus queries to 24h range unless explicitly extended
- **ALWAYS** test connectors with stub/mock responses before integration tests
- **ALWAYS** use `@nestjs/testing` `Test.createTestingModule` with mocked `ConfigService` for connector tests

## Adding a New Connector
1. Create the connector class in `src/connectors/` implementing the `Connector` interface
2. Use `ConfigService` for configuration (inject via constructor)
3. Add health check method `isHealthy(): Promise<boolean>`
4. Register in `src/connectors/connectors.module.ts` (providers + exports)
5. Add to `config.example.yaml` with placeholder values
6. Write unit tests with stubbed HTTP responses (see `loki.connector.spec.ts` for pattern)
7. Update `docs/connectors.md` with available methods and example questions
8. Escalate to PM — new connectors always require PM review before merging

## PR Format
```
Title: [type(scope)] short description

Body:
- What changed and why
- How to test
- Any risks or migration steps
- Checklist: tests passing, CLAUDE.md rules followed, no secrets committed
```

## Escalate to PM when
- Adding any new data source connector (PM reviews scope + security before merge)
- Any change to how `GEMINI_API_KEY` is handled
- Any expansion of what data argus-monitor connector can access
- Gemini model version change (coordinate with PM on cost impact)
