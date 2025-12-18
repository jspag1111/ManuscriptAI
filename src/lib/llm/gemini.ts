import { GoogleGenAI } from '@google/genai';
import { MODEL_TEXT_FAST, MODEL_TEXT_QUALITY } from '@/constants';
import { parseJsonFromText } from './json';
import type { LlmClient, LlmJsonRequest, LlmJsonResponse, LlmTextRequest, LlmTextResponse } from './types';

const QUALITY_MODEL_SEQUENCE = [MODEL_TEXT_QUALITY, MODEL_TEXT_FAST];
const FALLBACK_ERROR_STATUSES = new Set(['RESOURCE_EXHAUSTED', 'PERMISSION_DENIED', 'FAILED_PRECONDITION']);

const getStatusFromError = (error: unknown): string | null => {
  const status = typeof (error as any)?.error?.status === 'string'
    ? (error as any).error.status
    : (error as any)?.status;
  return typeof status === 'string' ? status : null;
};

const shouldFallbackToFastModel = (error: unknown) => {
  const status = getStatusFromError(error);
  if (status && FALLBACK_ERROR_STATUSES.has(status)) {
    return true;
  }
  const message = typeof (error as any)?.message === 'string' ? (error as any).message.toLowerCase() : '';
  return message.includes('quota') || message.includes('model not found') || message.includes('rate limit');
};

const getGeminiApiKey = () => {
  const apiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('Gemini API key is not configured. Set GEMINI_API_KEY (recommended) or NEXT_PUBLIC_GEMINI_API_KEY (legacy).');
  }
  return apiKey;
};

const createAi = () => new GoogleGenAI({ apiKey: getGeminiApiKey() });

type GenerateContentParams = Parameters<GoogleGenAI['models']['generateContent']>[0];
type BaseGenerateContentParams = Omit<GenerateContentParams, 'model'>;

const generateWithFallback = async (
  ai: GoogleGenAI,
  request: BaseGenerateContentParams,
  models: string[]
) => {
  let lastError: unknown = null;
  for (let i = 0; i < models.length; i++) {
    const model = models[i];
    try {
      const response = await ai.models.generateContent({ ...request, model });
      return { response, model };
    } catch (error) {
      lastError = error;
      const isLast = i === models.length - 1;
      if (!shouldFallbackToFastModel(error) || isLast) {
        throw error;
      }
      console.warn(`Gemini model ${model} unavailable; falling back`, error);
    }
  }
  throw lastError;
};

const toGeminiRequest = (request: LlmTextRequest): BaseGenerateContentParams => {
  const config: any = {};
  if (request.system) config.systemInstruction = request.system;
  if (typeof request.maxOutputTokens === 'number') config.maxOutputTokens = request.maxOutputTokens;
  if (typeof request.temperature === 'number') config.temperature = request.temperature;

  return Object.keys(config).length > 0
    ? { contents: request.prompt, config }
    : { contents: request.prompt };
};

export const createGeminiClient = (): LlmClient => {
  const ai = createAi();

  const generateText = async (request: LlmTextRequest): Promise<LlmTextResponse> => {
    const modelSequence = request.model ? [request.model] : QUALITY_MODEL_SEQUENCE;
    const { response, model } = await generateWithFallback(ai, toGeminiRequest(request), modelSequence);
    return { text: response.text || '', model, raw: response };
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
      // One retry using the model as a JSON repair tool.
      const repairSystem = 'You are a JSON repair tool. Convert the input into STRICT valid JSON (RFC 8259). Output ONLY the JSON.';
      const repairPrompt = `Fix this into strict JSON only:\n\n${textResponse.text}`;
      const repair = await generateText({
        prompt: repairPrompt,
        system: repairSystem,
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
    provider: 'gemini',
    generateText,
    generateJson,
  };
};
