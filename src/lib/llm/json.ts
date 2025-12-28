export const extractJsonFromText = (text: string): string => {
  const cleaned = text.trim().replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim();
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  const firstBracket = cleaned.indexOf('[');
  const lastBracket = cleaned.lastIndexOf(']');

  const hasObject = firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace;
  const hasArray = firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket;

  if (!hasObject && !hasArray) {
    throw new Error('LLM did not return JSON.');
  }

  if (hasObject && (!hasArray || firstBrace < firstBracket)) {
    return cleaned.slice(firstBrace, lastBrace + 1);
  }

  return cleaned.slice(firstBracket, lastBracket + 1);
};

export const parseJsonFromText = <T>(text: string): { data: T; raw: string } => {
  const raw = extractJsonFromText(text);
  return { data: JSON.parse(raw) as T, raw };
};

