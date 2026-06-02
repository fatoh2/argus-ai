import { Injectable } from '@nestjs/common';
import { KubernetesConnector } from './kubernetes.connector';
import { PrometheusConnector } from './prometheus.connector';

@Injectable()
export class K8sPrometheusConnector {
  constructor(
    private readonly kubernetesConnector: KubernetesConnector,
    private readonly prometheusConnector: PrometheusConnector,
  ) {}

  // Kubernetes Operations
  async listPods(namespace: string = 'default'): Promise<any[]> {
    console.log(`K8sPrometheusConnector: Listing pods in namespace: ${namespace}`);
    try {
      return await this.kubernetesConnector.listPods(namespace);
    } catch (error) {
      console.error(`Error listing pods in namespace ${namespace}: ${error.message}`);
      return []; // Return empty array on error
    }
  }

  async getPodLogs(podName: string, namespace: string = 'default'): Promise<string> {
    console.log(`K8sPrometheusConnector: Getting logs for pod ${podName} in namespace: ${namespace}`);
    try {
      return await this.kubernetesConnector.getPodLogs(podName, namespace);
    } catch (error) {
      console.error(`Error getting logs for pod ${podName} in namespace ${namespace}: ${error.message}`);
      return ''; // Return empty string on error
    }
  }

  async describeDeployment(deploymentName: string, namespace: string = 'default'): Promise<any> {
    console.log(`K8sPrometheusConnector: Describing deployment ${deploymentName} in namespace: ${namespace}`);
    try {
      return await this.kubernetesConnector.describeDeployment(deploymentName, namespace);
    } catch (error) {
      console.error(`Error describing deployment ${deploymentName} in namespace ${namespace}: ${error.message}`);
      return {}; // Return empty object on error
    }
  }

  // Prometheus Operations
  async queryPrometheus(query: string): Promise<any> {
    console.log(`K8sPrometheusConnector: Querying Prometheus with: ${query}`);
    try {
      return await this.prometheusConnector.instantQuery(query); // Assuming instantQuery is the general query method
    } catch (error) {
      console.error(`Error querying Prometheus with query ${query}: ${error.message}`);
      return {}; // Return empty object on error
    }
  }

  async instantQueryPrometheus(query: string): Promise<any> {
    console.log(`K8sPrometheusConnector: Executing instant query: ${query}`);
    try {
      return await this.prometheusConnector.instantQuery(query);
    } catch (error) {
      console.error(`Error executing instant query ${query}: ${error.message}`);
      return {}; // Return empty object on error
    }
  }

  async rangeQueryPrometheus(query: string, start: string, end: string, step: string = '1m'): Promise<any> {
    console.log(`K8sPrometheusConnector: Executing range query: ${query} from ${start} to ${end} with step ${step}`);
    try {
      // PrometheusConnector expects numbers for start and end, but the review feedback implies string inputs.
      // Assuming start and end can be parsed to numbers or are already in a compatible format for the underlying connector.
      // For now, passing them as strings and letting the underlying connector handle it, or adjust if needed.
      return await this.prometheusConnector.rangeQuery(query, Number(start), Number(end), step);
    } catch (error) {
      console.error(`Error executing range query ${query} from ${start} to ${end}: ${error.message}`);
      return {}; // Return empty object on error
    }
  }
}
