import { Injectable } from '@nestjs/common';

@Injectable()
export class PrometheusConnector {
  async instantQuery(query: string): Promise<any> {
    console.log('Executing instant query: ');
    // TODO: Implement Prometheus instant query
    return {};
  }

  async rangeQuery(query: string, start: number, end: number, step: string): Promise<any> {
    console.log('Executing range query:  from  to  with step ');
    // TODO: Implement Prometheus range query
    return {};
  }
}
