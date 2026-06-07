# Example Queries and AI Responses

This document provides examples of natural language queries you can ask Argus AI and the types of responses you can expect. These examples demonstrate how Argus AI leverages its various connectors to provide insightful and actionable information.

## Live Kubernetes Queries

These examples assume the Kubernetes connector is configured with a valid kubeconfig. The LLM uses the agentic tool-use loop to call `list_pods`, `list_deployments`, `list_namespaces`, `describeDeployment`, or `getPodLogs` as needed.

### List All Pods

**Query**: "What pods are running in my cluster?"

**Expected AI Response**: Argus AI calls `list_pods` (no namespace filter) and returns a formatted table of all pods across all namespaces.

Example Output:
```
Here are the pods running in your cluster:

| Namespace | Name | Status | Ready | Restarts | Node |
|---|---|---|---|---|---|
| default | web-app-7d8f9c6b4f-abc12 | Running | 2/2 | 0 | k3d-agent-0 |
| default | web-app-7d8f9c6b4f-def34 | Running | 2/2 | 1 | k3d-agent-1 |
| default | redis-cache-5f6g7h8i9j-ghi56 | Running | 1/1 | 0 | k3d-server-0 |
| kube-system | coredns-1234567890-abc12 | Running | 1/1 | 0 | k3d-server-0 |
| kube-system | metrics-server-9876543210-def34 | Running | 1/1 | 0 | k3d-server-0 |
| kube-system | local-path-provisioner-5678901234-ghi56 | Running | 1/1 | 0 | k3d-server-0 |

Total: 6 pods across 3 namespaces.
```

### List Deployments

**Query**: "How many deployments are in the default namespace?"

**Expected AI Response**: Argus AI calls `list_deployments` scoped to the `default` namespace.

Example Output:
```
There are 2 deployments in the default namespace:

| Name | Ready | Available | Image |
|---|---|---|---|
| web-app | 2/2 | 2 | nginx:1.25 |
| redis-cache | 1/1 | 1 | redis:7-alpine |
```

### Describe a Deployment

**Query**: "Describe the web-app deployment"

**Expected AI Response**: Argus AI calls `describeDeployment` for the `web-app` deployment in the `default` namespace.

Example Output:
```
Deployment: web-app
Namespace: default
Replicas: 2
Ready: 2/2
Available: 2
Updated: 2
Image: nginx:1.25

Conditions:
- Available: True (deployment has minimum availability)
- Progressing: True (ReplicaSet has successfully progressed)
```

### Pod Logs

**Query**: "Show me the logs for pod web-app-7d8f9c6b4f-abc12"

**Expected AI Response**: Argus AI calls `getPodLogs` for the specified pod.

Example Output:
```
Logs for web-app-7d8f9c6b4f-abc12 (default namespace):

[2026-06-05T14:32:01Z] INFO  Server listening on port 8080
[2026-06-05T14:32:02Z] INFO  Connected to database
[2026-06-05T14:32:05Z] DEBUG Processing request GET /api/health
[2026-06-05T14:32:06Z] INFO  Health check passed
[2026-06-05T14:35:10Z] WARN  High memory usage: 85%
```

### List Namespaces

**Query**: "What namespaces exist in my cluster?"

**Expected AI Response**: Argus AI calls `listNamespaces` and returns all namespaces.

Example Output:
```
Your cluster has the following namespaces:

| Name | Status |
|---|---|
| default | Active |
| kube-system | Active |
| kube-public | Active |
| kube-node-lease | Active |
```

## Live Prometheus Queries

These examples assume the Prometheus connector is configured with a valid Prometheus URL. The LLM uses the `query_metrics` tool to run instant PromQL queries.

### Query Cluster Metrics

**Query**: "How many Prometheus targets are up?"

**Expected AI Response**: Argus AI calls `query_metrics` with the PromQL expression `up` and returns the current state of all scraped targets.

Example Output:
```
Prometheus targets currently being scraped:

| Job | Instance | Status |
|---|---|---|
| prometheus | localhost:9090 | up (1) |
| argus-ai | argus-ai:3000 | down (0) |

1 target is up, 1 target is down.
```

### Query CPU / Memory

**Query**: "What's the current memory usage of my containers?"

**Expected AI Response**: Argus AI calls `query_metrics` with a PromQL expression like `sum(container_memory_usage_bytes) / 1e6` and returns the result in MB.

Example Output:
```
Total container memory usage across the cluster: approximately 1,245 MB.
```

## Live Loki Queries

These examples assume the Loki connector is configured with a valid Loki URL. The LLM uses `query_logs` and `summarize_errors` to inspect log data.

### Query Recent Logs

**Query**: "Show me error logs from the api-gateway in the last hour."

**Expected AI Response**: Argus AI calls `query_logs` with `labelSelector="app=\"api-gateway\""`, `level="error"`, and `start="1h"`. It returns matching log entries.

Example Output:
```
Error Logs for api-gateway (Last 1 hour):

Found 12 error log entries.

Recent errors:
- 14:32:01 - ERROR: upstream connect error or disconnect/reset before headers
- 14:32:02 - ERROR: connection refused to auth-service:8080
- 14:35:10 - ERROR: rate limit exceeded for client IP 10.0.1.50
- 14:40:00 - ERROR: upstream connect error or disconnect/reset before headers
- 14:40:01 - ERROR: connection refused to auth-service:8080

Pattern detected: The errors correlate with a brief auth-service outage between 14:32 and 14:40 UTC.
```

### Summarize Errors

**Query**: "Summarize errors from the last 2 hours."

**Expected AI Response**: Argus AI calls `summarize_errors` with `hours=2` and returns a grouped summary of error-level log entries.

Example Output:
```
Error Summary (Last 2 hours):

| Source | Count | Top Message |
|---|---|---|
| api-gateway | 12 | upstream connect error or disconnect/reset before headers |
| auth-service | 5 | connection refused to database:5432 |
| web-app | 3 | OutOfMemoryError: Java heap space |

Total: 20 error entries across 3 sources.
```

## Live ArgoCD Queries

These examples assume the ArgoCD connector is configured with valid `ARGOCD_URL` and `ARGOCD_TOKEN`. The LLM uses `list_argocd_apps`, `get_argocd_app`, and `argocd_summary` to inspect ArgoCD application state.

### List All ArgoCD Applications

**Query**: "What ArgoCD applications are deployed?"

**Expected AI Response**: Argus AI calls `list_argocd_apps` and returns a formatted table of all applications.

Example Output:
```
ArgoCD Applications:

| Name | Sync Status | Health Status | Revision |
|---|---|---|---|
| guestbook | Synced | Healthy | main@abc1234 |
| web-app | Synced | Healthy | main@def5678 |
| api-gateway | OutOfSync | Healthy | main@ghi9012 |
| redis-cache | Synced | Degraded | main@jkl3456 |

3 applications are synced, 1 is out of sync.
3 applications are healthy, 1 is degraded.
```

### Get Specific Application Status

**Query**: "Show me the sync status of the guestbook application"

**Expected AI Response**: Argus AI calls `get_argocd_app` for the `guestbook` application.

Example Output:
```
ArgoCD Application: guestbook

Sync Status: Synced
Health Status: Healthy
Target Revision: main@abc1234
```

### ArgoCD Cluster Summary

**Query**: "Give me a summary of all ArgoCD applications"

**Expected AI Response**: Argus AI calls `argocd_summary` and returns a cluster-wide overview.

Example Output:
```
ArgoCD Cluster Summary:

Sync Status:
- Synced: 3
- OutOfSync: 1

Health Status:
- Healthy: 3
- Degraded: 1
- Missing: 0

Total: 4 applications
```

## Incident Summary

**Query**: "Summarize the incident with the `web-app` deployment in the `production` namespace over the last 2 hours."

**Expected AI Response**: Argus AI would query Kubernetes for recent events and pod statuses, Prometheus for relevant metrics (e.g., CPU, memory, error rates), and Loki for logs related to the `web-app` deployment. It would then synthesize this information into a concise summary, highlighting key events, potential causes, and observed symptoms.

Example Output:
```
Incident Summary for web-app deployment (production namespace) - Last 2 hours:

Observed a spike in HTTP 5xx errors (up to 15% of requests) starting at 14:30 UTC. Prometheus metrics show a corresponding increase in CPU utilization for web-app pods, reaching 90%. Loki logs indicate frequent 'OutOfMemory' errors from web-app instances between 14:35 and 15:10 UTC, leading to multiple pod restarts. Kubernetes events confirm pod evictions due to resource constraints. The issue appears to have resolved itself around 15:15 UTC after automatic pod restarts and scaling adjustments.

Root Cause (likely): Temporary resource exhaustion due to unexpected traffic surge.
Impact: Intermittent service unavailability for web-app users.
Resolution: Automatic pod restarts and scaling. No manual intervention required.
```

## Pod Restart Analysis

**Query**: "Why did the `auth-service` pod restart frequently in the `staging` namespace yesterday?"

**Expected AI Response**: Argus AI would investigate Kubernetes events for the `auth-service` pod, looking for restart reasons (e.g., OOMKilled, CrashLoopBackOff). It would also check Loki for logs from the `auth-service` around the restart times to identify any application-level errors or exceptions that might have led to the crashes.

Example Output:
```
Analysis of auth-service pod restarts (staging namespace) - Yesterday:

Kubernetes events show 7 restarts for the auth-service pod yesterday, primarily due to 'CrashLoopBackOff'. The most common termination reason was 'Error'.

Loki logs from the auth-service reveal a recurring 'java.lang.NullPointerException' in the `UserAuthenticator.authenticate()` method, particularly between 02:00 and 04:00 UTC and again from 18:00 to 20:00 UTC. This error appears to be triggered when processing malformed authentication requests.

Recommendation: Review the `UserAuthenticator.authenticate()` code for null-safety and add robust input validation to prevent these exceptions.
```

## Deployment Health Check

**Query**: "Is the `payment-gateway` deployment healthy in `production`?"

**Expected AI Response**: Argus AI would query Kubernetes for the deployment's status, checking the number of ready replicas against desired replicas. It might also check Prometheus for application-specific health metrics or ArgoCD for its sync status if the application is managed by ArgoCD.

Example Output:
```
Deployment Health Check for payment-gateway (production namespace):

Kubernetes Status: All 3 desired replicas are running and ready.
Prometheus Health Metrics: No critical alerts or unusual error rates detected.
ArgoCD Sync Status: Synced and Healthy.

Overall: The `payment-gateway` deployment appears healthy.
```

## Postmortem Analysis

**Query**: "Provide a postmortem analysis for the database outage that occurred last Tuesday between 10:00 and 11:00 UTC."

**Expected AI Response**: Argus AI would correlate data from multiple sources for the specified time frame. It would look at Kubernetes events for database pods, Prometheus metrics for database performance (e.g., connection errors, latency, disk I/O), and Loki logs for any errors or warnings from the database instances. It would then synthesize this into a postmortem summary.

Example Output:
```
Postmortem Analysis: Database Outage (Last Tuesday, 10:00-11:00 UTC):

Timeline:
- 10:00 UTC: Initial alert triggered by Prometheus for high database connection errors.
- 10:05 UTC: Kubernetes events show database primary pod restarting due to 'NodeNotReady' condition.
- 10:10 UTC: Loki logs indicate a sudden increase in disk I/O errors on the node hosting the database.
- 10:30 UTC: Database replica promoted to primary, but connection issues persisted due to underlying storage problems.
- 10:55 UTC: Node hosting database was drained and restarted by infrastructure team.
- 11:00 UTC: Database service restored, all metrics returned to normal.

Root Cause: Underlying storage issue on the Kubernetes node hosting the primary database pod, leading to disk I/O errors and subsequent node unreadiness.
Impact: 60 minutes of database unavailability, affecting all services dependent on the database.
Resolution: Node restart and automatic database failover/recovery.
Lessons Learned: Improve monitoring for underlying node storage health. Explore multi-zone database deployments for higher availability.
```
