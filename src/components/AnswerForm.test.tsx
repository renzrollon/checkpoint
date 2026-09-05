import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { LedgerRow } from "@/lib/ledger/ledger";
import { AnswerForm } from "./AnswerForm";

const ROW: LedgerRow = {
  id: "D1",
  question: "How is the app gated: a session cookie, Vercel Deployment Protection, or Cloudflare Access?",
  class: "needs_human",
  resolution: "",
  evidence: "",
  line: 5,
  raw: "| D1 | ... |",
  valid: true,
  problems: [],
};

function renderForm(over: Partial<Parameters<typeof AnswerForm>[0]> = {}) {
  const submit = vi.fn(async () => ({ ok: false as const, reason: "not_found" as const, message: "no" }));
  const onResult = vi.fn();
  render(<AnswerForm row={ROW} refName="main" change="add-user-auth" baseSha="abc123" submit={submit} onResult={onResult} {...over} />);
  return { submit, onResult };
}

describe("AnswerForm", () => {
  it("refuses a blank answer and sends nothing", async () => {
    const user = userEvent.setup();
    const { submit } = renderForm();
    await user.type(screen.getByLabelText("Your answer"), "   ");
    await user.click(screen.getByRole("button", { name: "Answer" }));
    expect(screen.getByRole("alert").textContent).toBe("An answer is required");
    expect(submit).not.toHaveBeenCalled();
  });

  it("offers one-tap options parsed from the question and fills the field on tap", async () => {
    const user = userEvent.setup();
    renderForm();
    const chips = screen.getAllByRole("button", { pressed: false });
    expect(chips.map((c) => c.textContent)).toEqual(["a session cookie", "Vercel Deployment Protection", "Cloudflare Access"]);
    await user.click(screen.getByRole("button", { name: "Cloudflare Access" }));
    expect((screen.getByLabelText("Your answer") as HTMLInputElement).value).toBe("Cloudflare Access");
    expect(screen.getByRole("button", { name: "Cloudflare Access" }).getAttribute("aria-pressed")).toBe("true");
  });

  it("offers no chips when the question has no candidates and still accepts free text", async () => {
    const user = userEvent.setup();
    const { submit, onResult } = renderForm({ row: { ...ROW, question: "Which cookie name?" } });
    expect(screen.queryAllByRole("button", { pressed: false })).toHaveLength(0);
    await user.type(screen.getByLabelText("Your answer"), "  cp_session  ");
    await user.click(screen.getByRole("button", { name: "Answer" }));
    expect(submit).toHaveBeenCalledWith({ ref: "main", change: "add-user-auth", id: "D1", answer: "cp_session", baseSha: "abc123" });
    expect(onResult).toHaveBeenCalled();
  });

  it("submits the shown baseSha with the chosen option", async () => {
    const user = userEvent.setup();
    const { submit } = renderForm({ baseSha: "deadbeef" });
    await user.click(screen.getByRole("button", { name: "a session cookie" }));
    await user.click(screen.getByRole("button", { name: "Answer" }));
    expect(submit).toHaveBeenCalledWith(expect.objectContaining({ answer: "a session cookie", baseSha: "deadbeef" }));
  });
});
