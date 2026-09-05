import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { parseLedger, summarize, type LedgerRow } from "@/lib/ledger/ledger";
import { blockingReasonFor, ledgerStatusFrom } from "@/lib/change/load";
import type { AnswerResult } from "@/lib/change/actions";
import { LedgerPanel, type LedgerState } from "./LedgerPanel";

const BEFORE = `# Decisions — add-user-auth

| id | question | class | resolution | evidence |
|----|----------|-------|------------|----------|
| D1 | How is the app gated: a session cookie, Vercel Deployment Protection, or Cloudflare Access? | needs_human | — | — |
| D2 | Which cookie attributes does the session carry? | agent_resolved | httpOnly, Secure, SameSite=Lax, 30 days | design.md §D2 |
| D3 | Which cookie name is used? | agent_resolved | cp_session | see above |
`;

const AFTER = BEFORE.replace(
  "| D1 | How is the app gated: a session cookie, Vercel Deployment Protection, or Cloudflare Access? | needs_human | — | — |",
  "| D1 | How is the app gated: a session cookie, Vercel Deployment Protection, or Cloudflare Access? | agent_resolved | a session cookie | human decision 2026-09-05 via Checkpoint |",
);

const ELSEWHERE = BEFORE.replace("| D1 |", "| D1 |").replace(
  "| D3 | Which cookie name is used? | agent_resolved | cp_session | see above |",
  "| D3 | Which cookie name is used? | agent_resolved | cp_session | design.md §D3 |",
);

function state(text: string, sha: string): LedgerState {
  const parsed = parseLedger(text);
  const summary = summarize({ ...parsed, exists: true });
  return { ...ledgerStatusFrom(summary), rows: parsed.rows, summary, blockingReason: blockingReasonFor(summary), sha };
}

function okResult(text: string, sha: string): AnswerResult {
  const s = state(text, sha);
  const row = s.rows.find((r) => r.id === "D1") as LedgerRow;
  return { ok: true, row, text, sha, commitSha: "c0ffee", headSha: "89abcdef".padEnd(40, "0"), rows: s.rows, summary: s.summary, blockingReason: s.blockingReason };
}

function rowItem(id: string): HTMLElement {
  return screen.getByText(id, { selector: ".ledger-id" }).closest("li")!;
}

describe("LedgerPanel", () => {
  it("shows every row with its class as a word, problems on invalid rows, and the blocking reason", () => {
    render(<LedgerPanel refName="main" change="add-user-auth" ledger={state(BEFORE, "sha1")} submit={vi.fn()} />);
    expect(within(rowItem("D1")).getByText("needs you")).toBeTruthy();
    expect(within(rowItem("D2")).getByText("resolved")).toBeTruthy();
    expect(within(rowItem("D3")).getByText("invalid")).toBeTruthy();
    expect(within(rowItem("D3")).getByText(/agent_resolved without evidence/)).toBeTruthy();
    expect(screen.getByText("1 decision still needs you")).toBeTruthy();
    expect(within(rowItem("D1")).getByLabelText("Your answer")).toBeTruthy();
    expect(within(rowItem("D2")).queryByLabelText("Your answer")).toBeNull();
  });

  it("re-renders the answered row as resolved and moves focus to the result message", async () => {
    const user = userEvent.setup();
    const submit = vi.fn(async () => okResult(AFTER, "sha2"));
    const onLedgerChange = vi.fn();
    render(
      <LedgerPanel refName="main" change="add-user-auth" ledger={state(BEFORE, "sha1")} submit={submit} onLedgerChange={onLedgerChange} />,
    );
    await user.click(screen.getByRole("button", { name: "a session cookie" }));
    await user.click(screen.getByRole("button", { name: "Answer" }));
    expect(submit).toHaveBeenCalledWith(expect.objectContaining({ id: "D1", answer: "a session cookie", baseSha: "sha1" }));
    const d1 = rowItem("D1");
    expect(within(d1).getByText("resolved")).toBeTruthy();
    expect(within(d1).getByText("a session cookie")).toBeTruthy();
    expect(within(d1).getByText("human decision 2026-09-05 via Checkpoint")).toBeTruthy();
    expect(within(d1).queryByLabelText("Your answer")).toBeNull();
    const status = screen.getByRole("status");
    expect(status.textContent).toBe("D1 answered and committed to main");
    expect(document.activeElement).toBe(status);
    expect(onLedgerChange).toHaveBeenCalledWith(expect.objectContaining({ sha: "sha2" }), "89abcdef".padEnd(40, "0"));
  });

  it("shows the conflict message and the reloaded rows when the ledger moved", async () => {
    const user = userEvent.setup();
    const reloaded = state(ELSEWHERE, "sha9");
    const submit = vi.fn(async () => ({
      ok: false as const,
      reason: "conflict" as const,
      message: "The ledger changed on main since you opened it; reloaded",
      reloaded: { text: ELSEWHERE, sha: "sha9", rows: reloaded.rows, summary: reloaded.summary, statusText: reloaded.statusText, blockingReason: reloaded.blockingReason },
    }));
    render(<LedgerPanel refName="main" change="add-user-auth" ledger={state(BEFORE, "sha1")} submit={submit} />);
    await user.type(screen.getByLabelText("Your answer"), "a session cookie");
    await user.click(screen.getByRole("button", { name: "Answer" }));
    const status = screen.getByRole("status");
    expect(status.textContent).toBe("The ledger changed on main since you opened it; reloaded");
    expect(document.activeElement).toBe(status);
    expect(within(rowItem("D3")).getByText("resolved")).toBeTruthy();
    expect(within(rowItem("D3")).getByText("design.md §D3")).toBeTruthy();
    expect(within(rowItem("D1")).getByText("needs you")).toBeTruthy();
    // The next submit carries the reloaded SHA.
    await user.click(screen.getByRole("button", { name: "Answer" }));
    expect(submit).toHaveBeenLastCalledWith(expect.objectContaining({ baseSha: "sha9" }));
  });

  it("names a missing ledger instead of rendering rows", () => {
    const summary = summarize({ exists: false, parseable: false, rows: [], invalid: [] });
    render(
      <LedgerPanel
        refName="main"
        change="x"
        ledger={{ ...ledgerStatusFrom(summary), rows: [], summary, blockingReason: blockingReasonFor(summary), sha: null }}
        submit={vi.fn()}
      />,
    );
    expect(screen.getByText("ledger missing")).toBeTruthy();
    expect(screen.getByText("decisions.md is missing; the laptop side would refuse this")).toBeTruthy();
  });
});
