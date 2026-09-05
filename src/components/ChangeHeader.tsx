import type { DecisionView, RiskView } from "@/lib/checkpoint/checkpoint";
import { shortSha } from "@/lib/checkpoint/checkpoint";
import type { LedgerSummary } from "@/lib/ledger/ledger";
import type { LedgerStatus } from "@/lib/change/ledger-status";
import { formatUtc, plural } from "@/lib/format";

/**
 * The change page header (change-reading spec, "Header with counts and
 * denominators"). Every number carries its denominator and every absent
 * reading is a word set exactly like a value.
 */

export interface ChangeHeaderProps {
  name: string;
  refName: string;
  headSha: string;
  tasks: { done: number; total: number; waves: number };
  ledger: { status: LedgerStatus; summary: LedgerSummary };
  risk: RiskView;
  decision: DecisionView;
}

export function ledgerLine(status: LedgerStatus, summary: LedgerSummary): string {
  if (status === "missing") return "ledger missing";
  if (status === "unparseable") return "ledger unreadable";
  return `${summary.needsHuman} needs you, ${summary.agentResolved} resolved, ${summary.invalid} invalid, of ${plural(summary.total, "row")}`;
}

export function riskReading(risk: RiskView): { value: string; denominator: string; title?: string } {
  switch (risk.state) {
    case "observed":
      return { value: `risk ${risk.class}`, denominator: `recorded at ${shortSha(risk.headSha)}` };
    case "stale":
      return { value: `risk ${risk.class}`, denominator: `stale: recorded for ${shortSha(risk.headSha)}` };
    case "unobserved":
    default:
      return { value: "risk unobserved", denominator: "", title: risk.raw ? `recorded class: ${risk.raw}` : undefined };
  }
}

export function decisionLine(decision: DecisionView): string | null {
  if (decision.state === "none") return null;
  return `${decision.state} · ${formatUtc(decision.decidedAt)} · ${shortSha(decision.headSha)}`;
}

function Reading({ label, value, denominator, title }: { label: string; value: string; denominator: string; title?: string }) {
  return (
    <div className="reading" title={title}>
      <span className="label">{label}</span>
      <span className="reading-value">{value}</span>
      <span className="reading-denom">{denominator}</span>
    </div>
  );
}

export function ChangeHeader({ name, refName, headSha, tasks, ledger, risk, decision }: ChangeHeaderProps) {
  const riskText = riskReading(risk);
  const decided = decisionLine(decision);
  return (
    <header className="change-header">
      <div className="change-header-top">
        <h1 className="page-title">{name}</h1>
        <p className="ref-line">
          <span>{refName}</span>
          <span>{shortSha(headSha)}</span>
        </p>
      </div>
      <div className="readings">
        <Reading label="Tasks done" value={`${tasks.done} of ${tasks.total}`} denominator="tasks" />
        <Reading label="Waves" value={String(tasks.waves)} denominator={tasks.waves === 1 ? "wave" : "waves"} />
      </div>
      <div className="header-line">
        <Reading label="Risk" value={riskText.value} denominator={riskText.denominator} title={riskText.title} />
      </div>
      <div className="header-line">
        <span className="label">Ledger</span>
        <p className="header-line-text">{ledgerLine(ledger.status, ledger.summary)}</p>
      </div>
      {decided ? (
        <div className="header-line">
          <span className="label">Decision</span>
          <p className="header-line-text">{decided}</p>
        </div>
      ) : null}
    </header>
  );
}
