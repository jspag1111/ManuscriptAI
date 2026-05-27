import { createLangChainClient } from './langchain';
import type { LlmClient, LlmProviderName } from './types';

export const getLlmProviderName = (): LlmProviderName => {
  const raw = (process.env.MANUSCRIPTAI_LLM_PROVIDER || 'langchain').toLowerCase().trim();
  if (raw === 'langchain' || raw === 'lmstudio') return 'langchain';
  throw new Error(`Unsupported LLM provider: ${raw}`);
};

export const getLlmClient = (): LlmClient => {
  const provider = getLlmProviderName();
  if (provider === 'langchain') return createLangChainClient();
  throw new Error(`Unsupported LLM provider: ${provider}`);
};
