"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { shortSha, type DecisionView } from "@/lib/checkpoint/checkpoint";
import type { DecideResult } from "@/lib/change/actions";
import type { DecideActionInput, Unauthenticated } from "@/app/changes/[name]/actions";
import { formatUtc } from "@/lib/format";
import { SESSION_ENDED } from "./LedgerPanel";

/**
 * Approve and Send back, pinned under the change (checkpoint-decision
 * spec). Approve carries `aria-disabled` and its reason as visible text
 * while the ledger blocks; Send back is always offered and requires a note.
 * A stale decision is named and Approve is offered again.
 */

export type DecideSubmit = (input: DecideActionInput) => Promise<DecideResult | Unauthenticated>;

export interface DecisionBarProps {
  refName: string;
  change: string;
  /** Head SHA the page was rendered from. */
  headSha: string;
  decision: DecisionView;
  /** The Approve reason from the ledger, or null when it is clear. */
  blockingReason: string | null;
  /** Blob SHA of the checkpoint.json shown, or null when none existed. */
  baseSha: string | null;
  submit: DecideSubmit;
  onDecided?: (decision: DecisionView, headSha: string, baseSha: string | null) => void;
}

export const NOTE_REQUIRED = "Say what should change";

export function decisionText(decision: DecisionView): string | null {
  if (decision.state === "none") return null;
  const line = `${decision.state} · ${formatUtc(decision.decidedAt)} · ${shortSha(decision.headSha)}`;
  return decision.note ? `${line} · ${decision.note}` : line;
}

export function staleText(decision: DecisionView): string | null {
  if (decision.state === "none" || !decision.stale) return null;
  return `${decision.state} at ${shortSha(decision.headSha)}, branch has moved to ${shortSha(decision.currentHeadSha)}`;
}

export function DecisionBar(props: DecisionBarProps) {
  const { refName, change, blockingReason, submit, onDecided } = props;
  const id = useId();
  const [decision, setDecision] = useState<DecisionView>(props.decision);
  const [headSha, setHeadSha] = useState(props.headSha);
  const [baseSha, setBaseSha] = useState(props.baseSha);
  const [message, setMessage] = useState<string | null>(null);
  const [noteOpen, setNoteOpen] = useState(false);
  const [note, setNote] = useState("");
  const [noteError, setNoteError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const status = useRef<HTMLParagraphElement>(null);

  // Follow the parent when it learns a new head, decision or blob SHA (an
  // answer moved the head, say), without an effect round trip.
  const [seen, setSeen] = useState({ headSha: props.headSha, decision: props.decision, baseSha: props.baseSha });
  if (seen.headSha !== props.headSha || seen.decision !== props.decision || seen.baseSha !== props.baseSha) {
    setSeen({ headSha: props.headSha, decision: props.decision, baseSha: props.baseSha });
    if (seen.headSha !== props.headSha) setHeadSha(props.headSha);
    if (seen.decision !== props.decision) setDecision(props.decision);
    if (seen.baseSha !== props.baseSha) setBaseSha(props.baseSha);
  }
  useEffect(() => {
    if (message) status.current?.focus();
  }, [message]);

  const blocked = blockingReason !== null;

  function apply(result: DecideResult | Unauthenticated, verb: string) {
    if (result.ok) {
      setDecision(result.decision);
      setHeadSha(result.headSha);
      setBaseSha(result.sha);
      setNoteOpen(false);
      setNote("");
      setMessage(`${verb} and committed to ${refName}`);
      onDecided?.(result.decision, result.headSha, result.sha);
      return;
    }
    if (result.reason === "conflict") {
      setDecision(result.reloaded.decision);
      setHeadSha(result.reloaded.headSha);
      setBaseSha(result.reloaded.sha);
      setMessage(result.message);
      onDecided?.(result.reloaded.decision, result.reloaded.headSha, result.reloaded.sha);
      return;
    }
    if (result.reason === "note_required") {
      setNoteError(result.message);
      return;
    }
    if (result.reason === "ledger_blocks") {
      setMessage(`${result.message}: ${result.detail}`);
      return;
    }
    setMessage(result.reason === "unauthenticated" ? SESSION_ENDED : result.message);
  }

  async function approve() {
    if (blocked || busy) return;
    setBusy(true);
    try {
      apply(await submit({ ref: refName, change, state: "approved", baseSha, headSha }), "Approved");
    } finally {
      setBusy(false);
    }
  }

  async function sendBack(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = note.trim();
    if (!trimmed) {
      setNoteError(NOTE_REQUIRED);
      return;
    }
    setNoteError(null);
    setBusy(true);
    try {
      apply(await submit({ ref: refName, change, state: "returned", note: trimmed, baseSha, headSha }), "Sent back");
    } finally {
      setBusy(false);
    }
  }

  const current = decisionText(decision);
  const stale = staleText(decision);

  return (
    <section className="decision-bar" aria-label="Decision">
      <p ref={status} role="status" tabIndex={-1} className={message ? "reason status" : "sr-only status"}>
        {message ?? ""}
      </p>
      {current ? <p className="decision-line">{current}</p> : null}
      {stale ? <p className="decision-line">{stale}</p> : null}
      {blocked ? (
        <p className="reason" id={`${id}-reason`}>
          {blockingReason}
        </p>
      ) : null}
      <div className="decision-controls">
        <button
          type="button"
          className={`btn ${blocked ? "btn-blocked" : "btn-primary"}`}
          aria-disabled={blocked || undefined}
          aria-describedby={blocked ? `${id}-reason` : undefined}
          disabled={busy}
          onClick={approve}
        >
          Approve
        </button>
        <button
          type="button"
          className="btn"
          aria-expanded={noteOpen}
          aria-controls={`${id}-note-form`}
          disabled={busy}
          onClick={() => setNoteOpen((open) => !open)}
        >
          Send back
        </button>
      </div>
      {noteOpen ? (
        <form id={`${id}-note-form`} className="note-form" onSubmit={sendBack} aria-label="Send back with a note">
          <label className="field-label" htmlFor={`${id}-note`}>
            Note
          </label>
          <textarea
            id={`${id}-note`}
            className="note-field"
            rows={2}
            value={note}
            aria-invalid={noteError ? true : undefined}
            aria-describedby={noteError ? `${id}-note-error` : undefined}
            onChange={(event) => {
              setNote(event.target.value);
              if (noteError) setNoteError(null);
            }}
          />
          {noteError ? (
            <p id={`${id}-note-error`} role="alert" className="reason">
              {noteError}
            </p>
          ) : null}
          <button type="submit" className="btn btn-primary" disabled={busy}>
            Send back
          </button>
        </form>
      ) : null}
    </section>
  );
}
