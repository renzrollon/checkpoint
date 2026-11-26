import { EnvError, getEnv } from "@/lib/env";
import { getHost } from "@/lib/githost";
import type { GitHost } from "@/lib/githost";
import { resolveRepo } from "@/lib/repo";

/** What a page receives as `searchParams`. */
export type SearchParams = Record<string, string | string[] | undefined>;

export type PageContext =
  | { kind: "config"; missing: string[] }
  | { kind: "unknown_repo"; requested: string; repos: string[] }
  | {
      kind: "ok";
      /** Canonical repository (design D14). */
      repo: string;
      /** Every configured repository, default first. */
      repos: string[];
      host: GitHost;
      /** Trimmed `ref` query value, or null. */
      ref: string | null;
    };

function first(value: string | string[] | undefined): string | null {
  const v = Array.isArray(value) ? value[0] : value;
  return v !== undefined && v.trim() !== "" ? v.trim() : null;
}

/** Resolve environment, repository, host and ref for a page (design D8). */
export function resolvePageContext(search: SearchParams): PageContext {
  let repos: string[];
  try {
    repos = [...getEnv().CHECKPOINT_REPOS];
  } catch (e) {
    if (e instanceof EnvError) return { kind: "config", missing: e.missing };
    throw e;
  }
  const resolved = resolveRepo(first(search.repo), repos);
  if (!resolved.ok) return { kind: "unknown_repo", requested: resolved.requested, repos };
  return { kind: "ok", repo: resolved.repo, repos, host: getHost(resolved.repo), ref: first(search.ref) };
}
