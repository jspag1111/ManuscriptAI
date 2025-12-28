export type LlmProviderName = 'gemini';

export interface LlmTextRequest {
  prompt: string;
  system?: string;
  model?: string;
  maxOutputTokens?: number;
  temperature?: number;
}

export interface LlmTextResponse {
  text: string;
  model: string;
  raw?: unknown;
}

export interface LlmJsonRequest extends LlmTextRequest {}

export interface LlmJsonResponse<T> {
  data: T;
  rawText: string;
  rawJson: string;
  model: string;
}

export interface LlmClient {
  provider: LlmProviderName;
  generateText(request: LlmTextRequest): Promise<LlmTextResponse>;
  generateJson<T>(request: LlmJsonRequest): Promise<LlmJsonResponse<T>>;
}

