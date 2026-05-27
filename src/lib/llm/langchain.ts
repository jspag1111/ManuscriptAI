import { ChatOpenAI } from '@langchain/openai';
import { parseJsonFromText } from './json';
import type { LlmClient, LlmJsonRequest, LlmJsonResponse, LlmTextRequest, LlmTextResponse } from './types';

const DEFAULT_LMSTUDIO_BASE_URL = 'http://localhost:1234/v1';
const DEFAULT_LMSTUDIO_MODEL = 'openai/gpt-oss-20b';

const cleanBaseUrl = (value: string | undefined) => {
  const raw = value?.trim() || DEFAULT_LMSTUDIO_BASE_URL;
  return raw.replace(/\/+$/, '');
};

const getModel = (model?: string) =>
  model?.trim()
  || process.env.MANUSCRIPTAI_LLM_MODEL_QUALITY?.trim()
  || process.env.MANUSCRIPTAI_LLM_MODEL_FAST?.trim()
  || process.env.MANUSCRIPTAI_LMSTUDIO_MODEL?.trim()
  || DEFAULT_LMSTUDIO_MODEL;

const getApiKey = () => process.env.MANUSCRIPTAI_LMSTUDIO_API_KEY?.trim() || 'lm-studio';

const toText = (content: unknown): string => {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === 'string') return part;
        if (part && typeof part === 'object' && 'text' in part) {
          const text = (part as { text?: unknown }).text;
          return typeof text === 'string' ? text : '';
        }
        return '';
      })
      .join('');
  }
  return content == null ? '' : String(content);
};

const createModel = (request: LlmTextRequest) => new ChatOpenAI({
  model: getModel(request.model),
  apiKey: getApiKey(),
  temperature: request.temperature,
  maxTokens: request.maxOutputTokens,
  configuration: {
    baseURL: cleanBaseUrl(process.env.MANUSCRIPTAI_LMSTUDIO_BASE_URL),
  },
});

const toMessages = (request: LlmTextRequest): Array<[string, string]> => {
  const messages: Array<[string, string]> = [];
  if (request.system) messages.push(['system', request.system]);
  messages.push(['human', request.prompt]);
  return messages;
};

export const createLangChainClient = (): LlmClient => {
  const generateText = async (request: LlmTextRequest): Promise<LlmTextResponse> => {
    const model = getModel(request.model);
    const response = await createModel(request).invoke(toMessages(request));
    return {
      text: toText(response.content),
      model,
      raw: response,
    };
  };

  const generateJson = async <T,>(request: LlmJsonRequest): Promise<LlmJsonResponse<T>> => {
    const textResponse = await generateText(request);
    try {
      const { data, raw } = parseJsonFromText<T>(textResponse.text);
      return {
        data,
        rawText: textResponse.text,
        rawJson: raw,
        model: textResponse.model,
      };
    } catch (error) {
      const repair = await generateText({
        prompt: `Fix this into strict JSON only:\n\n${textResponse.text}`,
        system: 'You are a JSON repair tool. Convert the input into STRICT valid JSON (RFC 8259). Output ONLY the JSON.',
        model: request.model || process.env.MANUSCRIPTAI_LLM_MODEL_FAST,
        maxOutputTokens: request.maxOutputTokens,
        temperature: 0,
      });

      const { data, raw } = parseJsonFromText<T>(repair.text);
      return {
        data,
        rawText: repair.text,
        rawJson: raw,
        model: repair.model,
      };
    }
  };

  return {
    provider: 'langchain',
    generateText,
    generateJson,
  };
};
