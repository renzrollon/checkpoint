import type { LedgerSummary } from "@/lib/ledger/ledger";

/**
 * Words for a ledger summary, shared by the server loader and the client
 * panel. Pure: no adapter, no node modules, so a client bundle may import it.
 */

export type LedgerStatus = "blocking" | "clear" | "missing" | "unparseable";

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** The Approve reason for a ledger state, worded as the decision bar shows it. */
export function blockingReasonFor(summary: LedgerSummary): string | null {
  if (summary.missing) return "decisions.md is missing; the laptop side would refuse this";
  if (summary.unparseable) return "decisions.md is unreadable; the laptop side would refuse this";
  if (summary.needsHuman > 0) {
    return summary.needsHuman === 1
      ? "1 decision still needs you"
      : `${summary.needsHuman} decisions still need you`;
  }
  if (summary.invalid > 0) {
    return summary.invalid === 1
      ? "1 ledger row is invalid; the laptop side would refuse this"
      : `${summary.invalid} ledger rows are invalid; the laptop side would refuse this`;
  }
  return null;
}

/** The inbox status word for a ledger summary, as the card and the panel show it. */
export function ledgerStatusFrom(summary: LedgerSummary): { status: LedgerStatus; statusText: string } {
  if (summary.missing) return { status: "missing", statusText: "ledger missing" };
  if (summary.unparseable) return { status: "unparseable", statusText: "ledger unreadable" };
  if (summary.blocking) {
    return {
      status: "blocking",
      statusText:
        summary.needsHuman > 0 ? `${summary.needsHuman} needs you` : plural(summary.invalid, "invalid row", "invalid rows"),
    };
  }
  return { status: "clear", statusText: "clear" };
}
