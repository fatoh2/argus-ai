import { DeepSeekService } from './deepseek.service';

describe('DeepSeekService', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.DEEPSEEK_API_KEY = 'sk-test-key-12345';
    process.env.DEEPSEEK_URL = 'https://api.deepseek.com/chat/completions';
    process.env.DEEPSEEK_MODEL = 'deepseek-chat';
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.restoreAllMocks();
  });

  describe('chat', () => {
    it('should throw when API key is not configured', async () => {
      delete process.env.DEEPSEEK_API_KEY;
      const svc = new DeepSeekService();
      await expect(svc.chat('hello')).rejects.toThrow('DEEPSEEK_API_KEY is not configured');
    });

    it('should build correct OpenAI-compatible request payload', async () => {
      const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'Hello! How can I help?' } }],
        }),
      } as Response);

      const svc = new DeepSeekService();
      const result = await svc.chat('Hello', [{ role: 'user', content: 'previous message' }]);

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const callArgs = fetchSpy.mock.calls[0];
      const url = callArgs[0];
      const options = callArgs[1] as RequestInit;
      const body = JSON.parse(options.body as string);

      // Verify URL
      expect(url).toBe('https://api.deepseek.com/chat/completions');

      // Verify headers
      expect((options.headers as Record<string, string>).Authorization).toBe('Bearer sk-test-key-12345');
      expect((options.headers as Record<string, string>)['Content-Type']).toBe('application/json');

      // Verify request payload structure
      expect(body).toHaveProperty('model', 'deepseek-chat');
      expect(body).toHaveProperty('messages');
      expect(body).toHaveProperty('max_tokens', 2000);
      expect(body).toHaveProperty('temperature', 0.3);

      // Verify messages structure
      expect(body.messages).toBeInstanceOf(Array);
      expect(body.messages.length).toBe(3); // system + history + user
      expect(body.messages[0]).toHaveProperty('role', 'system');
      expect(body.messages[1]).toEqual({ role: 'user', content: 'previous message' });
      expect(body.messages[2]).toEqual({ role: 'user', content: 'Hello' });

      // Verify result
      expect(result).toBe('Hello! How can I help?');

      fetchSpy.mockRestore();
    });

    it('should return trimmed response on success', async () => {
      jest.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: '  Hello!   ' } }],
        }),
      } as Response);

      const svc = new DeepSeekService();
      const result = await svc.chat('Hello');
      expect(result).toBe('Hello!');

      jest.restoreAllMocks();
    });

    it('should return fallback message when choices array is empty', async () => {
      jest.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [],
        }),
      } as Response);

      const svc = new DeepSeekService();
      const result = await svc.chat('Hello');
      expect(result).toBe('No response generated.');

      jest.restoreAllMocks();
    });

    it('should throw on non-200 response from API', async () => {
      jest.spyOn(global, 'fetch').mockResolvedValue({
        ok: false,
        status: 401,
        text: async () => 'Unauthorized',
      } as Response);

      const svc = new DeepSeekService();
      await expect(svc.chat('Hello')).rejects.toThrow('DeepSeek 401: Unauthorized');

      jest.restoreAllMocks();
    });

    it('should throw on 500 error from API', async () => {
      jest.spyOn(global, 'fetch').mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => 'Internal Server Error',
      } as Response);

      const svc = new DeepSeekService();
      await expect(svc.chat('Hello')).rejects.toThrow('DeepSeek 500: Internal Server Error');

      jest.restoreAllMocks();
    });

    it('should include history messages in the payload', async () => {
      const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'Reply' } }],
        }),
      } as Response);

      const history = [
        { role: 'user' as const, content: 'first message' },
        { role: 'assistant' as const, content: 'first response' },
      ];

      const svc = new DeepSeekService();
      await svc.chat('second message', history);

      const body = JSON.parse((fetchSpy.mock.calls[0][1] as RequestInit).body as string);
      expect(body.messages).toHaveLength(4); // system + 2 history + user
      expect(body.messages[1]).toEqual({ role: 'user', content: 'first message' });
      expect(body.messages[2]).toEqual({ role: 'assistant', content: 'first response' });
      expect(body.messages[3]).toEqual({ role: 'user', content: 'second message' });

      fetchSpy.mockRestore();
    });
  });
});
