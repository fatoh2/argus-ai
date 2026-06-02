import { withConnectorErrorHandling, ConnectorErrorResult } from './connector-error';

describe('withConnectorErrorHandling', () => {
  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns the result when the connector succeeds', async () => {
    const result = await withConnectorErrorHandling('test', async (_signal) => 'hello');
    expect(result).toBe('hello');
  });

  it('returns a structured error when the connector throws', async () => {
    const result = await withConnectorErrorHandling('test', async (_signal) => {
      throw new Error('k8s connection refused');
    });

    expect(result).toEqual<ConnectorErrorResult<string>>({
      error: 'test unavailable',
      data: null,
    });
  });

  it('returns a structured error on timeout', async () => {
    const result = await withConnectorErrorHandling(
      'test',
      async (_signal) => {
        await new Promise((resolve) => setTimeout(resolve, 500));
        return 'too late';
      },
      50, // 50ms timeout
    );

    expect(result).toEqual<ConnectorErrorResult<string>>({
      error: 'test unavailable',
      data: null,
    });
  });

  it('logs connector name, error type, and duration on failure', async () => {
    const consoleSpy = jest.spyOn(console, 'error');

    await withConnectorErrorHandling('my-connector', async (_signal) => {
      throw new Error('something broke');
    });

    expect(consoleSpy).toHaveBeenCalled();
    const logMessage = consoleSpy.mock.calls[0][0] as string;
    expect(logMessage).toContain('[connector:my-connector]');
    expect(logMessage).toContain('error=Error');
    expect(logMessage).toContain('duration=');
    expect(logMessage).toContain('something broke');
  });

  it('never logs API keys or tokens in error messages', async () => {
    const consoleSpy = jest.spyOn(console, 'error');

    await withConnectorErrorHandling('test', async (_signal) => {
      throw new Error('Bearer sk-1234567890abcdef1234567890abcdef');
    });

    const logMessage = consoleSpy.mock.calls[0][0] as string;
    expect(logMessage).not.toContain('sk-1234567890abcdef1234567890abcdef');
    expect(logMessage).toContain('***redacted***');
  });

  it('returns data: null with the correct type for array results', async () => {
    const result = await withConnectorErrorHandling('test', async (_signal): Promise<any[]> => {
      throw new Error('fail');
    });

    expect(result).toEqual<ConnectorErrorResult<any[]>>({
      error: 'test unavailable',
      data: null,
    });
  });

  it('passes an AbortSignal that aborts after timeout', async () => {
    let capturedSignal: AbortSignal | undefined;

    await withConnectorErrorHandling(
      'test',
      async (signal) => {
        capturedSignal = signal;
        await new Promise((resolve) => setTimeout(resolve, 500));
        return 'too late';
      },
      50,
    );

    expect(capturedSignal).toBeDefined();
    expect(capturedSignal!.aborted).toBe(true);
  });
});
