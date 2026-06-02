import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as https from 'https';
import * as http from 'http';
import {
  withConnectorErrorHandling,
  ConnectorErrorResult,
} from './utils/connector-error';

export interface ArgoCDAppStatus {
  name: string;
  namespace: string;
  syncStatus: string;
  healthStatus: string;
  summary: string;
}

export interface ArgoCDAppDetails {
  metadata: {
    name: string;
    namespace: string;
  };
  status: {
    sync: {
      status: string;
      revision?: string;
    };
    health: {
      status: string;
    };
    summary?: {
      images?: string[];
    };
  };
}

@Injectable()
export class ArgoCDConnector {
  private readonly logger = new Logger(ArgoCDConnector.name);
  private readonly baseUrl: string;
  private readonly token: string;

  constructor(private configService: ConfigService) {
    this.baseUrl = this.configService.get<string>('argocd.url', 'https://localhost:8080');
    this.token = this.configService.get<string>('argocd.token', '');
  }

  /**
   * Health check — verifies ArgoCD is reachable
   */
  async isHealthy(): Promise<boolean> {
    try {
      const response = await this.request('/api/v1/session/userinfo');
      return response.statusCode === 200;
    } catch (error) {
      this.logger.error(`ArgoCD health check failed: ${error.message}`);
      return false;
    }
  }

  /**
   * Get sync status and health for a specific ArgoCD application.
   */
  async getAppStatus(appName: string): Promise<ArgoCDAppStatus | ConnectorErrorResult<ArgoCDAppStatus>> {
    return withConnectorErrorHandling('argocd', async () => {
      this.logger.debug(`ArgoCD: fetching status for app ${appName}`);

      const response = await this.request(`/api/v1/applications/${encodeURIComponent(appName)}`);
      const body = JSON.parse(response.body);

      if (response.statusCode !== 200) {
        throw new Error(`ArgoCD returned status ${response.statusCode}: ${body.message || body.error || 'unknown error'}`);
      }

      return this.transformAppStatus(body);
    });
  }

  /**
   * List all applications with their sync and health status.
   */
  async listApps(): Promise<ArgoCDAppStatus[] | ConnectorErrorResult<ArgoCDAppStatus[]>> {
    return withConnectorErrorHandling('argocd', async () => {
      this.logger.debug('ArgoCD: listing all applications');

      const response = await this.request('/api/v1/applications');
      const body = JSON.parse(response.body);

      if (response.statusCode !== 200) {
        throw new Error(`ArgoCD returned status ${response.statusCode}: ${body.message || body.error || 'unknown error'}`);
      }

      const items = body.items || [];
      return items.map((item: any) => this.transformAppStatus(item));
    });
  }

  /**
   * Get a summary of all applications — healthy vs unhealthy.
   */
  async getClusterSummary(): Promise<string> {
    try {
      const apps = await this.listApps();

      if (Array.isArray(apps) && apps.length === 0) {
        return 'No ArgoCD applications found.';
      }

      if (!Array.isArray(apps)) {
        return `Failed to query ArgoCD: ${(apps as any)?.error || 'unknown error'}`;
      }

      const synced = apps.filter(a => a.syncStatus === 'Synced').length;
      const healthy = apps.filter(a => a.healthStatus === 'Healthy').length;
      const outOfSync = apps.filter(a => a.syncStatus !== 'Synced');
      const unhealthy = apps.filter(a => a.healthStatus !== 'Healthy');

      let summary = [
        `ArgoCD Cluster Summary:`,
        `  Total applications: ${apps.length}`,
        `  Synced: ${synced}/${apps.length}`,
        `  Healthy: ${healthy}/${apps.length}`,
      ].join('\n');

      if (outOfSync.length > 0) {
        summary += '\n\nOut of sync applications:';
        for (const app of outOfSync) {
          summary += `\n  - ${app.name} (sync: ${app.syncStatus}, health: ${app.healthStatus})`;
        }
      }

      if (unhealthy.length > 0) {
        summary += '\n\nUnhealthy applications:';
        for (const app of unhealthy) {
          summary += `\n  - ${app.name} (sync: ${app.syncStatus}, health: ${app.healthStatus})`;
        }
      }

      return summary;
    } catch (error) {
      return `Failed to query ArgoCD: ${error.message}`;
    }
  }

  private transformAppStatus(raw: any): ArgoCDAppStatus {
    const metadata = raw?.metadata || {};
    const status = raw?.status || {};
    const sync = status?.sync || {};
    const health = status?.health || {};

    const syncStatus = sync?.status || 'Unknown';
    const healthStatus = health?.status || 'Unknown';

    const summary = [
      `Application: ${metadata?.name || 'unknown'}`,
      `  Namespace: ${metadata?.namespace || 'default'}`,
      `  Sync Status: ${syncStatus}`,
      `  Health Status: ${healthStatus}`,
      sync?.revision ? `  Revision: ${sync.revision}` : '',
    ]
      .filter(Boolean)
      .join('\n');

    return {
      name: metadata?.name || 'unknown',
      namespace: metadata?.namespace || 'default',
      syncStatus,
      healthStatus,
      summary,
    };
  }

  private request(path: string): Promise<{ statusCode: number; body: string }> {
    return new Promise((resolve, reject) => {
      const url = new URL(path, this.baseUrl);
      const lib = url.protocol === 'https:' ? https : http;

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (this.token) {
        headers['Authorization'] = `Bearer ${this.token}`;
      }

      const req = lib.get(
        url.toString(),
        { headers, timeout: 10000 },
        (res) => {
          let data = '';
          res.on('data', (chunk) => (data += chunk));
          res.on('end', () => {
            resolve({ statusCode: res.statusCode || 500, body: data });
          });
        },
      );

      req.on('error', (err) => reject(err));
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timed out'));
      });
    });
  }
}
