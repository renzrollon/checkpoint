import { isHostError, type GitHost, type HostErrorShape } from "@/lib/githost";
import { changeFilePath } from "@/lib/githost/guard";
import {
  decisionView,
  readCheckpoint,
  serializeCheckpoint,
  withDecision,
  type Checkpoint,
  type DecisionView,
} from "@/lib/checkpoint/checkpoint";
import { answerRow as answerLedgerRow, type LedgerRow, type LedgerSummary } from "@/lib/ledger/ledger";
import { ledgerViewFrom, checkpointViewFrom, type Artifact, type LedgerView } from "./load";

/**
 * The two writes the reader performs (ledger-answering and
 * checkpoint-decision specs), as pure orchestration over the adapter. Every
 * write carries the blob SHA the page showed (design D10); a stale SHA is a
 * conflict that returns the fresh file so the panel re-renders without a
 * second round trip, and nothing is ever retried.
 */

export interface AnswerInput {
  ref: string;
  change: string;
  id: string;
  answer: string;
  /** Blob SHA of the decisions.md the owner was shown. */
  baseSha: string | null;
  /** UTC date for the evidence cell (design D13). */
  today: Date | string;
}

export interface ReloadedLedger {
  text: string | null;
  sha: string | null;
  rows: LedgerRow[];
  summary: LedgerSummary;
  statusText: string;
  blockingReason: string | null;
}

export type AnswerResult =
  | {
      ok: true;
      row: LedgerRow;
      text: string;
      sha: string;
      commitSha: string;
      headSha: string;
      rows: LedgerRow[];
      summary: LedgerSummary;
      blockingReason: string | null;
    }
  | { ok: false; reason: "blank_answer" | "not_needs_human" | "not_found" | "unparseable" | "missing"; message: string }
  | { ok: false; reason: "conflict"; message: string; reloaded: ReloadedLedger }
  | { ok: false; reason: "host"; message: string; error: HostErrorShape };

async function readArtifact(host: GitHost, path: string, ref: string): Promise<Artifact> {
  const file = path.slice(path.lastIndexOf("/") + 1);
  try {
    const read = await host.readFile(path, ref);
    return { file, text: read.text, sha: read.sha, missing: false };
  } catch (e) {
    if (isHostError(e) && e.kind === "not_found") return { file, text: null, sha: null, missing: true };
    throw e;
  }
}

async function ledgerOnRef(host: GitHost, change: string, ref: string): Promise<LedgerView> {
  const [ledger, design] = await Promise.all([
    readArtifact(host, changeFilePath(change, "decisions.md"), ref),
    readArtifact(host, changeFilePath(change, "design.md"), ref),
  ]);
  return ledgerViewFrom(ledger, design.missing ? null : design.text);
}

function reloadedFrom(view: LedgerView): ReloadedLedger {
  return {
    text: view.text,
    sha: view.sha,
    rows: view.rows,
    summary: view.summary,
    statusText: view.statusText,
    blockingReason: view.blockingReason,
  };
}

function hostFailure(e: unknown): { ok: false; reason: "host"; message: string; error: HostErrorShape } | null {
  if (!isHostError(e)) return null;
  return { ok: false, reason: "host", message: e.message, error: e.toJSON() };
}

/** Answer a `needs_human` row in place and commit `decisions.md`. */
export async function answerRow(host: GitHost, input: AnswerInput): Promise<AnswerResult> {
  const path = changeFilePath(input.change, "decisions.md");
  try {
    const fresh = await ledgerOnRef(host, input.change, input.ref);
    if (fresh.missing || fresh.text === null) {
      return { ok: false, reason: "missing", message: `decisions.md is missing on ${input.ref}` };
    }
    if (fresh.sha !== input.baseSha) {
      return {
        ok: false,
        reason: "conflict",
        message: `The ledger changed on ${input.ref} since you opened it; reloaded`,
        reloaded: reloadedFrom(fresh),
      };
    }

    const edited = answerLedgerRow(fresh.text, { id: input.id, answer: input.answer, today: input.today });
    if (!edited.ok) return { ok: false, reason: edited.reason, message: edited.message };

    let written;
    try {
      written = await host.writeFile({
        path,
        ref: input.ref,
        content: edited.text,
        message: `checkpoint(${input.change}): answer ${input.id.trim()}`,
        baseSha: fresh.sha,
      });
    } catch (e) {
      if (isHostError(e) && e.kind === "conflict") {
        const reloaded = await ledgerOnRef(host, input.change, input.ref);
        return {
          ok: false,
          reason: "conflict",
          message: `The ledger changed on ${input.ref} since you opened it; reloaded`,
          reloaded: reloadedFrom(reloaded),
        };
      }
      throw e;
    }

    const after = ledgerViewFrom(
      { file: "decisions.md", text: edited.text, sha: written.sha, missing: false },
      // The design text did not change; re-read it for the reference audit.
      (await readArtifact(host, changeFilePath(input.change, "design.md"), input.ref)).text,
    );
    const head = await host.resolveRef(input.ref);
    return {
      ok: true,
      row: edited.row,
      text: edited.text,
      sha: written.sha,
      commitSha: written.commitSha,
      headSha: head.headSha,
      rows: after.rows,
      summary: after.summary,
      blockingReason: after.blockingReason,
    };
  } catch (e) {
    const failure = hostFailure(e);
    if (failure) return failure;
    throw e;
  }
}

export interface DecideInput {
  ref: string;
  change: string;
  state: "approved" | "returned";
  note?: string;
  /** Blob SHA of the checkpoint.json the owner was shown, or null when none existed. */
  baseSha: string | null;
  /** Head SHA the page was rendered from; recorded for the audit trail. */
  headSha: string;
  now: Date | string;
}

export interface ReloadedCheckpoint {
  text: string | null;
  sha: string | null;
  present: boolean;
  problem: string | null;
  decision: DecisionView;
  headSha: string;
}

export type DecideResult =
  | { ok: true; decision: DecisionView; checkpoint: Checkpoint; sha: string; commitSha: string; headSha: string }
  | { ok: false; reason: "note_required"; message: string }
  | { ok: false; reason: "ledger_blocks"; message: string; detail: string }
  | { ok: false; reason: "checkpoint_unreadable"; message: string }
  | { ok: false; reason: "conflict"; message: string; reloaded: ReloadedCheckpoint }
  | { ok: false; reason: "host"; message: string; error: HostErrorShape };

async function checkpointReload(host: GitHost, change: string, ref: string): Promise<ReloadedCheckpoint> {
  const file = await readArtifact(host, changeFilePath(change, "checkpoint.json"), ref);
  const view = checkpointViewFrom(file);
  const head = await host.resolveRef(ref);
  return {
    text: view.text,
    sha: view.sha,
    present: view.present,
    problem: view.problem,
    decision: decisionView(view.value, head.headSha),
    headSha: head.headSha,
  };
}

/** Record approve or send back in `checkpoint.json` on the ref. */
export async function decide(host: GitHost, input: DecideInput): Promise<DecideResult> {
  const note = String(input.note ?? "").trim();
  if (input.state === "returned" && !note) {
    return { ok: false, reason: "note_required", message: "Say what should change" };
  }
  const path = changeFilePath(input.change, "checkpoint.json");
  const conflictMessage = `The decision file changed on ${input.ref}; reloaded`;

  try {
    if (input.state === "approved") {
      const ledger = await ledgerOnRef(host, input.change, input.ref);
      if (ledger.summary.blocking) {
        return {
          ok: false,
          reason: "ledger_blocks",
          message: "ledger blocks approval",
          detail: ledger.blockingReason ?? "the ledger blocks",
        };
      }
    }

    const existing = await readArtifact(host, path, input.ref);
    if (existing.sha !== input.baseSha) {
      return { ok: false, reason: "conflict", message: conflictMessage, reloaded: await checkpointReload(host, input.change, input.ref) };
    }
    const read = readCheckpoint(existing.missing ? null : existing.text);
    if (read.present && !read.checkpoint) {
      return {
        ok: false,
        reason: "checkpoint_unreadable",
        message: `checkpoint.json on ${input.ref} could not be read, so nothing was written: ${read.problem}`,
      };
    }

    const head = await host.resolveRef(input.ref);
    const decidedAt = typeof input.now === "string" ? input.now : input.now.toISOString();
    const next = withDecision(read.checkpoint, input.change, {
      state: input.state,
      note,
      decidedAt,
      headSha: head.headSha,
    });

    let written;
    try {
      written = await host.writeFile({
        path,
        ref: input.ref,
        content: serializeCheckpoint(next),
        message: `checkpoint(${input.change}): ${input.state === "approved" ? "approve" : "return"}`,
        baseSha: existing.sha,
      });
    } catch (e) {
      if (isHostError(e) && e.kind === "conflict") {
        return { ok: false, reason: "conflict", message: conflictMessage, reloaded: await checkpointReload(host, input.change, input.ref) };
      }
      throw e;
    }

    return {
      ok: true,
      decision: decisionView(next, head.headSha),
      checkpoint: next,
      sha: written.sha,
      commitSha: written.commitSha,
      headSha: head.headSha,
    };
  } catch (e) {
    const failure = hostFailure(e);
    if (failure) return failure;
    throw e;
  }
}
