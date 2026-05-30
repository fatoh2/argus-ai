# argus-ai — AI Integration Agent Rules

## Role
You build and maintain Argus AI: an AI infrastructure assistant powered by Claude API
tool use, with read-only connectors to Kubernetes, Prometheus, Loki, ArgoCD, and
optionally argus-monitor's database.

## Stack
- **AI**: Anthropic Claude API (claude-sonnet-4-6) with tool use
- **Backend**: NestJS + TypeScript
- **Frontend**: React embeddable chat component
- **Config**: `config.yaml` — all endpoint URLs and credentials
- **Testing**: Jest + stub connector responses

## Repo Structure
```
apps/
  ai-service/           NestJS — Claude API orchestration, tool dispatch
  chat-ui/              Embeddable React chat component
connectors/
  kubernetes/           Read-only K8s API client (uses in-cluster SA or kubeconfig)
  prometheus/           PromQL query wrapper
  loki/                 LogQL query wrapper
  argocd/               ArgoCD API client
  github-actions/       GitHub Actions API client
  argus-monitor/        Optional: read-only replica of argus-monitor PostgreSQL
k8s/ai-service/         Helm chart
docker-compose.yml      Local dev with stub connectors
config.example.yaml     Template — copy to config.yaml, never commit config.yaml
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

## Security Rules (strictest in the project)
- **NEVER** add write operations to any connector — every connector is read-only
- **NEVER** let Claude suggest destructive shell commands in its output — filter them
- **NEVER** store user query history or log content in plaintext — encrypt at rest
- **NEVER** hardcode API keys — use `process.env` or `config.yaml` only
- **NEVER** commit `config.yaml` (contains real endpoint URLs) — only `config.example.yaml`
- **ALWAYS** add a health check to every connector before using it
  - If endpoint unreachable: return graceful error, not a crash
- **ALWAYS** cap Loki log queries to 500 lines max to avoid context overflow
- **ALWAYS** cap Prometheus queries to 24h range unless explicitly extended
- **ALWAYS** test connectors with stub/mock responses before integration tests

## Adding a New Connector
1. Create `connectors/{name}/index.ts` implementing the `Connector` interface
2. Add health check method `isHealthy(): Promise<boolean>`
3. Add to `config.example.yaml` with placeholder values
4. Write unit tests with stubbed HTTP responses
5. Update `docs/connectors.md` with example questions it enables
6. Escalate to PM — new connectors always require PM review before merging

## PR Format
```
Title: [ai] short description

Body:
## What changed
<which connector or feature>

## Example questions now answerable
- "..."
- "..."

## Security review
- Is this connector truly read-only? (yes/no — explain)
- What data can Claude now see? (be explicit)
- Health check implemented? (yes/no)

## Checklist
- [ ] Tests pass with stub responses
- [ ] No write operations in connector
- [ ] config.example.yaml updated
- [ ] docs/connectors.md updated
- [ ] No config.yaml committed
```

## Escalate to PM when
- Adding any new data source connector (PM reviews scope + security before merge)
- Any change to how `ANTHROPIC_API_KEY` is handled
- Any expansion of what data argus-monitor connector can access
- Claude model version change (coordinate with PM on cost impact)
