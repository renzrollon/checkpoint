import { getEnv, type Env } from "@/lib/env";
import { createFixtureHost, type FixtureHost } from "./fixture";
import { createGitHubHost } from "./github";
import type { GitHost } from "./types";

export type { GitHost, Comparison, RefInfo, FileRead, DirEntry, WriteInput, WriteResult } from "./types";
export { HostError, isHostError, asHostError, type HostErrorKind, type HostErrorShape } from "./errors";
export { guardWritePath, changeFilePath, CHANGES_DIR, WRITABLE_FILES } from "./guard";

/**
 * Build a host for one repository of an environment (default: the first).
 * The fixture host is stateful (its overlay) and serves a single repository.
 */
export function createHost(env: Env, repo: string = env.CHECKPOINT_REPOS[0]): GitHost {
  if (env.CHECKPOINT_GIT_HOST === "fixture") {
    return createFixtureHost({ dir: env.CHECKPOINT_FIXTURE_DIR });
  }
  return createGitHubHost({ repo, token: env.CHECKPOINT_GITHUB_TOKEN });
}

// One host per canonical repository, kept on globalThis so the fixture overlay
// survives dev-server module reloads between requests.
const KEY = Symbol.for("checkpoint.githost");
type Slot = { hosts?: Map<string, GitHost> };
const slot = ((globalThis as unknown as Record<symbol, Slot>)[KEY] ??= {});

/**
 * The process-wide host for a canonical repository. An omitted `repo` means the
 * default (first configured). A repository outside `CHECKPOINT_REPOS` throws
 * before any host is created.
 */
export function getHost(repo?: string): GitHost {
  const env = getEnv();
  const target = repo === undefined ? env.CHECKPOINT_REPOS[0] : repo;
  if (!env.CHECKPOINT_REPOS.includes(target)) {
    throw new Error("Checkpoint is not configured for the requested repository");
  }
  const hosts = (slot.hosts ??= new Map());
  let host = hosts.get(target);
  if (!host) {
    host = createHost(env, target);
    hosts.set(target, host);
  }
  return host;
}

/** The fixture host when that is what is configured, else `null`. */
export function getFixtureHost(): FixtureHost | null {
  const host = getHost();
  return host.name === "fixture" ? (host as FixtureHost) : null;
}

/** Test hook: forget every process-wide host. */
export function resetHost(): void {
  slot.hosts = undefined;
}
