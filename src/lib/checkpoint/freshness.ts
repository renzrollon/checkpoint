import { changeFilePath, WRITABLE_FILES } from "../githost/guard";
import type { Comparison } from "../githost/types";

/**
 * Freshness by ancestry (design D6). A recorded head is fresh when it is the
 * current head, or when the branch only moved by this change's own Checkpoint
 * files. The tolerated paths come from the write guard's list, never a copy.
 */

export type Freshness = "fresh" | "stale";

export interface FreshnessInput {
  recordedHead: string;
  currentHead: string;
  /** compare(recordedHead, currentHead), or absent when it could not be read. */
  comparison: Comparison | null | undefined;
  change: string;
}

export function classifyFreshness({ recordedHead, currentHead, comparison, change }: FreshnessInput): Freshness {
  if (recordedHead === currentHead) return "fresh";
  if (!comparison || comparison.truncated) return "stale";
  if (comparison.status !== "ahead" && comparison.status !== "identical") return "stale";
  const tolerated = new Set(WRITABLE_FILES.map((f) => changeFilePath(change, f)));
  return comparison.files.every((p) => tolerated.has(p)) ? "fresh" : "stale";
}
