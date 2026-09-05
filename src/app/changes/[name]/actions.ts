"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { SESSION_COOKIE, configuredKey, verifySession } from "@/lib/auth/session";
import { getHost } from "@/lib/githost";
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

const UNAUTHENTICATED: Unauthenticated = { ok: false, reason: "unauthenticated", message: "unauthenticated" };

export interface AnswerActionInput {
  ref: string;
  change: string;
  id: string;
  answer: string;
  baseSha: string | null;
}

export async function answerRowAction(input: AnswerActionInput): Promise<AnswerResult | Unauthenticated> {
  if (!(await authenticated())) return UNAUTHENTICATED;
  const result = await answerRow(getHost(), { ...input, today: new Date() });
  if (result.ok) {
    revalidatePath(`/changes/${input.change}`);
    revalidatePath("/");
  }
  return result;
}

export interface DecideActionInput {
  ref: string;
  change: string;
  state: "approved" | "returned";
  note?: string;
  baseSha: string | null;
  headSha: string;
}

export async function decideAction(input: DecideActionInput): Promise<DecideResult | Unauthenticated> {
  if (!(await authenticated())) return UNAUTHENTICATED;
  const result = await decide(getHost(), { ...input, now: new Date() });
  if (result.ok) {
    revalidatePath(`/changes/${input.change}`);
    revalidatePath("/");
  }
  return result;
}
