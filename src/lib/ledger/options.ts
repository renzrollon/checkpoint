/**
 * One-tap options parsed from a `needs_human` question (design D14). The
 * ledger has no options column, so the question text is the only recorded
 * source. Free text is always available alongside whatever this yields.
 */

const MAX_OPTIONS = 4;
const MIN_LENGTH = 2;

// Order matters: ", or " must be tried as one token before ", " and " or ".
const SPLIT = /,\s+or\s+|,\s+|\s+or\s+|\s+vs\.?\s+|\s+versus\s+|\s+\/\s+/i;

export function optionsFromQuestion(question: string | null | undefined): string[] {
  let text = String(question ?? "").trim();
  if (!text) return [];
  text = text.replace(/\?+\s*$/, "").trim();
  const colon = text.lastIndexOf(":");
  if (colon !== -1) text = text.slice(colon + 1).trim();
  if (!text) return [];
  if (!SPLIT.test(text)) return [];
  const parts = text
    .split(SPLIT)
    .map((p) => p.trim().replace(/^[,;]+|[,;.]+$/g, "").trim())
    .filter((p) => p.length >= MIN_LENGTH);
  const unique = [...new Set(parts)];
  if (unique.length < 2 || unique.length > MAX_OPTIONS) return [];
  return unique;
}
