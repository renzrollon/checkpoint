import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { LedgerSummary } from "@/lib/ledger/ledger";
import { byFullText } from "@/test/dom";
import { ChangeHeader, ledgerLine, type ChangeHeaderProps } from "./ChangeHeader";

const HEAD = "cd77a9bbd44319ca73e560cc2a0016048c83448d";
const OLD = "0123456789abcdef0123456789abcdef01234567";

function summary(over: Partial<LedgerSummary> = {}): LedgerSummary {
  return {
    total: 5,
    needsHuman: 1,
    agentResolved: 3,
    invalidCount: 1,
    invalid: 1,
    exists: true,
    missing: false,
    unparseable: false,
    changeExists: true,
    blocking: true,
    ...over,
  };
}

function props(over: Partial<ChangeHeaderProps> = {}): ChangeHeaderProps {
  return {
    name: "add-user-auth",
    refName: "feat/auth",
    headSha: HEAD,
    tasks: { done: 4, total: 12, waves: 3 },
    ledger: { status: "blocking", summary: summary() },
    risk: { state: "observed", class: "medium", headSha: HEAD, signals: [] },
    decision: { state: "none" },
    ...over,
  };
}

describe("ChangeHeader", () => {
  it("shows name, ref, short sha, counts with denominators and the ledger line", () => {
    render(<ChangeHeader {...props()} />);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("add-user-auth");
    expect(screen.getByText("feat/auth")).toBeTruthy();
    expect(screen.getByText("cd77a9b")).toBeTruthy();
    expect(byFullText("Tasks done4 of 12tasks")).toBeTruthy();
    expect(byFullText("Waves3waves")).toBeTruthy();
    expect(screen.getByText("1 needs you, 3 resolved, 1 invalid, of 5 rows")).toBeTruthy();
    expect(screen.queryByText(/approved|returned/)).toBeNull();
  });

  it("shows an observed risk with the head it was recorded at", () => {
    render(<ChangeHeader {...props()} />);
    expect(screen.getByText("risk medium")).toBeTruthy();
    expect(screen.getByText("recorded at cd77a9b")).toBeTruthy();
  });

  it("labels a risk recorded for an older head as stale", () => {
    render(
      <ChangeHeader {...props({ risk: { state: "stale", class: "high", headSha: OLD, currentHeadSha: HEAD, signals: [] } })} />,
    );
    expect(screen.getByText("risk high")).toBeTruthy();
    expect(screen.getByText("stale: recorded for 0123456")).toBeTruthy();
  });

  it("shows risk unobserved in the same reading when nothing was recorded", () => {
    render(<ChangeHeader {...props({ risk: { state: "unobserved" } })} />);
    const value = screen.getByText("risk unobserved");
    expect(value.className).toBe("reading-value");
    expect(screen.queryByText(/recorded/)).toBeNull();
  });

  it("writes a missing or unreadable ledger on the ledger line", () => {
    expect(ledgerLine("missing", summary({ missing: true }))).toBe("ledger missing");
    expect(ledgerLine("unparseable", summary({ unparseable: true }))).toBe("ledger unreadable");
    render(<ChangeHeader {...props({ ledger: { status: "missing", summary: summary({ missing: true, total: 0 }) } })} />);
    expect(screen.getByText("ledger missing")).toBeTruthy();
  });

  it("shows the current decision with its time and short head", () => {
    render(
      <ChangeHeader
        {...props({
          decision: { state: "approved", note: "", decidedAt: "2026-09-04T19:30:00Z", decidedBy: "checkpoint", headSha: HEAD, currentHeadSha: HEAD, stale: false },
        })}
      />,
    );
    expect(screen.getByText("approved · 2026-09-04 19:30 UTC · cd77a9b")).toBeTruthy();
  });
});
