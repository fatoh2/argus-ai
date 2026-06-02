# Example Queries and AI Responses

This document provides examples of natural language queries you can ask Argus AI and the types of responses you can expect. These examples demonstrate how Argus AI leverages its various connectors to provide insightful and actionable information.

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

## Log Analysis with Loki

**Query**: "Show me all error logs from the 'api-gateway' service in the last hour."

**Expected AI Response**: Argus AI would use the Loki connector's `queryLogs` method with the label selector `app="api-gateway"` and level filter for errors. It would return the matching log entries with timestamps.

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

**Query**: "Summarize errors from all services in the last 2 hours."

**Expected AI Response**: Argus AI would use the Loki connector's `summarizeErrors` method to aggregate error logs across all services, grouped by source and message.

Example Output:
```
Error Summary (Last 2 hours):

Found 47 error log entries across all services.

Top sources:
  - api-gateway/production: 18 errors
  - auth-service/production: 12 errors
  - database/production: 9 errors
  - worker/production: 5 errors
  - frontend/production: 3 errors

Top error messages:
  - "ERROR: upstream connect error or disconnect/reset before headers" (15x)
  - "ERROR: connection refused to auth-service:8080" (10x)
  - "ERROR: query execution timeout exceeded" (7x)
  - "ERROR: disk I/O error on /data volume" (5x)
  - "ERROR: rate limit exceeded for client" (3x)
```

## ArgoCD Application Status

**Query**: "What is the status of the 'my-app-frontend' ArgoCD application?"

**Expected AI Response**: Argus AI would use the ArgoCD connector's `getAppStatus` method to fetch the sync and health status of the specified application.

Example Output:
```
ArgoCD Application Status: my-app-frontend

Application: my-app-frontend
  Namespace: default
  Sync Status: Synced
  Health Status: Healthy
  Revision: abc123def456

The application is currently synced and healthy.
```

**Query**: "Give me a summary of all ArgoCD applications."

**Expected AI Response**: Argus AI would use the ArgoCD connector's `getClusterSummary` method to get a comprehensive overview of all applications managed by ArgoCD.

Example Output:
```
ArgoCD Cluster Summary:
  Total applications: 8
  Synced: 7/8
  Healthy: 6/8

Out of sync applications:
  - my-app-frontend (sync: OutOfSync, health: Healthy)

Unhealthy applications:
  - payment-worker (sync: Synced, health: Degraded)
  - my-app-frontend (sync: OutOfSync, health: Healthy)
```

## GitHub Actions Workflow Failure

**Query**: "What caused the last failed GitHub Actions workflow run for the `ci.yml` workflow on the `main` branch of `fatoh2/argus-monitor`?"

**Expected AI Response**: Argus AI would use the GitHub Actions connector to find the latest failed run of the specified workflow and branch. It would then retrieve details about the failed job and steps, including any error messages or logs available through the GitHub API.

Example Output:
```
Last Failed GitHub Actions Workflow Run (fatoh2/argus-monitor, main branch, ci.yml):

Run ID: 1234567890
Status: Failed
Timestamp: 2023-10-27 10:15:30 UTC

Failed Job: 'build-and-test'
Failed Step: 'Run unit tests'
Error Message: "Error: Test suite failed: Expected 10 tests to pass, but 2 failed. See logs for details."

Recommendation: Review the unit test logs for the 'build-and-test' job to identify the specific test failures.
```

## Multi-Connector Query

**Query**: "Is there any correlation between the recent Loki error logs and the Prometheus CPU spike in the 'production' namespace?"

**Expected AI Response**: Argus AI would query Loki for recent error logs in the 'production' namespace and Prometheus for CPU metrics over the same time period. It would then correlate the data to identify any relationships.

Example Output:
```
Correlation Analysis: Loki Errors vs Prometheus CPU (production namespace, Last 1 hour):

Loki found 23 error log entries, primarily from the 'api-gateway' service.
Prometheus shows a CPU spike from 45% to 92% on 'api-gateway' pods between 14:30 and 14:35 UTC.

The error logs show 'upstream connect timeout' errors starting at 14:31 UTC, which aligns with the CPU spike. This suggests the CPU spike was caused by a backlog of requests timing out.

Recommendation: Investigate the upstream service that the api-gateway connects to. Consider increasing the upstream timeout or adding circuit breaker logic.
```

## ArgoCD Application Status

**Query**: "What is the sync status of the `my-app-frontend` ArgoCD application?"

**Expected AI Response**: Argus AI would use the ArgoCD connector's `getAppStatus()` method to fetch the sync and health status of the specified application.

Example Output:
```
ArgoCD Application Status: my-app-frontend

  Namespace: default
  Sync Status: Synced
  Health Status: Healthy
  Revision: abc123def456
```

## ArgoCD Cluster Summary

**Query**: "Give me a summary of all ArgoCD applications and their health status."

**Expected AI Response**: Argus AI would use the ArgoCD connector's `getClusterSummary()` method, which lists all applications and highlights any that are out of sync or unhealthy.

Example Output:
```
ArgoCD Cluster Summary:
  Total applications: 12
  Synced: 10/12
  Healthy: 9/12

Out of sync applications:
  - my-app-frontend (sync: OutOfSync, health: Healthy)
  - payment-worker (sync: OutOfSync, health: Degraded)

Unhealthy applications:
  - payment-worker (sync: OutOfSync, health: Degraded)
  - database-backup (sync: Synced, health: Degraded)
```

## Rate Limit Exceeded

**Query**: (Any query sent more than 20 times in a minute)

**Expected AI Response**: If you exceed the rate limit, the API returns a `429 Too Many Requests` response instead of the usual JSON. The response includes a `Retry-After` header (the authoritative source for retry timing) indicating the number of seconds to wait before retrying.

Example Response (HTTP 429):
```json
{
  "statusCode": 429,
  "message": "Too Many Requests",
  "retryAfterSeconds": 45
}
```

> **Note**: The `Retry-After` HTTP header is the authoritative source for retry timing. The `retryAfterSeconds` field in the JSON body is provided for convenience and will always match the header value.

The server also logs the event with a hashed IP address for monitoring:
```
Rate limit hit — IP hash: a1b2c3d4e5f6..., timeToExpire: 45000ms
```

**What to do**: Wait the number of seconds specified in the `Retry-After` header before sending another request. The limit resets on a rolling 60-second window per IP address.
\n## Rate Limit Exceeded\n\n**Query**: (Any query sent more than 20 times in a minute)\n\n**Expected AI Response**: If you exceed the rate limit, the API returns a `429 Too Many Requests` response instead of the usual JSON. The response includes a `Retry-After` header (the authoritative source for retry timing) indicating the number of seconds to wait before retrying.\n\nExample Response (HTTP 429):\n```json\n{\n  "statusCode": 429,\n  "message": "Too Many Requests",\n  "retryAfterSeconds": 45\n}\n```\n\n> **Note**: The `Retry-After` HTTP header is the authoritative source for retry timing. The `retryAfterSeconds` field in the JSON body is provided for convenience and will always match the header value.\n\nThe server also logs the event with a hashed IP address for monitoring:\n```\nRate limit hit — IP hash: a1b2c3d4e5f6..., timeToExpire: 45000ms\n```\n\n**What to do**: Wait the number of seconds specified in the `Retry-After` header before sending another request. The limit resets on a rolling 60-second window per IP address.
