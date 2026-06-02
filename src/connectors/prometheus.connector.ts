import { Injectable, Logger } from '@nestjs/common';

/** Prometheus connector — queries metrics API.
 *  Gracefully returns empty data when PROMETHEUS_URL is not set. */
@Injectable()
export class PrometheusConnector {
  private readonly logger = new Logger(PrometheusConnector.name);
  private readonly url: string;

  constructor() {
    this.url = process.env.PROMETHEUS_URL || '';
    if (!this.url) this.logger.warn('[prometheus] PROMETHEUS_URL not set — offline mode');
  }

  async instantQuery(query: string): Promise<any> {
    if (!this.url) return { status: 'connector offline', reason: 'PROMETHEUS_URL not configured' };
    try {
      const res = await fetch(`${this.url}/api/v1/query?query=${encodeURIComponent(query)}`);
      return await res.json();
    } catch (e: any) {
      this.logger.error(`instantQuery failed: ${e.message}`);
      return { status: 'error', error: e.message };
    }
  }

  async rangeQuery(query: string, start: number, end: number, step = '1m'): Promise<any> {
    if (!this.url) return { status: 'connector offline' };
    try {
      const params = new URLSearchParams({ query, start: String(start), end: String(end), step });
      const res = await fetch(`${this.url}/api/v1/query_range?${params}`);
      return await res.json();
    } catch (e: any) {
      this.logger.error(`rangeQuery failed: ${e.message}`);
      return { status: 'error', error: e.message };
    }
  }
}
