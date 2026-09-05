"use client";

import { useId, useState, type FormEvent } from "react";
import type { LedgerRow } from "@/lib/ledger/ledger";
import { optionsFromQuestion } from "@/lib/ledger/options";
import type { AnswerResult } from "@/lib/change/actions";
import type { AnswerActionInput, Unauthenticated } from "@/app/changes/[name]/actions";

/**
 * The answer form a `needs_human` row expands into (ledger-answering spec).
 * Chips come from the question text (design D14); free text is always
 * accepted; a blank answer is refused here before anything is sent. The
 * write itself goes through `submit` with the blob SHA the page showed.
 */

export type AnswerSubmit = (input: AnswerActionInput) => Promise<AnswerResult | Unauthenticated>;

export interface AnswerFormProps {
  row: LedgerRow;
  refName: string;
  change: string;
  /** Blob SHA of the decisions.md the owner is looking at. */
  baseSha: string | null;
  submit: AnswerSubmit;
  onResult: (result: AnswerResult | Unauthenticated, answer: string) => void;
}

export const ANSWER_REQUIRED = "An answer is required";

export function AnswerForm({ row, refName, change, baseSha, submit, onResult }: AnswerFormProps) {
  const id = useId();
  const options = optionsFromQuestion(row.question);
  const [answer, setAnswer] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = answer.trim();
    if (!trimmed) {
      setError(ANSWER_REQUIRED);
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const result = await submit({ ref: refName, change, id: row.id, answer: trimmed, baseSha });
      onResult(result, trimmed);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="answer-form" onSubmit={onSubmit} aria-label={`Answer ${row.id}`}>
      {options.length > 0 ? (
        <div className="ledger-cell">
          <span className="label" id={`${id}-options`}>
            Options from the question
          </span>
          <ul className="chips" aria-labelledby={`${id}-options`}>
            {options.map((option) => (
              <li key={option}>
                <button
                  type="button"
                  className="chip"
                  aria-pressed={answer === option}
                  onClick={() => {
                    setAnswer(option);
                    setError(null);
                  }}
                >
                  {option}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <label className="field-label" htmlFor={`${id}-answer`}>
        Your answer
      </label>
      <input
        id={`${id}-answer`}
        className="field"
        type="text"
        name="answer"
        value={answer}
        autoComplete="off"
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        onChange={(event) => {
          setAnswer(event.target.value);
          if (error) setError(null);
        }}
      />
      {error ? (
        <p id={`${id}-error`} role="alert" className="reason">
          {error}
        </p>
      ) : null}
      <button type="submit" className="btn btn-primary" disabled={busy}>
        Answer
      </button>
    </form>
  );
}
