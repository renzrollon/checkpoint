/**
 * Repository resolution (design D14, D9). `resolveRepo` is the only place a
 * repository string is compared; everything downstream uses the canonical
 * entry it returns.
 */

export type RepoResolution = { ok: true; repo: string } | { ok: false; requested: string };

/** Resolve a raw `repo` value against the configured allowlist (first = default). */
export function resolveRepo(raw: string | null | undefined, repos: readonly string[]): RepoResolution {
  const requested = (raw ?? "").trim();
  if (requested === "") return { ok: true, repo: repos[0] };
  const wanted = requested.toLowerCase();
  const match = repos.find((r) => r.toLowerCase() === wanted);
  return match === undefined ? { ok: false, requested } : { ok: true, repo: match };
}

/** Build `path?repo=…&ref=…`, encoding both values and omitting a missing one. */
export function locationHref(
  path: string,
  params: { repo?: string | null; ref?: string | null } = {},
): string {
  const parts: string[] = [];
  if (params.repo) parts.push(`repo=${encodeURIComponent(params.repo)}`);
  if (params.ref) parts.push(`ref=${encodeURIComponent(params.ref)}`);
  return parts.length ? `${path}?${parts.join("&")}` : path;
}
