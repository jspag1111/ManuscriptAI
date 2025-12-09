export interface TextStats {
  words: number;
  charsWithSpaces: number;
  charsWithoutSpaces: number;
}

const WORD_REGEX = /\s+/g;

export const calculateTextStats = (text: string = ''): TextStats => {
  const safeText = text || '';
  const trimmed = safeText.trim();
  const words = trimmed ? trimmed.split(/\s+/).filter(Boolean).length : 0;

  return {
    words,
    charsWithSpaces: safeText.length,
    charsWithoutSpaces: safeText.replace(WORD_REGEX, '').length,
  };
};
