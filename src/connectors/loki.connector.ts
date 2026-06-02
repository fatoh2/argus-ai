import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as https from 'https';
import * as http from 'http';
import {
  withConnectorErrorHandling,
  ConnectorErrorResult,
} from './utils/connector-error';

export interface LokiQueryOptions {
  query: string;
  start?: string; // ISO 8601 or relative like "1h"
  end?: string;   // ISO 8601
  limit?: number;  // Max lines, capped at 500
}

export interface LokiLogEntry {
  timestamp: string;
  line: string;
  labels: Record<string, string>;
}

export interface LokiQueryResult {
  status: string;
  data: {
    result: LokiLogEntry[];
    stats?: any;
  };
}

@Injectable()
export class LokiConnector {
  private readonly logger = new Logger(LokiConnector.name);
  private readonly baseUrl: string;
  private readonly defaultLimit = 500;

  constructor(private configService: ConfigService) {
    this.baseUrl = this.configService.get<string>('loki.url', 'http://localhost:3100');
  }

  /**
   * Health check — verifies Loki is reachable
   */
  async isHealthy(): Promise<boolean> {
    try {
      const response = await this.request('/ready');
      return response.statusCode === 200;
    } catch (error) {
      this.logger.error(`Loki health check failed: ${error.message}`);
      return false;
    }
  }

  /**
   * Execute a LogQL range query over a time range.
   * Returns log entries with their labels and timestamps.
   */
  async queryRange(options: LokiQueryOptions): Promise<LokiQueryResult | ConnectorErrorResult<LokiQueryResult>> {
    return withConnectorErrorHandling('loki', async (signal) => {
      const { query, start, end, limit } = options;
      const effectiveLimit = Math.min(limit ?? this.defaultLimit, 500);

      // Parse time range — default to last 1 hour
      const now = new Date();
      const startTime = start ? this.parseTime(start) : new Date(now.getTime() - 3600000);
      const endTime = end ? this.parseTime(end) : now;

      const params = new URLSearchParams({
        query,
        start: String(startTime.getTime() * 1000000), // Loki uses nanoseconds
        end: String(endTime.getTime() * 1000000),
        limit: String(effectiveLimit),
        direction: 'backward',
      });

      this.logger.debug(`Loki range query: ${query} from ${startTime.toISOString()} to ${endTime.toISOString()}`);

      const response = await this.request(`/loki/api/v1/query_range?${params.toString()}`, signal);
      const body = JSON.parse(response.body);

      if (response.statusCode !== 200) {
        throw new Error(`Loki returned status ${response.statusCode}: ${body.message || 'unknown error'}`);
      }

      return this.transformResult(body);
    });
  }

  /**
   * Convenience: query logs for a specific service/label over a time range.
   */
  async queryLogs(
    labelSelector: string,
    start?: string,
    end?: string,
    level?: string,
    limit?: number,
  ): Promise<LokiQueryResult | ConnectorErrorResult<LokiQueryResult>> {
    return withConnectorErrorHandling('loki', async (signal) => {
      let query = `{${labelSelector}}`;

      if (level) {
        query += ` |= \`${level}\``;
      }

      return this.queryRange({ query, start, end, limit });
    });
  }

  /**
   * Summarize errors from the last N hours.
   * This is the key method for "summarize errors from the last hour".
   */
  async summarizeErrors(hours: number = 1, labelSelector: string = '{}'): Promise<string> {
    try {
      const end = new Date().toISOString();
      const start = new Date(Date.now() - hours * 3600000).toISOString();

      // Query for error-level logs
      const query = `{${labelSelector}} |= \`error\``;

      const result = await this.queryRange({ query, start, end, limit: 500 });
      const entries = result.data?.result;

      if (!entries || entries.length === 0) {

        return `No error logs found in the last ${hours} hour(s).`;
      }

      // Group by labels for summary
      const bySource: Record<string, number> = {};
      const byMessage: Record<string, number> = {};

      for (const entry of entries) {
        const source = Object.values(entry.labels).join('/') || 'unknown';
        bySource[source] = (bySource[source] || 0) + 1;

        // Extract a short error message prefix
        const shortMsg = entry.line.substring(0, 120).trim();
        byMessage[shortMsg] = (byMessage[shortMsg] || 0) + 1;
      }

      const topSources = Object.entries(bySource)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([source, count]) => `  - ${source}: ${count} errors`)
        .join('\n');

      const topMessages = Object.entries(byMessage)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([msg, count]) => `  - "${msg}" (${count}x)`)
        .join('\n');

      return [
        `Found ${entries.length} error log entries in the last ${hours} hour(s).`,
        '',
        'Top sources:',
        topSources,
        '',
        'Top error messages:',
        topMessages,
      ].join('\n');
    } catch (error) {
      return `Failed to query Loki for errors: ${error.message}`;
    }
  }

  private parseTime(timeStr: string): Date {
    // ISO 8601
    const isoDate = new Date(timeStr);
    if (!isNaN(isoDate.getTime())) return isoDate;

    // Relative like "1h", "30m"
    const match = timeStr.match(/^(\d+)(h|m|s)$/);
    if (match) {
      const value = parseInt(match[1], 10);
      const unit = match[2];
      const ms = unit === 'h' ? value * 3600000 : unit === 'm' ? value * 60000 : value * 1000;
      return new Date(Date.now() - ms);
    }

    // Default to 1 hour ago
    return new Date(Date.now() - 3600000);
  }

  private request(path: string, signal?: AbortSignal): Promise<{ statusCode: number; body: string }> {
    return new Promise((resolve, reject) => {
      const url = new URL(path, this.baseUrl);
      const lib = url.protocol === 'https:' ? https : http;

      const req = lib.get(url.toString(), { timeout: 10000, signal }, (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          resolve({ statusCode: res.statusCode || 500, body: data });
        });
      });

      req.on('error', (err) => {
        // AbortError is expected on timeout — reject so withConnectorErrorHandling catches it
        if (err.name === 'AbortError') {
          reject(new Error('Request timed out'));
        } else {
          reject(err);
        }
      });
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timed out'));
      });
    });
  }

  private transformResult(raw: any): LokiQueryResult {
    const result: LokiLogEntry[] = [];

    if (raw?.data?.result) {
      for (const stream of raw.data.result) {
        const labels = stream.stream || {};
        const values = stream.values || [];

        for (const [timestamp, line] of values) {
          result.push({
            timestamp: new Date(parseInt(timestamp, 10) / 1000000).toISOString(),
            line: String(line),
            labels,
          });
        }
      }
    }

    return {
      status: raw?.status || 'unknown',
      data: {
        result,
        stats: raw?.data?.stats,
      },
    };
  }
}
