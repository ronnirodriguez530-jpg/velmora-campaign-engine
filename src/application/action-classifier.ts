const majorActionWords = ["support", "neglect", "commit", "choose", "accept", "refuse", "resolve", "oppose"];

export function isMajorPlayerAction(input: string): boolean {
  const normalized = input.trim().toLowerCase();
  return majorActionWords.some((word) => new RegExp(`\\b${word}\\b`, "u").test(normalized));
}
