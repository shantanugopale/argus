export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  let prev: number[] = new Array(b.length + 1);
  let curr: number[] = new Array(b.length + 1);

  for (let j = 0; j <= b.length; j++) prev[j] = j;

  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        (prev[j] ?? 0) + 1,
        (curr[j - 1] ?? 0) + 1,
        (prev[j - 1] ?? 0) + cost
      );
    }
    [prev, curr] = [curr, prev];
  }
  return prev[b.length] ?? a.length;
}

export function nearestTopName(
  name: string,
  topNames: ReadonlySet<string>,
  maxDistance: number
): { name: string; distance: number } | null {
  let best: { name: string; distance: number } | null = null;
  for (const candidate of topNames) {
    if (candidate === name) continue;
    const d = levenshtein(name, candidate);
    if (d >= 1 && d <= maxDistance) {
      const better =
        best === null ||
        d < best.distance ||
        (d === best.distance && candidate < best.name);
      if (better) best = { name: candidate, distance: d };
    }
  }
  return best;
}
