import { HostError, isHostError, type GitHost } from "@/lib/githost";
import { CHANGES_DIR } from "@/lib/githost/guard";
import {
  decisionView,
  readCheckpoint,
  riskView,
  type Checkpoint,
  type DecisionView,
  type RiskView,
} from "@/lib/checkpoint/checkpoint";
import { parseLedger, summarize, type LedgerRow, type LedgerSummary, type ParsedLedger } from "@/lib/ledger/ledger";
import { parseTasks, type ParsedTasks } from "@/lib/tasks/tasks";

/**
 * Read a change (or every change) from a ref into the view model the pages
 * render. Every count is computed here from the artifacts on the ref, never
 * taken from the sender (design D20). Host failures propagate as `HostError`
 * so the page can name the failure kind; a missing artifact is a value, not
 * an error.
 */

export interface Artifact {
  file: string;
  text: string | null;
  sha: string | null;
  missing: boolean;
}

export interface SpecFile {
  /** Path relative to `specs/`, e.g. `access-gate/spec.md`. */
  path: string;
  text: string;
}

import { blockingReasonFor, ledgerStatusFrom, type LedgerStatus } from "./ledger-status";

export { blockingReasonFor, ledgerStatusFrom, type LedgerStatus };

export interface LedgerView {
  file: "decisions.md";
  text: string | null;
  sha: string | null;
  missing: boolean;
  parsed: ParsedLedger | null;
  rows: LedgerRow[];
  summary: LedgerSummary;
  status: LedgerStatus;
  /** "1 needs you" | "clear" | "ledger missing" | "ledger unreadable". */
  statusText: string;
  /** The reason Approve is refused, or null when the ledger is clear. */
  blockingReason: string | null;
}

export interface CheckpointView {
  file: "checkpoint.json";
  text: string | null;
  sha: string | null;
  present: boolean;
  problem: string | null;
  value: Checkpoint | null;
}

export interface ChangeView {
  name: string;
  ref: string;
  headSha: string;
  artifacts: { proposal: Artifact; design: Artifact; tasks: Artifact };
  specs: SpecFile[];
  tasks: ParsedTasks;
  ledger: LedgerView;
  checkpoint: CheckpointView;
  risk: RiskView;
  decision: DecisionView;
}

export interface InboxEntry {
  name: string;
  ledger: Pick<LedgerView, "status" | "statusText" | "summary">;
  tasks: Pick<ParsedTasks, "done" | "total" | "waves">;
  decision: DecisionView["state"];
  /** Sorted first in the inbox. */
  blocking: boolean;
}

export interface Inbox {
  ref: string;
  headSha: string;
  entries: InboxEntry[];
}

export type LoadChangeResult = { kind: "change"; change: ChangeView } | { kind: "not_found"; name: string; ref: string };

const CHANGE_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

async function readOptional(host: GitHost, path: string, ref: string): Promise<Artifact> {
  const file = path.slice(path.lastIndexOf("/") + 1);
  try {
    const read = await host.readFile(path, ref);
    return { file, text: read.text, sha: read.sha, missing: false };
  } catch (e) {
    if (isHostError(e) && e.kind === "not_found") return { file, text: null, sha: null, missing: true };
    throw e;
  }
}

/** Build the ledger view from the raw file (or its absence) and the design text. */
export function ledgerViewFrom(ledger: Artifact, designText: string | null): LedgerView {
  const parsed = ledger.missing ? null : parseLedger(ledger.text, { designText });
  const summary = summarize(
    parsed ? { ...parsed, exists: true } : { exists: false, parseable: false, rows: [], invalid: [] },
  );
  const { status, statusText } = ledgerStatusFrom(summary);
  return {
    file: "decisions.md",
    text: ledger.text,
    sha: ledger.sha,
    missing: ledger.missing,
    parsed,
    rows: parsed?.rows ?? [],
    summary,
    status,
    statusText,
    blockingReason: blockingReasonFor(summary),
  };
}

export function checkpointViewFrom(file: Artifact): CheckpointView {
  const read = readCheckpoint(file.missing ? null : file.text);
  return {
    file: "checkpoint.json",
    text: file.text,
    sha: file.sha,
    present: read.present,
    problem: read.problem ?? null,
    value: read.checkpoint,
  };
}

async function readSpecs(host: GitHost, dir: string, ref: string, prefix = "", depth = 0): Promise<SpecFile[]> {
  if (depth > 4) return [];
  let entries;
  try {
    entries = await host.listDir(dir, ref);
  } catch (e) {
    if (isHostError(e) && e.kind === "not_found") return [];
    throw e;
  }
  // Every sibling at this level is started before any of them resolves, so a
  // change's specs cost one round trip per directory level, not one per file
  // (design D4). The sort below makes the output independent of arrival order.
  const nested = await Promise.all(
    entries.map(async (entry): Promise<SpecFile[]> => {
      const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.type === "dir") return readSpecs(host, `${dir}/${entry.name}`, ref, rel, depth + 1);
      if (!entry.name.endsWith(".md")) return [];
      const read = await host.readFile(`${dir}/${entry.name}`, ref);
      return [{ path: rel, text: read.text }];
    }),
  );
  return nested.flat().sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
}

interface ChangeCore {
  tasksFile: Artifact;
  designFile: Artifact;
  ledger: LedgerView;
  checkpoint: CheckpointView;
  tasks: ParsedTasks;
}

async function readCore(host: GitHost, ref: string, name: string): Promise<ChangeCore> {
  const dir = `${CHANGES_DIR}/${name}`;
  const [designFile, tasksFile, ledgerFile, checkpointFile] = await Promise.all([
    readOptional(host, `${dir}/design.md`, ref),
    readOptional(host, `${dir}/tasks.md`, ref),
    readOptional(host, `${dir}/decisions.md`, ref),
    readOptional(host, `${dir}/checkpoint.json`, ref),
  ]);
  return {
    tasksFile,
    designFile,
    ledger: ledgerViewFrom(ledgerFile, designFile.missing ? null : designFile.text),
    checkpoint: checkpointViewFrom(checkpointFile),
    tasks: parseTasks(tasksFile.text),
  };
}

/** Inbox: every active change on the ref, blocking first, then alphabetical. */
export async function listChanges(host: GitHost, ref?: string | null): Promise<Inbox> {
  const info = await host.resolveRef(ref);
  let entries;
  try {
    entries = await host.listDir(CHANGES_DIR, info.ref);
  } catch (e) {
    if (isHostError(e) && e.kind === "not_found") return { ref: info.ref, headSha: info.headSha, entries: [] };
    throw e;
  }
  const names = entries
    .filter((e) => e.type === "dir" && e.name !== "archive" && CHANGE_NAME.test(e.name))
    .map((e) => e.name);

  const rows = await Promise.all(
    names.map(async (name): Promise<InboxEntry> => {
      const core = await readCore(host, info.ref, name);
      const decision = decisionView(core.checkpoint.value, info.headSha);
      return {
        name,
        ledger: { status: core.ledger.status, statusText: core.ledger.statusText, summary: core.ledger.summary },
        tasks: { done: core.tasks.done, total: core.tasks.total, waves: core.tasks.waves },
        decision: decision.state,
        blocking: core.ledger.summary.blocking,
      };
    }),
  );

  rows.sort((a, b) => {
    if (a.blocking !== b.blocking) return a.blocking ? -1 : 1;
    return a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
  });
  return { ref: info.ref, headSha: info.headSha, entries: rows };
}

/** One change on a ref, or a typed not_found when the directory is absent. */
export async function loadChange(host: GitHost, ref: string | null | undefined, name: string): Promise<LoadChangeResult> {
  const info = await host.resolveRef(ref);
  if (!CHANGE_NAME.test(name) || name === "archive") return { kind: "not_found", name, ref: info.ref };
  const dir = `${CHANGES_DIR}/${name}`;

  // The existence check runs alongside the reads rather than before them
  // (design D4): a missing change makes every read resolve to "missing"
  // anyway, so nothing is wasted, and a present one costs one round trip
  // fewer. Resolution order is fixed here so the thrown error never depends
  // on which call happened to fail first.
  const [exists, proposalRead, coreRead, specsRead] = await Promise.allSettled([
    host.listDir(dir, info.ref),
    readOptional(host, `${dir}/proposal.md`, info.ref),
    readCore(host, info.ref, name),
    readSpecs(host, `${dir}/specs`, info.ref),
  ]);

  if (exists.status === "rejected") {
    const e: unknown = exists.reason;
    if (isHostError(e) && e.kind === "not_found") return { kind: "not_found", name, ref: info.ref };
    throw e;
  }
  // Declaration order, so two simultaneous failures always surface the same one.
  if (proposalRead.status === "rejected") throw proposalRead.reason;
  if (coreRead.status === "rejected") throw coreRead.reason;
  if (specsRead.status === "rejected") throw specsRead.reason;
  const proposal = proposalRead.value;
  const core = coreRead.value;
  const specs = specsRead.value;

  return {
    kind: "change",
    change: {
      name,
      ref: info.ref,
      headSha: info.headSha,
      artifacts: { proposal, design: core.designFile, tasks: core.tasksFile },
      specs,
      tasks: core.tasks,
      ledger: core.ledger,
      checkpoint: core.checkpoint,
      risk: riskView(core.checkpoint.value, info.headSha),
      decision: decisionView(core.checkpoint.value, info.headSha),
    },
  };
}

export { HostError };
