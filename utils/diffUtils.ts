
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

  const buildCountMap = (diff: DiffPart[], type: DiffType) => {
    const map = new Map<string, number>();
    diff.forEach(part => {
      if (part.type === type) {
        map.set(part.value, (map.get(part.value) || 0) + 1);
      }
    });
    return map;
  };

  const consume = (map: Map<string, number>, value: string) => {
    const current = map.get(value) || 0;
    if (current > 0) {
      map.set(value, current - 1);
      return true;
    }
    return false;
  };

  const llmInserted = buildCountMap(llmDiff, 'insert');
  const llmDeleted = buildCountMap(llmDiff, 'delete');
  const userInserted = buildCountMap(userDiff, 'insert');
  const userDeleted = buildCountMap(userDiff, 'delete');

  return rawDiff.map(part => {
    if (part.type === 'equal') return part;

    if (part.type === 'insert') {
      if (consume(userInserted, part.value)) return { ...part, source: 'USER' };
      if (consume(llmInserted, part.value)) return { ...part, source: 'LLM' };
    }

    if (part.type === 'delete') {
      if (consume(userDeleted, part.value)) return { ...part, source: 'USER' };
      if (consume(llmDeleted, part.value)) return { ...part, source: 'LLM' };
    }

    return { ...part, source: 'USER' };
  });
};
