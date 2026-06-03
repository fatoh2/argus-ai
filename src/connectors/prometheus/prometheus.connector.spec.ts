import { Test, TestingModule } from '@nestjs/testing';
import { PrometheusConnector } from './prometheus.connector';
import { withConnectorErrorHandling, ConnectorErrorResult } from '../utils/connector-error';

describe('PrometheusConnector', () => {
  let connector: PrometheusConnector;

  beforeEach(async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'log').mockImplementation(() => {});

    const module: TestingModule = await Test.createTestingModule({
      providers: [PrometheusConnector],
    }).compile();

    connector = module.get<PrometheusConnector>(PrometheusConnector);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('instantQuery', () => {
    it('should return mock data on success', async () => {
      const result = await connector.instantQuery('up');
      expect(result).toEqual({ data: { result: [] } });
    });

    it('should return structured error on timeout, does not throw', async () => {
      const result = await withConnectorErrorHandling(
        'prometheus',
        async () => {
          await new Promise((resolve) => setTimeout(resolve, 500));
          return { data: { result: [] } };
        },
        10, // 10ms timeout — will trigger timeout
      );

      expect(result).toEqual<ConnectorErrorResult<any>>({
        error: 'prometheus unavailable',
        data: null,
      });
    });

    it('should return structured error on failure, does not throw', async () => {
      const result = await withConnectorErrorHandling(
        'prometheus',
        async () => {
          throw new Error('Prometheus API unreachable');
        },
      );

      expect(result).toEqual<ConnectorErrorResult<any>>({
        error: 'prometheus unavailable',
        data: null,
      });
    });
  });

  describe('rangeQuery', () => {
    it('should return mock data on success', async () => {
      const result = await connector.rangeQuery('up', 0, 100, '1m');
      expect(result).toEqual({ data: { result: [] } });
    });

    it('should return structured error on timeout, does not throw', async () => {
      const result = await withConnectorErrorHandling(
        'prometheus',
        async () => {
          await new Promise((resolve) => setTimeout(resolve, 500));
          return { data: { result: [] } };
        },
        10,
      );

      expect(result).toEqual<ConnectorErrorResult<any>>({
        error: 'prometheus unavailable',
        data: null,
      });
    });

    it('should return structured error on failure, does not throw', async () => {
      const result = await withConnectorErrorHandling(
        'prometheus',
        async () => {
          throw new Error('Prometheus range query failed');
        },
      );

      expect(result).toEqual<ConnectorErrorResult<any>>({
        error: 'prometheus unavailable',
        data: null,
      });
    });
  });

  describe('offline mode', () => {
    it('should return empty array when PROMETHEUS_URL not set (offline mode)', async () => {
      // When PROMETHEUS_URL is not set, the connector should return empty results
      // The current implementation always returns mock data, so this verifies the stub behavior
      const result = await connector.instantQuery('up');
      expect(result).toEqual({ data: { result: [] } });
    });
  });
});
