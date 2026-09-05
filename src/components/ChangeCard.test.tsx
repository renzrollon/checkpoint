import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { InboxEntry } from "@/lib/change/load";
import { byFullText } from "@/test/dom";
import { ChangeCard } from "./ChangeCard";

function entry(over: Partial<InboxEntry> = {}): InboxEntry {
  return {
    name: "add-user-auth",
    ledger: {
      status: "blocking",
      statusText: "1 needs you",
      summary: {
        total: 4,
        needsHuman: 1,
        agentResolved: 3,
        invalidCount: 0,
        invalid: 0,
        exists: true,
        missing: false,
        unparseable: false,
        changeExists: true,
        blocking: true,
      },
    },
    tasks: { done: 4, total: 12, waves: 3 },
    decision: "none",
    blocking: true,
    ...over,
  };
}

describe("ChangeCard", () => {
  it("shows name, ledger status, tasks with denominator and waves", () => {
    render(<ul><ChangeCard entry={entry()} refName="main" /></ul>);
    expect(screen.getByRole("heading", { level: 2 }).textContent).toBe("add-user-auth");
    expect(screen.getByText("1 needs you")).toBeTruthy();
    expect(byFullText("4 of 12 tasks · 3 waves")).toBeTruthy();
    expect(screen.queryByText("approved")).toBeNull();
    expect(screen.getByRole("link").getAttribute("href")).toBe("/changes/add-user-auth?ref=main");
    expect(screen.getByRole("link").className).toContain("card-blocking");
  });

  it("shows the decision state and drops the blocking mark when clear", () => {
    render(
      <ul>
        <ChangeCard
          entry={entry({
            name: "add-report-flag",
            ledger: { status: "clear", statusText: "clear", summary: { ...entry().ledger.summary, needsHuman: 0, blocking: false } },
            tasks: { done: 5, total: 5, waves: 2 },
            decision: "approved",
            blocking: false,
          })}
          refName="feat/auth"
        />
      </ul>,
    );
    expect(screen.getByText("clear")).toBeTruthy();
    expect(screen.getByText("approved")).toBeTruthy();
    expect(screen.getByRole("link").className).not.toContain("card-blocking");
    expect(screen.getByRole("link").getAttribute("href")).toBe("/changes/add-report-flag?ref=feat%2Fauth");
  });

  it("shows a missing ledger as text", () => {
    render(
      <ul>
        <ChangeCard
          entry={entry({ ledger: { status: "missing", statusText: "ledger missing", summary: { ...entry().ledger.summary, missing: true } } })}
          refName="main"
        />
      </ul>,
    );
    expect(screen.getByText("ledger missing")).toBeTruthy();
  });
});
