/**
 * TypeScript port of Interlock's `lib/ledger.mjs` grammar (design D7):
 * `parseLedger`, `serializeLedger`, `isEmptyCell` and `summarize` expose the
 * same shapes as the original, and golden fixtures generated from the real
 * module (`scripts/gen-ledger-fixtures.mjs`) pin the parity.
 *
 * `answerRow` is the reader's one addition. It re-renders a single row with
 * the same cell rules as `serializeLedger` and splices it in at the row's
 * parsed line, so every other line of `decisions.md` stays byte-identical.
 *
 * The parser is deliberately paranoid: a ledger that cannot be read must
 * never come back looking empty, because an empty ledger reads as "nothing
 * needs a human". Malformed rows are collected as `invalid`, never dropped.
 */

export const LEDGER_FILE = "decisions.md";

export const NEEDS_HUMAN = "needs_human";
export const AGENT_RESOLVED = "agent_resolved";
export const DECISION_CLASSES = Object.freeze([NEEDS_HUMAN, AGENT_RESOLVED] as const);
export type DecisionClass = (typeof DECISION_CLASSES)[number];

export const COLUMNS = Object.freeze(["id", "question", "class", "resolution", "evidence"] as const);

// Placeholders that mean "no value", plus the hedges shared/DECISION-LEDGER.md
// lists as "not evidence". Matched on the whole cell after lowercase, trim and
// an optional trailing period.
const EMPTY_MARKERS = new Set([
  "",
  "-",
  "--",
  "---",
  "—",
  "–",
  "n/a",
  "na",
  "tbd",
  "?",
  "obvious",
  "self-evident",
  "self evident",
  "standard practice",
  "common sense",
  "see above",
  "as discussed",
  "n a",
]);

export interface LedgerRow {
  id: string;
  question: string;
  /** Normalised class token; may be anything when the row is invalid. */
  class: string;
  resolution: string;
  evidence: string;
  /** 1-based line in the source text. */
  line: number;
  /** The trimmed source line. */
  raw: string;
  valid: boolean;
  problems: string[];
}

export interface InvalidRow {
  row: LedgerRow;
  reason: string;
}

export interface ParsedLedger {
  change: string | null;
  parseable: boolean;
  rows: LedgerRow[];
  invalid: InvalidRow[];
}

export interface ParseOptions {
  /**
   * The change's `design.md`. Supplying it turns on the reference audit:
   * every `agent_resolved` id must appear in the design. `null` means the
   * design is absent, which makes every reference unresolvable. Omitting the
   * key entirely skips the audit.
   */
  designText?: string | null;
}

/** True when a cell carries no value: blank, a dash placeholder, or a hedge. */
export function isEmptyCell(value: unknown): boolean {
  const folded = String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\.+$/, "");
  return EMPTY_MARKERS.has(folded) || EMPTY_MARKERS.has(folded.replace(/\s+/g, " "));
}

// Split one markdown table row into cells. Tolerates a missing leading or
// trailing pipe and any amount of padding. '\|' is an escaped literal pipe.
function splitRow(line: string): string[] {
  let s = line.trim();
  if (s.startsWith("|")) s = s.slice(1);
  if (/(^|[^\\])\|$/.test(s)) s = s.slice(0, -1);
  return s.split(/(?<!\\)\|/).map((c) => c.replace(/\\\|/g, "|").trim());
}

function isSeparatorRow(cells: string[]): boolean {
  return cells.length > 0 && cells.every((c) => /^:?-{1,}:?$/.test(c));
}

function isHeaderRow(cells: string[]): boolean {
  return cells.length >= 2 && cells[0].toLowerCase() === "id" && cells[1].toLowerCase() === "question";
}

// Tolerate "needs human", "Needs-Human", "AGENT_RESOLVED".
function normalizeClass(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

const HEADING = /^#\s*Decisions\s*[—–:-]\s*(.+?)\s*$/;

function referenceResolves(id: string, designText: string | null | undefined): boolean {
  if (typeof designText !== "string" || !designText.trim()) return false;
  const token = String(id).trim();
  if (!token) return false;
  const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^A-Za-z0-9_])${escaped}([^A-Za-z0-9_]|$)`).test(designText);
}

/** Parse a decisions.md body. Never throws. */
export function parseLedger(text: string | null | undefined, opts: ParseOptions = {}): ParsedLedger {
  const body = typeof text === "string" ? text : "";
  const lines = body.split("\n");
  const auditReferences = Object.prototype.hasOwnProperty.call(opts || {}, "designText");
  const designText = opts ? opts.designText : undefined;

  let change: string | null = null;
  let sawTable = false;
  const rows: LedgerRow[] = [];
  const invalid: InvalidRow[] = [];
  // A markdown table ends at a blank line. Tracking that lets a row omit its
  // leading pipe without prose elsewhere in the file being mistaken for a row.
  let inTable = false;

  for (let i = 0; i < lines.length; i += 1) {
    const trimmed = lines[i].trim();

    if (!trimmed) {
      inTable = false;
      continue;
    }

    if (change === null) {
      const h = HEADING.exec(trimmed);
      if (h) {
        change = h[1].trim();
        continue;
      }
    }

    const looksLikeRow = trimmed.startsWith("|") || (inTable && trimmed.includes("|"));
    if (!looksLikeRow) continue;

    const cells = splitRow(trimmed);
    if (isSeparatorRow(cells)) {
      inTable = true;
      sawTable = true;
      continue;
    }
    if (isHeaderRow(cells)) {
      inTable = true;
      sawTable = true;
      continue;
    }
    inTable = true;
    sawTable = true;

    const problems: string[] = [];
    if (cells.length !== COLUMNS.length) {
      problems.push(`expected ${COLUMNS.length} columns (${COLUMNS.join(", ")}), found ${cells.length}`);
    }

    const row: LedgerRow = {
      id: cells[0] ?? "",
      question: cells[1] ?? "",
      class: normalizeClass(cells[2]),
      resolution: isEmptyCell(cells[3]) ? "" : cells[3],
      evidence: isEmptyCell(cells[4]) ? "" : cells[4],
      line: i + 1,
      raw: trimmed,
      valid: true,
      problems,
    };

    if (isEmptyCell(row.id)) problems.push("row has no id");
    if (isEmptyCell(row.question)) problems.push("row has no question");

    if (!(DECISION_CLASSES as readonly string[]).includes(row.class)) {
      problems.push(
        row.class
          ? `unknown class "${cells[2]}" (expected ${DECISION_CLASSES.join(" or ")})`
          : `missing class (expected ${DECISION_CLASSES.join(" or ")})`,
      );
    } else if (row.class === AGENT_RESOLVED) {
      // The audit. agent_resolved is a claim, not a fact.
      if (!row.resolution) problems.push("agent_resolved without a written resolution");
      if (!row.evidence) problems.push("agent_resolved without evidence");
      if (auditReferences && !referenceResolves(row.id, designText)) {
        problems.push(
          typeof designText === "string" && designText.trim()
            ? `agent_resolved but "${row.id}" appears nowhere in design.md — ` +
                "the resolution must be recorded there, referenced by id"
            : `agent_resolved but design.md is absent or unreadable, so the reference ` +
                `"${row.id}" cannot be resolved`,
        );
      }
    }

    row.valid = problems.length === 0;
    rows.push(row);
    if (!row.valid) invalid.push({ row, reason: problems.join("; ") });
  }

  // A file with neither a heading nor a table is not an empty ledger — it is a
  // ledger nobody can read.
  const parseable = sawTable || change !== null;
  return { change, parseable, rows, invalid };
}

export type RowInput = Partial<Pick<LedgerRow, "id" | "question" | "class" | "resolution" | "evidence">>;

/**
 * Render a ledger. Round-trips with parseLedger: serialize → parse → serialize
 * is stable. Empty cells become the em dash placeholder from the template.
 */
export function serializeLedger(change: string | null | undefined, rows: readonly RowInput[] | null | undefined): string {
  const name = typeof change === "string" && change.trim() ? change.trim() : "unnamed-change";
  const list = Array.isArray(rows) ? rows : [];
  const out: string[] = [];
  out.push(`# Decisions — ${name}`);
  out.push("");
  out.push(`| ${COLUMNS.join(" | ")} |`);
  out.push(`|${COLUMNS.map(() => "----").join("|")}|`);
  for (const r of list) {
    out.push(renderRow(r && typeof r === "object" ? r : {}));
  }
  out.push("");
  return out.join("\n");
}

/** One table line for a row, with the same cell rules as `serializeLedger`. */
export function renderRow(row: RowInput): string {
  return (
    "| " +
    [cell(row.id), cell(row.question), cell(normalizeClass(row.class)), cell(row.resolution), cell(row.evidence)].join(
      " | ",
    ) +
    " |"
  );
}

// A cell never breaks the table: pipes are escaped, newlines collapse, and an
// absent value renders as the placeholder the template uses.
function cell(value: unknown): string {
  const s = String(value ?? "")
    .replace(/\r?\n/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (isEmptyCell(s)) return "—";
  return s.replace(/\|/g, "\\|");
}

export interface LedgerSummaryInput {
  rows?: LedgerRow[];
  invalid?: InvalidRow[];
  parseable?: boolean;
  /** `false` when there is no decisions.md at all. */
  exists?: boolean;
  /** `false` when the change directory itself is absent. */
  changeExists?: boolean;
}

export interface LedgerSummary {
  total: number;
  needsHuman: number;
  agentResolved: number;
  invalidCount: number;
  invalid: number;
  exists: boolean;
  missing: boolean;
  unparseable: boolean;
  changeExists: boolean;
  blocking: boolean;
}

/**
 * Roll a parsed ledger up into the numbers a gate acts on. `blocking` is true
 * when anything remains that a human must touch: a `needs_human` row, any
 * invalid row, a missing ledger or an unparseable one.
 */
export function summarize(parsed: LedgerSummaryInput | null | undefined): LedgerSummary {
  const p = parsed && typeof parsed === "object" ? parsed : {};
  const rows = Array.isArray(p.rows) ? p.rows : [];
  const invalidList = Array.isArray(p.invalid) ? p.invalid : [];

  const needsHuman = rows.filter((r) => r.valid && r.class === NEEDS_HUMAN).length;
  const agentResolved = rows.filter((r) => r.valid && r.class === AGENT_RESOLVED).length;
  const invalidCount = invalidList.length;

  const missingChange = p.changeExists === false;
  const exists = p.exists !== false;
  const missing = !exists;
  const unparseable = exists && p.parseable === false;

  return {
    total: rows.length,
    needsHuman,
    agentResolved,
    invalidCount,
    invalid: invalidCount,
    exists,
    missing,
    unparseable,
    changeExists: !missingChange,
    blocking: needsHuman > 0 || invalidCount > 0 || missingChange || missing || unparseable,
  };
}

/** Design D13: the evidence cell a phone-side answer writes. Date is UTC. */
export function humanEvidence(today: Date | string): string {
  const day = typeof today === "string" ? today : today.toISOString().slice(0, 10);
  return `human decision ${day} via Checkpoint`;
}

/** Collapse newlines to spaces and trim; pipes are escaped at render time. */
export function normalizeAnswer(answer: string): string {
  return String(answer ?? "")
    .replace(/\r?\n/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export type AnswerRowResult =
  | { ok: true; text: string; row: LedgerRow; line: number }
  | { ok: false; reason: "blank_answer" | "unparseable" | "not_found" | "not_needs_human"; message: string };

/**
 * Answer one `needs_human` row in place. Only that row's line changes; every
 * other line of `text` is returned byte-identical (design D7).
 */
export function answerRow(
  text: string,
  input: { id: string; answer: string; today: Date | string },
): AnswerRowResult {
  const answer = normalizeAnswer(input.answer);
  if (!answer) return { ok: false, reason: "blank_answer", message: "An answer is required" };

  const parsed = parseLedger(text);
  if (!parsed.parseable) {
    return { ok: false, reason: "unparseable", message: `${LEDGER_FILE} carries no readable decision table` };
  }
  const id = String(input.id ?? "").trim();
  const target = parsed.rows.find((r) => r.id === id);
  if (!target) return { ok: false, reason: "not_found", message: `${id || "that row"} is not in the ledger` };
  if (!(target.valid && target.class === NEEDS_HUMAN)) {
    return { ok: false, reason: "not_needs_human", message: `${id} is not waiting on a person` };
  }

  const replacement: RowInput = {
    id: target.id,
    question: target.question,
    class: AGENT_RESOLVED,
    resolution: answer,
    evidence: humanEvidence(input.today),
  };
  const rendered = renderRow(replacement);

  const lines = text.split("\n");
  lines[target.line - 1] = rendered;
  const next = lines.join("\n");

  const reparsed = parseLedger(next);
  const row = reparsed.rows.find((r) => r.id === id && r.line === target.line);
  if (!row) {
    return { ok: false, reason: "unparseable", message: `${id} could not be re-read after the edit` };
  }
  return { ok: true, text: next, row, line: target.line };
}
