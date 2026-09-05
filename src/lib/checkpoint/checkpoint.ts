import { z } from "zod";

/**
 * The `checkpoint.json` contract (design D9). The sender may write a
 * `request` block; the reader writes `decision`. The schema is tolerant:
 * `request` is optional and opaque beyond `headSha` and `risk.class`, and
 * unknown top-level fields pass through unchanged so a decision write never
 * drops something another tool recorded.
 */

export const CHECKPOINT_SCHEMA = "interlock.checkpoint/1";
export const CHECKPOINT_FILE = "checkpoint.json";

/** Mirrors `RISK_CLASSES` in Interlock's `lib/risk.mjs`. */
export const RISK_CLASSES = Object.freeze(["low", "medium", "high", "critical"] as const);
export type RiskClass = (typeof RISK_CLASSES)[number];

const requestSchema = z.looseObject({
  kind: z.string().optional(),
  requestedAt: z.string().optional(),
  headSha: z.string().optional(),
  risk: z
    .looseObject({
      class: z.unknown().optional(),
      signals: z.array(z.string()).optional(),
    })
    .optional(),
  tasks: z.unknown().optional(),
  ledger: z.unknown().optional(),
});

export const decisionSchema = z.looseObject({
  state: z.enum(["approved", "returned"]),
  note: z.string().optional().default(""),
  decidedAt: z.string(),
  decidedBy: z.string(),
  headSha: z.string(),
});

export const checkpointSchema = z.looseObject({
  schema: z.literal(CHECKPOINT_SCHEMA),
  change: z.string(),
  request: requestSchema.optional(),
  decision: decisionSchema.optional(),
});

export type CheckpointRequest = z.infer<typeof requestSchema>;
export type CheckpointDecision = z.infer<typeof decisionSchema>;
export type Checkpoint = z.infer<typeof checkpointSchema>;

export type ReadCheckpoint =
  | { present: false; checkpoint: null; problem?: undefined }
  | { present: true; checkpoint: Checkpoint; problem?: undefined }
  | { present: true; checkpoint: null; problem: string };

/**
 * Read a `checkpoint.json` body. `null` means the file is absent, which is
 * a normal state before the sender has pushed. A file that is present but
 * unreadable is reported with its problem, never treated as absent.
 */
export function readCheckpoint(text: string | null | undefined): ReadCheckpoint {
  if (text === null || text === undefined) return { present: false, checkpoint: null };
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch (e) {
    return { present: true, checkpoint: null, problem: `checkpoint.json is not JSON: ${(e as Error).message}` };
  }
  const result = checkpointSchema.safeParse(json);
  if (!result.success) {
    const detail = result.error.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`).join("; ");
    return { present: true, checkpoint: null, problem: `checkpoint.json does not match ${CHECKPOINT_SCHEMA}: ${detail}` };
  }
  return { present: true, checkpoint: result.data };
}

export interface DecisionInput {
  state: "approved" | "returned";
  note?: string;
  decidedAt: string;
  headSha: string;
}

/**
 * Merge a decision into an existing checkpoint (or start one for `change`).
 * `request` and every unknown top-level field are preserved; a previous
 * decision is replaced.
 */
export function withDecision(existing: Checkpoint | null, change: string, decision: DecisionInput): Checkpoint {
  const base: Checkpoint = existing ?? { schema: CHECKPOINT_SCHEMA, change };
  return {
    ...base,
    schema: CHECKPOINT_SCHEMA,
    change: base.change || change,
    decision: {
      state: decision.state,
      note: decision.note ?? "",
      decidedAt: decision.decidedAt,
      decidedBy: "checkpoint",
      headSha: decision.headSha,
    },
  };
}

/** Serialise for writing: two-space indent and a trailing newline. */
export function serializeCheckpoint(checkpoint: Checkpoint): string {
  return JSON.stringify(checkpoint, null, 2) + "\n";
}

export type RiskView =
  | { state: "observed"; class: RiskClass; headSha: string; signals: string[] }
  | { state: "stale"; class: RiskClass; headSha: string; currentHeadSha: string; signals: string[] }
  | { state: "unobserved"; raw?: string };

function isRiskClass(v: unknown): v is RiskClass {
  return typeof v === "string" && (RISK_CLASSES as readonly string[]).includes(v);
}

/**
 * What the header may say about risk. Only a class the sender recorded, in
 * Interlock's vocabulary, is shown; anything else is `unobserved`, with the
 * raw value carried for a tooltip when there was one.
 */
export function riskView(checkpoint: Checkpoint | null, headSha: string): RiskView {
  const request = checkpoint?.request;
  const rawClass = request?.risk?.class;
  if (!request || rawClass === undefined || rawClass === null) return { state: "unobserved" };
  if (!isRiskClass(rawClass)) return { state: "unobserved", raw: String(rawClass) };
  const recorded = typeof request.headSha === "string" ? request.headSha : "";
  const signals = Array.isArray(request.risk?.signals) ? request.risk.signals : [];
  if (recorded && recorded !== headSha) {
    return { state: "stale", class: rawClass, headSha: recorded, currentHeadSha: headSha, signals };
  }
  return { state: "observed", class: rawClass, headSha: recorded || headSha, signals };
}

export type DecisionView =
  | { state: "none" }
  | {
      state: "approved" | "returned";
      note: string;
      decidedAt: string;
      decidedBy: string;
      headSha: string;
      currentHeadSha: string;
      stale: boolean;
    };

/** The current decision, flagged stale when the ref head has moved past it. */
export function decisionView(checkpoint: Checkpoint | null, headSha: string): DecisionView {
  const d = checkpoint?.decision;
  if (!d) return { state: "none" };
  return {
    state: d.state,
    note: d.note ?? "",
    decidedAt: d.decidedAt,
    decidedBy: d.decidedBy,
    headSha: d.headSha,
    currentHeadSha: headSha,
    stale: d.headSha !== headSha,
  };
}

/** First seven characters of a SHA, for display. */
export function shortSha(sha: string): string {
  return String(sha ?? "").slice(0, 7);
}
