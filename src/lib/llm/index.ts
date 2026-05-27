import { createGeminiClient } from './gemini';
import { createLangChainClient } from './langchain';
import type { LlmClient, LlmProviderName } from './types';

export const getLlmProviderName = (): LlmProviderName => {
  const raw = (process.env.MANUSCRIPTAI_LLM_PROVIDER || 'langchain').toLowerCase().trim();
  if (raw === 'langchain' || raw === 'lmstudio') return 'langchain';
  if (raw === 'gemini') return 'gemini';
  throw new Error(`Unsupported LLM provider: ${raw}`);
};

export const getLlmClient = (): LlmClient => {
  const provider = getLlmProviderName();
  if (provider === 'langchain') return createLangChainClient();
  if (provider === 'gemini') return createGeminiClient();
  throw new Error(`Unsupported LLM provider: ${provider}`);
};
