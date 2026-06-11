/** Text normalization and similarity scoring for cross-venue market matching. */

/**
 * Common words that carry little signal for matching prediction-market
 * questions. Years are intentionally NOT included — they help distinguish
 * otherwise-similar events (e.g. "... in 2026" vs "... in 2027").
 */
const STOPWORDS = new Set([
  "the", "a", "an", "will", "be", "is", "are", "was", "were", "to", "of",
  "in", "on", "at", "by", "for", "and", "or", "this", "that", "it", "its",
  "do", "does", "did", "have", "has", "had", "what", "who", "whom", "when",
  "where", "which", "than", "then", "with", "as", "from", "into", "over",
  "under", "before", "after", "during", "up", "down", "out", "off", "yes",
  "no", "market", "markets", "prediction", "any", "all", "more", "less",
]);

/**
 * Lowercase, strip punctuation, drop stopwords, and return the remaining
 * significant tokens. Numbers and years are preserved.
 */
export function normalizeTokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 0 && !STOPWORDS.has(t) && t.length > 1);
}

/**
 * Jaccard similarity between two token lists: |A ∩ B| / |A ∪ B|.
 * Returns a value in [0, 1]; 1 means identical token sets.
 */
export function jaccard(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const setA = new Set(a);
  const setB = new Set(b);
  let intersection = 0;
  for (const t of setA) {
    if (setB.has(t)) intersection += 1;
  }
  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}
