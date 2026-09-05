"use client";

import { useEffect, useRef, useState } from "react";
import type { LedgerRow, LedgerSummary } from "@/lib/ledger/ledger";
import type { AnswerResult } from "@/lib/change/actions";
import { ledgerStatusFrom, type LedgerStatus } from "@/lib/change/ledger-status";
import type { Unauthenticated } from "@/app/changes/[name]/actions";
import { AnswerForm, type AnswerSubmit } from "./AnswerForm";

/**
 * The Ledger tab (ledger-answering spec): every row of `decisions.md` in
 * file order with its class as a word, the blocking reason above the rows,
 * and the answer form inside each `needs_human` row. After a submit the
 * rows re-render from what the server returned and focus moves to the
 * `role="status"` message, which a conflict also uses.
 */

export interface LedgerState {
  status: LedgerStatus;
  statusText: string;
  rows: LedgerRow[];
  summary: LedgerSummary;
  blockingReason: string | null;
  /** Blob SHA of the decisions.md these rows came from; null when missing. */
  sha: string | null;
}

export interface LedgerPanelProps {
  refName: string;
  change: string;
  ledger: LedgerState;
  submit: AnswerSubmit;
  /** Called whenever the rows or the head changed on the server. */
  onLedgerChange?: (ledger: LedgerState, headSha: string | null) => void;
}

export function classLabel(row: LedgerRow): "needs you" | "resolved" | "invalid" {
  if (!row.valid) return "invalid";
  return row.class === "needs_human" ? "needs you" : "resolved";
}

export const SESSION_ENDED = "Your session has ended; sign in again";

export function LedgerPanel({ refName, change, ledger: initial, submit, onLedgerChange }: LedgerPanelProps) {
  const [ledger, setLedger] = useState<LedgerState>(initial);
  const [message, setMessage] = useState<string | null>(null);
  const status = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (message) status.current?.focus();
  }, [message]);

  function update(next: LedgerState, headSha: string | null) {
    setLedger(next);
    onLedgerChange?.(next, headSha);
  }

  function onResult(result: AnswerResult | Unauthenticated, row: LedgerRow) {
    if (result.ok) {
      const { status: s, statusText } = ledgerStatusFrom(result.summary);
      update(
        { status: s, statusText, rows: result.rows, summary: result.summary, blockingReason: result.blockingReason, sha: result.sha },
        result.headSha,
      );
      setMessage(`${row.id} answered and committed to ${refName}`);
      return;
    }
    if (result.reason === "conflict") {
      const { status: s, statusText } = ledgerStatusFrom(result.reloaded.summary);
      update(
        {
          status: s,
          statusText,
          rows: result.reloaded.rows,
          summary: result.reloaded.summary,
          blockingReason: result.reloaded.blockingReason,
          sha: result.reloaded.sha,
        },
        null,
      );
      setMessage(result.message);
      return;
    }
    setMessage(result.reason === "unauthenticated" ? SESSION_ENDED : result.message);
  }

  return (
    <section className="ledger" aria-label="Ledger">
      <p ref={status} role="status" tabIndex={-1} className={message ? "reason status ledger-status" : "sr-only status"}>
        {message ?? ""}
      </p>
      {ledger.blockingReason ? <p className="reason ledger-status">{ledger.blockingReason}</p> : null}
      {ledger.status === "missing" || ledger.status === "unparseable" ? (
        <p className="missing">{ledger.statusText}</p>
      ) : (
        <ul className="ledger-rows">
          {ledger.rows.map((row) => {
            const label = classLabel(row);
            return (
              <li key={`${row.id}-${row.line}`} className="ledger-row" data-class={label}>
                <p className="ledger-line">
                  <span className="ledger-id">{row.id}</span>
                  <span>{label}</span>
                </p>
                <p className="ledger-question">{row.question}</p>
                <dl className="ledger-cell">
                  <dt>Resolution</dt>
                  <dd>{row.resolution || "—"}</dd>
                </dl>
                <dl className="ledger-cell">
                  <dt>Evidence</dt>
                  <dd>{row.evidence || "—"}</dd>
                </dl>
                {label === "invalid" ? (
                  <dl className="ledger-cell">
                    <dt>Problems</dt>
                    <dd>{row.problems.join("; ")}</dd>
                  </dl>
                ) : null}
                {label === "needs you" ? (
                  <AnswerForm
                    row={row}
                    refName={refName}
                    change={change}
                    baseSha={ledger.sha}
                    submit={submit}
                    onResult={(result) => onResult(result, row)}
                  />
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
