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
      let invalidText = textResponse.text;
      let parseError = error;
      const repairMaxTokens = Math.max(request.maxOutputTokens ?? 0, 4096);

      for (let attempt = 1; attempt <= 2; attempt += 1) {
        const repair = await generateText({
          prompt: [
            'Convert the following invalid model output into strict JSON only.',
            `Parser error: ${parseError instanceof Error ? parseError.message : String(parseError)}`,
            'Rules: output one valid JSON value, use double quotes, escape quotes inside strings, remove markdown and trailing commentary.',
            '',
            invalidText,
          ].join('\n'),
          system: 'You are a JSON repair tool. Output ONLY strict valid JSON (RFC 8259), with no markdown.',
          model: request.model || process.env.MANUSCRIPTAI_LLM_MODEL_FAST,
          maxOutputTokens: repairMaxTokens,
          temperature: 0,
        });

        try {
          const { data, raw } = parseJsonFromText<T>(repair.text);
          return {
            data,
            rawText: repair.text,
            rawJson: raw,
            model: repair.model,
          };
        } catch (repairError) {
          invalidText = repair.text;
          parseError = repairError;
        }
      }

      throw parseError;
    }
  };

  return {
    provider: 'langchain',
    generateText,
    generateJson,
  };
};
