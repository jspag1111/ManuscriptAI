
import { ChangeSource } from '../types';

export type DiffType = 'equal' | 'insert' | 'delete';
export type DiffPart = { type: DiffType; value: string };
export type AttributedDiffPart = DiffPart & { source?: ChangeSource };

export const computeDiff = (text1: string, text2: string): DiffPart[] => {
  // Split into words but preserve whitespace/punctuation for reconstruction
  // detailed regex to capture words and everything between them
  const tokenize = (text: string) => text.split(/([^\S\r\n]+|[.,!?;:"'[\]{}()])/).filter(x => x);
  
  const words1 = tokenize(text1);
  const words2 = tokenize(text2);
  
  const m = words1.length;
  const n = words2.length;
  
  // LCS Dynamic Programming Matrix (optimized for space if needed, but simple matrix here for clarity)
  // Max text length is reasonably small for a section (e.g. < 5000 words), so O(MN) is acceptable.
  const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));
  
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (words1[i - 1] === words2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }
  
  // Backtrack to find diff
  let i = m;
  let j = n;
  const diffs: DiffPart[] = [];
  
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && words1[i - 1] === words2[j - 1]) {
      diffs.push({ type: 'equal', value: words1[i - 1] });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      diffs.push({ type: 'insert', value: words2[j - 1] });
      j--;
    } else if (i > 0 && (j === 0 || dp[i][j - 1] < dp[i - 1][j])) {
      diffs.push({ type: 'delete', value: words1[i - 1] });
      i--;
    }
  }
  
  return diffs.reverse();
};

interface AttributedOptions {
  llmSnapshot?: string | null;
  forceSource?: ChangeSource;
}

/**
 * Computes a diff and tags inserted/deleted parts with the source (LLM or USER).
 * - If forceSource is provided, all inserts/deletes are tagged with that source.
 * - If llmSnapshot is provided, we compare base->llmSnapshot (LLM edits) and
 *   llmSnapshot->target (user edits) to attribute changes in the final diff.
 */
export const computeAttributedDiff = (
  base: string,
  target: string,
  options: AttributedOptions = {}
): AttributedDiffPart[] => {
  const rawDiff = computeDiff(base || '', target || '');

  if (options.forceSource) {
    return rawDiff.map(part => part.type === 'equal' ? part : { ...part, source: options.forceSource });
  }

  const llmSnapshot = options.llmSnapshot ?? null;
  const llmDiff = llmSnapshot ? computeDiff(base || '', llmSnapshot) : [];
  const userBaseline = llmSnapshot ?? base;
  const userDiff = computeDiff(userBaseline || '', target || '');

  const llmInserted = new Set<string>();
  const llmDeleted = new Set<string>();
  llmDiff.forEach(part => {
    if (part.type === 'insert') llmInserted.add(part.value);
    if (part.type === 'delete') llmDeleted.add(part.value);
  });

  const userInserted = new Set<string>();
  const userDeleted = new Set<string>();
  userDiff.forEach(part => {
    if (part.type === 'insert') userInserted.add(part.value);
    if (part.type === 'delete') userDeleted.add(part.value);
  });

  return rawDiff.map(part => {
    if (part.type === 'equal') return part;

    if (part.type === 'insert') {
      if (llmInserted.has(part.value)) return { ...part, source: 'LLM' };
      if (userInserted.has(part.value)) return { ...part, source: 'USER' };
    }

    if (part.type === 'delete') {
      if (llmDeleted.has(part.value)) return { ...part, source: 'LLM' };
      if (userDeleted.has(part.value)) return { ...part, source: 'USER' };
    }

    return { ...part, source: 'USER' };
  });
};
