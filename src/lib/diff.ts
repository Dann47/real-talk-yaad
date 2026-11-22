/**
 * Word-by-word comparison of an original line and someone's fix.
 * Used to show exactly what changed (crossed out / added) everywhere people correct text.
 */

export type DiffPart =
  /** A word kept from the original. start/end: its position in the fixed text. */
  | { type: 'same'; text: string; start: number; end: number }
  /** A word the person added or changed to. */
  | { type: 'add'; text: string; start: number; end: number }
  /** A word from the original that is gone. */
  | { type: 'del'; text: string };

type Token = { text: string; start: number; end: number };

function tokens(text: string): Token[] {
  const out: Token[] = [];
  for (const match of text.matchAll(/\S+/g)) {
    out.push({ text: match[0], start: match.index ?? 0, end: (match.index ?? 0) + match[0].length });
  }
  return out;
}

/** Spelling counts, capital letters and a trailing comma or full stop don't. */
const key = (word: string) => word.toLowerCase().replace(/^[^\p{L}\p{N}']+|[^\p{L}\p{N}']+$/gu, '');

export function wordDiff(original: string, fixed: string): DiffPart[] {
  const a = tokens(original);
  const b = tokens(fixed);
  // Longest common subsequence of words.
  const lcs: number[][] = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      lcs[i][j] = key(a[i].text) === key(b[j].text) ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }
  const parts: DiffPart[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && key(a[i].text) === key(b[j].text)) {
      parts.push({ type: 'same', text: b[j].text, start: b[j].start, end: b[j].end });
      i++;
      j++;
    } else if (j < b.length && (i === a.length || lcs[i][j + 1] >= lcs[i + 1][j])) {
      // Removed words are listed before the words that replace them, so "old new" reads naturally.
      if (i < a.length && lcs[i][j + 1] === lcs[i + 1][j]) {
        parts.push({ type: 'del', text: a[i].text });
        i++;
      } else {
        parts.push({ type: 'add', text: b[j].text, start: b[j].start, end: b[j].end });
        j++;
      }
    } else {
      parts.push({ type: 'del', text: a[i].text });
      i++;
    }
  }
  return parts;
}

/** How many words were changed, added or removed (a swap of one word counts once). */
export function changeCount(parts: DiffPart[]) {
  const added = parts.filter((p) => p.type === 'add').length;
  const removed = parts.filter((p) => p.type === 'del').length;
  return Math.max(added, removed);
}

/** Same words, ignoring capitals, spacing and end punctuation. */
export function sameText(a: string, b: string) {
  return changeCount(wordDiff(a, b)) === 0;
}
