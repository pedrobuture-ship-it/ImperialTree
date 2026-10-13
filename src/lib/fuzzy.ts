/** Subsequence fuzzy match; returns null when `query` does not match `text`. Lower scores are better. */
export function fuzzyScore(query: string, text: string): number | null {
  const q = query.toLowerCase();
  const t = text.toLowerCase();
  if (!q) return 0;
  let ti = 0;
  let score = 0;
  let prev = -2;
  for (const ch of q) {
    const found = t.indexOf(ch, ti);
    if (found === -1) return null;
    score += found - ti; // gaps cost
    if (found === prev + 1) score -= 2; // consecutive bonus
    if (found === 0 || "/-_ .".includes(t[found - 1])) score -= 3; // word boundary bonus
    prev = found;
    ti = found + 1;
  }
  return score + t.length * 0.01;
}

export function fuzzyFilter<T>(items: T[], query: string, key: (item: T) => string): T[] {
  if (!query.trim()) return items;
  return items
    .map((item) => ({ item, score: fuzzyScore(query.trim(), key(item)) }))
    .filter((r): r is { item: T; score: number } => r.score !== null)
    .sort((a, b) => a.score - b.score)
    .map((r) => r.item);
}
