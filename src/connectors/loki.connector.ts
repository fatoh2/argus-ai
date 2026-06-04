import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as https from 'https';
import * as http from 'http';

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
  private readonly available: boolean;

  constructor(private configService: ConfigService) {
    this.baseUrl = this.configService.get<string>('loki.url', 'http://localhost:3100');
    // Check if LOKI_URL env var is explicitly set; if not, connector is offline
    this.available = !!process.env.LOKI_URL;
    if (!this.available) this.logger.warn('[loki] LOKI_URL not set — running in offline mode');
  }

  /** Returns true if LOKI_URL is configured. */
  async isHealthy(): Promise<boolean> {
    if (!this.available) return false;
    try {
      const response = await this.request('/ready');
      return response.statusCode === 200;
    } catch (error: any) {
      this.logger.error(`Loki health check failed: ${error.message}`);
      return false;
    }
  }

  /**
   * Execute a LogQL range query over a time range.
   * Returns log entries with their labels and timestamps.
   */
  async queryRange(options: LokiQueryOptions): Promise<LokiQueryResult> {
    if (!this.available) {
      return { status: 'connector offline', data: { result: [] } };
    }

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

    try {
      const response = await this.request(`/loki/api/v1/query_range?${params.toString()}`);
      const body = JSON.parse(response.body);

      if (response.statusCode !== 200) {
        throw new Error(`Loki returned status ${response.statusCode}: ${body.message || 'unknown error'}`);
      }

      return this.transformResult(body);
    } catch (error: any) {
      this.logger.error(`Loki query failed: ${error.message}`);
      return { status: 'error', data: { result: [] } };
    }
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
  ): Promise<LokiQueryResult> {
    let query = `{${labelSelector}}`;

    if (level) {
      query += ` |= \`${level}\``;
    }

    return this.queryRange({ query, start, end, limit });
  }

  /**
   * Summarize errors from the last N hours.
   * This is the key method for "summarize errors from the last hour".
   */
  async summarizeErrors(hours: number = 1, labelSelector: string = '{}'): Promise<string> {
    if (!this.available) {
      return 'Loki connector offline — LOKI_URL not configured.';
    }

    const end = new Date().toISOString();
    const start = new Date(Date.now() - hours * 3600000).toISOString();

    // Query for error-level logs
    const query = `{${labelSelector}} |= \`error\``;

    try {
      const result = await this.queryRange({ query, start, end, limit: 500 });
      const entries = result.data.result;

      if (entries.length === 0) {
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
    } catch (error: any) {
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

  private transformResult(raw: any): LokiQueryResult {
    const streams = raw?.data?.result || [];
    const entries: LokiLogEntry[] = [];

    for (const stream of streams) {
      const labels = stream?.stream || {};
      const values = stream?.values || [];
      for (const [timestamp, line] of values) {
        entries.push({
          timestamp,
          line,
          labels,
        });
      }
    }

    return {
      status: raw?.status || 'success',
      data: {
        result: entries,
        stats: raw?.data?.stats,
      },
    };
  }

  private request(path: string): Promise<{ statusCode: number; body: string }> {
    return new Promise((resolve, reject) => {
      const url = new URL(path, this.baseUrl);
      const lib = url.protocol === 'https:' ? https : http;

      const req = lib.get(url.toString(), { timeout: 10000 }, (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          resolve({ statusCode: res.statusCode || 500, body: data });
        });
      });

      req.on('error', (err) => reject(err));
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timed out'));
      });
    });
  }
}
