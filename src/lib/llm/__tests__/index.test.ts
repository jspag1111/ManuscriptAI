import { afterEach, describe, expect, it, vi } from 'vitest';

describe('llm provider selection', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('uses the LangChain provider by default for local LM Studio', async () => {
    const { getLlmProviderName } = await import('../index');

    expect(getLlmProviderName()).toBe('langchain');
  });

  it('accepts langchain and lmstudio provider names', async () => {
    vi.stubEnv('MANUSCRIPTAI_LLM_PROVIDER', 'lmstudio');
    let mod = await import('../index');
    expect(mod.getLlmProviderName()).toBe('langchain');

    vi.resetModules();
    vi.stubEnv('MANUSCRIPTAI_LLM_PROVIDER', ' langchain ');
    mod = await import('../index');
    expect(mod.getLlmProviderName()).toBe('langchain');
  });

  it('keeps Gemini available as an explicit provider', async () => {
    vi.stubEnv('MANUSCRIPTAI_LLM_PROVIDER', 'gemini');
    const { getLlmProviderName } = await import('../index');

    expect(getLlmProviderName()).toBe('gemini');
  });
});
