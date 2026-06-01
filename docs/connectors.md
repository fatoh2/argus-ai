# Connectors

Argus AI integrates with various infrastructure components to provide comprehensive insights. All connectors are read-only to ensure the safety and integrity of your systems.

## Kubernetes Connector

**Purpose**: Provides information about your Kubernetes cluster, including pod status, deployments, and events.

**How it works**: Connects to the Kubernetes API server using in-cluster service accounts or a provided kubeconfig file. It fetches data such as:

- Pod status and details
- Deployment and StatefulSet status
- Cluster events

**Example Questions**: 
- \"What is the status of pods with the label \'app=my-app\' in the \'production\' namespace?\"
- \"List all events in the \'staging\' namespace from the last hour.\"

## Prometheus Connector

**Purpose**: Enables querying Prometheus for metrics and time-series data.

**How it works**: Executes PromQL queries against your Prometheus instance. It can retrieve historical and real-time metric data.

**Example Questions**: 
- \"What is the average CPU utilization for the \'web-server\' deployment over the last 24 hours?\"
- \"Show me the rate of HTTP 5xx errors from the \'api-gateway\' service in the last 6 hours.\"

## Loki Connector

**Purpose**: Allows searching and analyzing logs stored in Loki.

**How it works**: Queries Loki using LogQL to retrieve log streams based on labels and time ranges. By default, queries are capped at 500 lines to prevent excessive data retrieval.

**Example Questions**: 
- \"Find all error logs for the \'auth-service\' in the last 30 minutes.\"
- \"Show me logs from pods with the label \'component=database\' that contain the word \'failed\' in the \'production\' namespace.\"

## ArgoCD Connector

**Purpose**: Monitors the status of your ArgoCD applications.

**How it works**: Connects to the ArgoCD API to fetch the status of specified applications, including sync status and health.

**Example Questions**: 
- \"What is the sync status of the \'my-app-frontend\' ArgoCD application?\"
- \"Are all applications in the \'dev\' namespace healthy?\"

## GitHub Actions Connector

**Purpose**: Retrieves information about GitHub Actions workflows and runs.

**How it works**: Interacts with the GitHub API to fetch details about workflow runs for a given repository and branch.

**Example Questions**: 
- \"What was the status of the latest \'deploy\' workflow run on the \'main\' branch of the \'fatoh2/argus-ai\' repository?\"
- \"List the last 5 workflow runs for the \'build\' job in \'fatoh2/argus-monitor\'.\"

## Argus Monitor Connector (Optional)

**Purpose**: Integrates with the Argus Monitor platform to fetch alerts and wallet activity.

**How it works**: Connects to the Argus Monitor database (read-only replica) to retrieve specific data points.

**Example Questions**: 
- \"Show me all alerts triggered in the last 24 hours for \'user-123\'.\"
- \"What is the recent wallet activity for \'0xabc...def\' in the last 12 hours?\"

## Adding New Connectors

To add a new connector, please follow the guidelines in [CLAUDE.md](https://github.com/fatoh2/argus-ai/blob/main/CLAUDE.md#adding-a-new-connector). All new connectors require a security review and PM approval before merging.
