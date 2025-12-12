
export type DiffType = 'equal' | 'insert' | 'delete';
export type DiffPart = { type: DiffType; value: string };

export const computeDiff = (text1: string, text2: string): DiffPart[] => {
  // Split into words but preserve whitespace/punctuation for reconstruction
  // detailed regex to capture words and everything between them
  const tokenize = (text: string) =>
    // Capture each non-space chunk along with its trailing whitespace so words keep their nearby spacing/punctuation.
    text.match(/[^\s]+\s*|\s+/g)?.filter(Boolean) ?? [];
  
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

  const reversed = diffs.reverse();

  // Merge adjacent tokens so replacements show as grouped deletions followed by grouped insertions
  // (similar to Word track changes) instead of alternating one token at a time.
  const grouped: DiffPart[] = [];
  const changeBuffer: DiffPart[] = [];

  const flushChangeBuffer = () => {
    if (!changeBuffer.length) return;

    const deletes = changeBuffer.filter(part => part.type === 'delete');
    const inserts = changeBuffer.filter(part => part.type === 'insert');

    if (deletes.length) {
      grouped.push({
        type: 'delete',
        value: deletes.map(d => d.value).join(''),
      });
    }

    if (inserts.length) {
      grouped.push({
        type: 'insert',
        value: inserts.map(d => d.value).join(''),
      });
    }

    changeBuffer.length = 0;
  };

  const pushEqual = (value: string) => {
    const last = grouped[grouped.length - 1];
    if (last?.type === 'equal') {
      last.value += value;
    } else {
      grouped.push({ type: 'equal', value });
    }
  };

  for (const part of reversed) {
    if (part.type === 'equal') {
      flushChangeBuffer();
      pushEqual(part.value);
    } else {
      changeBuffer.push(part);
    }
  }

  flushChangeBuffer();

  return grouped;
};
