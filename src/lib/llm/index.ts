import { createGeminiClient } from './gemini';
import type { LlmClient, LlmProviderName } from './types';

export const getLlmProviderName = (): LlmProviderName => {
  const raw = (process.env.MANUSCRIPTAI_LLM_PROVIDER || 'gemini').toLowerCase().trim();
  if (raw === 'gemini') return 'gemini';
  throw new Error(`Unsupported LLM provider: ${raw}`);
};

export const getLlmClient = (): LlmClient => {
  const provider = getLlmProviderName();
  if (provider === 'gemini') return createGeminiClient();
  throw new Error(`Unsupported LLM provider: ${provider}`);
};

