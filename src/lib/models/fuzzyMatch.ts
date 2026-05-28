/**
 * Lightweight, dependency-free fuzzy matcher for the model catalog search.
 * Each query word must match the haystack as a substring, or be within a small
 * edit distance of one of the haystack tokens (tolerates a single typo,
 * including an adjacent transposition, on words of 4+ characters). Designed for
 * short queries over short fields.
 */

// Optimal string alignment distance (Damerau–Levenshtein restricted to
// adjacent transpositions), bailing out once it exceeds `max`.
function editDistance(a: string, b: string, max: number): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const prev2 = new Array<number>(b.length + 1).fill(0);
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    const curr = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let value = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        value = Math.min(value, prev2[j - 2] + 1);
      }
      curr[j] = value;
      if (value < rowMin) rowMin = value;
    }
    if (rowMin > max) return max + 1;
    for (let j = 0; j <= b.length; j += 1) prev2[j] = prev[j];
    prev = curr;
  }
  return prev[b.length];
}

function wordMatchesToken(word: string, token: string): boolean {
  if (token.length < 2) return false;
  if (token.includes(word)) return true;
  if (token.length >= 3 && word.includes(token)) return true;
  // Only allow a typo on reasonably long words.
  if (word.length < 4) return false;
  const tolerance = word.length >= 7 ? 2 : 1;
  return editDistance(word, token, tolerance) <= tolerance;
}

/**
 * Returns true when every query word matches the haystack (substring or within
 * edit-distance tolerance of any haystack token).
 */
export function fuzzyMatch(query: string, haystack: string): boolean {
  const words = query.trim().toLowerCase().split(/\s+/u).filter(Boolean);
  if (words.length === 0) return true;
  const normalizedHaystack = haystack.toLowerCase();
  const tokens = normalizedHaystack.split(/[^a-z0-9.]+/u).filter(Boolean);
  return words.every((word) => {
    if (word.length >= 3 && normalizedHaystack.includes(word)) return true;
    return tokens.some((token) => wordMatchesToken(word, token));
  });
}
