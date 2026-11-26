"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { SESSION_COOKIE, configuredKey, verifySession } from "@/lib/auth/session";
import { getHost } from "@/lib/githost";
import { EnvError, getEnv } from "@/lib/env";
import { resolveRepo } from "@/lib/repo";
import { answerRow, decide, type AnswerResult, type DecideResult } from "@/lib/change/actions";

/**
 * Server actions behind the answer form and the decision bar. The proxy
 * already refuses an unauthenticated action post; each action re-checks the
 * session itself as well (design D1), then revalidates the pages it changed.
 */

export type Unauthenticated = { ok: false; reason: "unauthenticated"; message: string };

async function authenticated(): Promise<boolean> {
  const store = await cookies();
  return verifySession(configuredKey(), store.get(SESSION_COOKIE)?.value) === "valid";
}

export type ConfigRefusal = { ok: false; reason: "config"; message: string; missing: string[] };
export type UnknownRepoRefusal = { ok: false; reason: "unknown_repo"; message: string; requested: string };
export type RepoRefusal = ConfigRefusal | UnknownRepoRefusal;

/** Resolve the repository again on the server; names variables only, never values. */
function resolveWriteRepo(raw: string | undefined): { ok: true; repo: string } | RepoRefusal {
  try {
    const resolved = resolveRepo(raw, getEnv().CHECKPOINT_REPOS);
    if (resolved.ok) return resolved;
    return { ok: false, reason: "unknown_repo", message: "unknown repository", requested: resolved.requested };
  } catch (e) {
    if (e instanceof EnvError) {
      return { ok: false, reason: "config", message: `not configured: ${e.missing.join(", ")}`, missing: [...e.missing] };
    }
    throw e;
  }
}

const UNAUTHENTICATED: Unauthenticated = { ok: false, reason: "unauthenticated", message: "unauthenticated" };

export interface AnswerActionInput {
  /** Canonical repository the page was rendered for (design D14). */
  repo: string;
  /** Head SHA the page was rendered from (design D23). */
  headSha: string | null;
  ref: string;
  change: string;
  id: string;
  answer: string;
  baseSha: string | null;
}

export async function answerRowAction(input: AnswerActionInput): Promise<AnswerResult | Unauthenticated | RepoRefusal> {
  if (!(await authenticated())) return UNAUTHENTICATED;
  const { repo, ...rest } = input;
  const target = resolveWriteRepo(repo);
  if (!target.ok) return target;
  const result = await answerRow(getHost(target.repo), { ...rest, today: new Date() });
  if (result.ok) {
    revalidatePath(`/changes/${input.change}`);
    revalidatePath("/");
  }
  return result;
}

export interface DecideActionInput {
  /** Canonical repository the page was rendered for (design D14). */
  repo: string;
  ref: string;
  change: string;
  state: "approved" | "returned";
  note?: string;
  baseSha: string | null;
  headSha: string;
}

export async function decideAction(input: DecideActionInput): Promise<DecideResult | Unauthenticated | RepoRefusal> {
  if (!(await authenticated())) return UNAUTHENTICATED;
  const { repo, ...rest } = input;
  const target = resolveWriteRepo(repo);
  if (!target.ok) return target;
  const result = await decide(getHost(target.repo), { ...rest, now: new Date() });
  if (result.ok) {
    revalidatePath(`/changes/${input.change}`);
    revalidatePath("/");
  }
  return result;
}
