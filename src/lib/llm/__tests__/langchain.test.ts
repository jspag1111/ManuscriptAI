import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockState = vi.hoisted(() => ({
  instances: [] as Array<{ params: Record<string, unknown>; invoke: ReturnType<typeof vi.fn> }>,
  responses: [] as unknown[],
}));

vi.mock('@langchain/openai', () => ({
  ChatOpenAI: vi.fn().mockImplementation((params: Record<string, unknown>) => {
    const invoke = vi.fn(async () => {
      if (mockState.responses.length === 0) return { content: '' };
      return mockState.responses.shift();
    });
    mockState.instances.push({ params, invoke });
    return { invoke };
  }),
}));

describe('LangChain LM Studio client', () => {
  beforeEach(() => {
    mockState.instances.length = 0;
    mockState.responses.length = 0;
    vi.stubEnv('MANUSCRIPTAI_LMSTUDIO_BASE_URL', '');
    vi.stubEnv('MANUSCRIPTAI_LMSTUDIO_API_KEY', '');
    vi.stubEnv('MANUSCRIPTAI_LLM_MODEL_FAST', '');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('maps text requests to ChatOpenAI with LM Studio defaults', async () => {
    mockState.responses.push({ content: 'Drafted text' });
    const { createLangChainClient } = await import('../langchain');

    const client = createLangChainClient();
    const response = await client.generateText({
      system: 'System prompt',
      prompt: 'User prompt',
      temperature: 0.2,
      maxOutputTokens: 128,
    });

    expect(client.provider).toBe('langchain');
    expect(response).toEqual({
      text: 'Drafted text',
      model: 'openai/gpt-oss-20b',
      raw: { content: 'Drafted text' },
    });
    expect(mockState.instances[0].params).toMatchObject({
      model: 'openai/gpt-oss-20b',
      apiKey: 'lm-studio',
      temperature: 0.2,
      maxTokens: 128,
      configuration: {
        baseURL: 'http://localhost:1234/v1',
      },
    });
    expect(mockState.instances[0].invoke).toHaveBeenCalledWith([
      ['system', 'System prompt'],
      ['human', 'User prompt'],
    ]);
  });

  it('uses environment overrides for base URL, key, and model', async () => {
    vi.stubEnv('MANUSCRIPTAI_LMSTUDIO_BASE_URL', 'http://127.0.0.1:4321/v1/');
    vi.stubEnv('MANUSCRIPTAI_LMSTUDIO_API_KEY', 'local-key');
    vi.stubEnv('MANUSCRIPTAI_LLM_MODEL_FAST', 'custom/local-model');
    mockState.responses.push({ content: 'OK' });
    const { createLangChainClient } = await import('../langchain');

    await createLangChainClient().generateText({ prompt: 'Hello' });

    expect(mockState.instances[0].params).toMatchObject({
      model: 'custom/local-model',
      apiKey: 'local-key',
      configuration: {
        baseURL: 'http://127.0.0.1:4321/v1',
      },
    });
  });

  it('parses JSON and repairs invalid JSON with a second LangChain call', async () => {
    mockState.responses.push(
      { content: 'not json' },
      { content: '```json\n{"ok":true}\n```' }
    );
    const { createLangChainClient } = await import('../langchain');

    const response = await createLangChainClient().generateJson<{ ok: boolean }>({
      system: 'Return JSON.',
      prompt: 'Need JSON.',
      temperature: 0,
    });

    expect(response.data).toEqual({ ok: true });
    expect(response.rawJson).toBe('{"ok":true}');
    expect(mockState.instances).toHaveLength(2);
    expect(mockState.instances[1].invoke.mock.calls[0][0][0][1]).toContain('JSON repair tool');
    expect(mockState.instances[1].invoke.mock.calls[0][0][1][1]).toContain('not json');
  });

  it('retries JSON repair once when the first repair is still malformed', async () => {
    mockState.responses.push(
      { content: 'not json' },
      { content: '{"items":["unterminated}' },
      { content: '{"items":["fixed"]}' }
    );
    const { createLangChainClient } = await import('../langchain');

    const response = await createLangChainClient().generateJson<{ items: string[] }>({
      system: 'Return JSON.',
      prompt: 'Need JSON.',
      temperature: 0,
      maxOutputTokens: 100,
    });

    expect(response.data).toEqual({ items: ['fixed'] });
    expect(mockState.instances).toHaveLength(3);
    expect(mockState.instances[1].params.maxTokens).toBe(4096);
    expect(mockState.instances[2].invoke.mock.calls[0][0][1][1]).toContain('unterminated');
  });
});
