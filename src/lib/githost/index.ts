import { getEnv, type Env } from "@/lib/env";
import { createFixtureHost, type FixtureHost } from "./fixture";
import { createGitHubHost } from "./github";
import type { GitHost } from "./types";

export type { GitHost, RefInfo, FileRead, DirEntry, WriteInput, WriteResult } from "./types";
export { HostError, isHostError, asHostError, type HostErrorKind, type HostErrorShape } from "./errors";
export { guardWritePath, changeFilePath, CHANGES_DIR, WRITABLE_FILES } from "./guard";

/** Build a host for an environment. The fixture host is stateful (its overlay). */
export function createHost(env: Env): GitHost {
  if (env.CHECKPOINT_GIT_HOST === "fixture") {
    return createFixtureHost({ dir: env.CHECKPOINT_FIXTURE_DIR });
  }
  return createGitHubHost({ repo: env.CHECKPOINT_REPO, token: env.CHECKPOINT_GITHUB_TOKEN });
}

// One host per process, kept on globalThis so the fixture overlay survives
// dev-server module reloads between requests.
const KEY = Symbol.for("checkpoint.githost");
type Slot = { host?: GitHost };
const slot = ((globalThis as unknown as Record<symbol, Slot>)[KEY] ??= {});

/** The process-wide host selected by `CHECKPOINT_GIT_HOST`. */
export function getHost(): GitHost {
  if (!slot.host) slot.host = createHost(getEnv());
  return slot.host;
}

/** The fixture host when that is what is configured, else `null`. */
export function getFixtureHost(): FixtureHost | null {
  const host = getHost();
  return host.name === "fixture" ? (host as FixtureHost) : null;
}

/** Test hook: forget the process-wide host. */
export function resetHost(): void {
  slot.host = undefined;
}
