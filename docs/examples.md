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

Recommendation: Review the logs for the 'Run unit tests' step in workflow run 1234567890 to identify the specific test failures.
```

## Pod Restart Analysis (Advanced)

**Query**: "Analyze the restarts of `nginx-ingress` pods in the `ingress-nginx` namespace over the last 7 days, focusing on resource-related issues."

**Expected AI Response**: Argus AI would query Kubernetes for all restart events of `nginx-ingress` pods in the specified namespace and timeframe. It would specifically look for termination reasons like `OOMKilled` (Out Of Memory Killed) or `ContainerCreating` errors related to resource limits. It would also check Prometheus for historical CPU and memory usage of these pods to identify if they consistently hit resource limits before restarting.

Example Output:
```
Analysis of nginx-ingress pod restarts (ingress-nginx namespace) - Last 7 days:

Observed 12 restarts across 3 different nginx-ingress pods. 8 of these restarts were due to 'OOMKilled' (Out Of Memory Killed) termination reason, primarily occurring during peak traffic hours (18:00-22:00 UTC).

Prometheus metrics confirm that memory usage for these pods frequently exceeded their configured limits (256Mi) just prior to the 'OOMKilled' events. CPU utilization also showed spikes, but memory appears to be the primary constraint.

Recommendation: Increase the memory limits for the nginx-ingress deployment in the ingress-nginx namespace. Consider setting a higher request value as well to ensure adequate resources are allocated during startup.
```
