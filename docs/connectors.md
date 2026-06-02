# Connectors

Argus AI integrates with various infrastructure components to provide comprehensive insights and control. This document outlines the design and usage of these connectors.

## Graceful Degradation

All connectors use a shared `withConnectorErrorHandling()` utility that provides graceful degradation. This includes:

- **10-second timeout with AbortController** — if a connector call takes longer than 10 seconds, the underlying HTTP request is cancelled via `AbortController` and a structured error is returned instead of hanging
- **Structured error responses** — on failure, connectors return `{ error: "<name> unavailable", data: null }` instead of throwing exceptions
- **Safe logging** — error logs include the connector name, error type, and duration, but never API keys, tokens, or secrets (automatically redacted via regex)
- **Custom timeout** — the third parameter accepts a custom timeout in milliseconds (default 10,000)
- **Health checks** — every connector implements `isHealthy(): Promise<boolean>` that returns `false` when the connector is unreachable

This means the LLM always receives a predictable response shape and can gracefully handle unavailable services or specific operational failures (e.g., an application not found in ArgoCD) by informing the user rather than crashing.

### How It Works

The `withConnectorErrorHandling()` utility accepts a factory function that receives an `AbortSignal`:

```typescript
async function withConnectorErrorHandling<T>(
  connectorName: string,
  fn: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number = 10_000,
): Promise<T | ConnectorErrorResult<T>>
```

Internally, it creates an `AbortController` and passes the `signal` to the factory function. The timeout is enforced via `Promise.race` between the factory promise and a timeout promise. When the timeout fires:

1. `AbortController.abort()` is called, which cancels the underlying HTTP request (via `http.get({ signal })`)
2. The timeout promise rejects with a `TimeoutError`
3. `withConnectorErrorHandling` catches the error and returns `{ error: "<name> unavailable", data: null }`

Connectors that make HTTP requests (ArgoCD, Loki) pass the `AbortSignal` to `http.get({ signal })` for proper request cancellation. Connectors that delegate to other connectors (Kubernetes, K8sPrometheus) accept the signal but pass it through to their underlying calls.

### ConnectorErrorResult Type

The `ConnectorErrorResult` type is defined as:

```typescript
export type ConnectorErrorResult<T> = {
  error: string;
  data: T | null;
};
```

This type is used to return a consistent error structure when a connector fails or times out. The `data` field will be `null` in case of an error.

## Connector Implementations

### ArgoCD Connector

**Purpose**: Integrates with ArgoCD to fetch application status, deployments, and other related information.

**Configuration**:
```yaml
argocd:
  url: https://argocd.example.com
  token: your-argocd-token
```

**Available methods**:
- `isHealthy()` — checks if the ArgoCD API is reachable
- `listApplications()` — lists all applications
- `getApplication(name)` — gets details for a specific application
- `getDeploymentStatus(appName)` — gets the sync and health status of an application's deployment

### Kubernetes Connector

**Purpose**: Interacts with the Kubernetes API to retrieve cluster information, pod logs, deployment details, etc.

**Configuration**:
```yaml
kubernetes:
  kubeconfig: |
    apiVersion: v1
    clusters:
    - cluster:
        certificate-authority-data: ...
        server: https://kubernetes.docker.internal:6443
      name: docker-desktop
    contexts:
    - context:
        cluster: docker-desktop
        user: docker-desktop
      name: docker-desktop
    current-context: docker-desktop
    kind: Config
    preferences: {}
    users:
    - name: docker-desktop
      user:
        client-certificate-data: ...
        client-key-data: ...
```
The `kubeconfig` is provided directly as a multi-line string.

**Capabilities**:
- Deployment and StatefulSet status
- Cluster events

All public methods are wrapped with `withConnectorErrorHandling('kubernetes', ...)` and accept the `AbortSignal` parameter for consistency, though the underlying `@kubernetes/client-node` library handles its own cancellation.

**Available methods**:
- `isHealthy()` — health check against the Kubernetes API
- `listPods(namespace)` — list pods in a namespace
- `getPodLogs(namespace, podName, containerName)` — get logs for a specific pod container
- `describeDeployment(namespace, deploymentName)` — get details for a deployment
- `listDeployments(namespace)` — list deployments in a namespace
- `listStatefulSets(namespace)` — list stateful sets in a namespace
- `describeStatefulSet(namespace, statefulSetName)` — get details for a stateful set
- `listNamespaces()` — list all namespaces
- `getEvents(namespace)` — get cluster events in a namespace

### Loki Connector

**Purpose**: Queries Loki for log data.

**Configuration**:
```yaml
loki:
  url: http://loki.example.com
```

**Available methods**:
- `isHealthy()` — checks if the Loki API is reachable
- `query(query, start, end)` — performs a log query
- `getLabels()` — gets available log labels
- `getLabelValues(label)` — gets values for a specific label

### K8sPrometheus Connector

**Purpose**: Convenience facade that delegates to both the Kubernetes and Prometheus connectors, wrapping all calls with graceful degradation.

**How it works**: All methods (`listPods`, `getPodLogs`, `describeDeployment`, `queryPrometheus`, `instantQueryPrometheus`, `rangeQueryPrometheus`) are wrapped with `withConnectorErrorHandling('k8s prometheus', ...)`. On failure, they return a `ConnectorErrorResult` instead of throwing. The factory functions accept `_signal` for API consistency with other connectors.

**Available methods**:
- `isHealthy()` — returns `true` if `listPods` succeeds
- `listPods(namespace)` — lists pods using the Kubernetes connector
- `getPodLogs(namespace, podName, containerName)` — gets pod logs using the Kubernetes connector
- `describeDeployment(namespace, deploymentName)` — describes a deployment using the Kubernetes connector
- `queryPrometheus(query, start, end)` — performs a Prometheus range query
- `instantQueryPrometheus(query, time)` — performs a Prometheus instant query
- `rangeQueryPrometheus(query, start, end, step)` — performs a Prometheus range query with step
