import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { DecisionView } from "@/lib/checkpoint/checkpoint";
import { DecisionBar } from "./DecisionBar";

const HEAD = "89abcdef".padEnd(40, "0");
const OLD = "0123456789abcdef0123456789abcdef01234567";

function approved(
  over: Partial<Exclude<DecisionView, { state: "none" }>> = {},
): DecisionView {
  return {
    state: "approved",
    note: "",
    decidedAt: "2026-09-04T19:30:00Z",
    decidedBy: "checkpoint",
    headSha: HEAD,
    currentHeadSha: HEAD,
    stale: false,
    ...over,
  };
}

function renderBar(over: Partial<Parameters<typeof DecisionBar>[0]> = {}) {
  const submit = vi.fn(async () => ({
    ok: false as const,
    reason: "checkpoint_unreadable" as const,
    message: "unreadable",
  }));
  render(
    <DecisionBar
      repo="renzrollon/interlock"
      refName="main"
      change="add-user-auth"
      headSha={HEAD}
      decision={{ state: "none" }}
      blockingReason={null}
      baseSha="cp1"
      submit={submit}
      {...over}
    />,
  );
  return { submit };
}

const approveButton = () => screen.getByRole("button", { name: "Approve" });
const sendBackButtons = () =>
  screen.getAllByRole("button", { name: "Send back" });

describe("DecisionBar", () => {
  it("blocks Approve with the needs_human reason and leaves Send back enabled", async () => {
    const user = userEvent.setup();
    const { submit } = renderBar({
      blockingReason: "1 decision still needs you",
    });
    expect(approveButton().getAttribute("aria-disabled")).toBe("true");
    expect(screen.getByText("1 decision still needs you")).toBeTruthy();
    await user.click(approveButton());
    expect(submit).not.toHaveBeenCalled();
    expect(sendBackButtons()[0].hasAttribute("disabled")).toBe(false);
    expect(sendBackButtons()[0].getAttribute("aria-disabled")).toBeNull();
  });

  it("blocks Approve when the ledger is missing", () => {
    renderBar({
      blockingReason:
        "decisions.md is missing; the laptop side would refuse this",
    });
    expect(approveButton().getAttribute("aria-disabled")).toBe("true");
    expect(
      screen.getByText(
        "decisions.md is missing; the laptop side would refuse this",
      ),
    ).toBeTruthy();
  });

  it("requires a note to send back and writes nothing without one", async () => {
    const user = userEvent.setup();
    const { submit } = renderBar();
    await user.click(sendBackButtons()[0]);
    expect(screen.getByLabelText("Note")).toBeTruthy();
    await user.click(sendBackButtons()[1]);
    expect(screen.getByRole("alert").textContent).toBe(
      "Say what should change",
    );
    expect(submit).not.toHaveBeenCalled();
    await user.type(screen.getByLabelText("Note"), "Split the auth change out");
    await user.click(sendBackButtons()[1]);
    expect(submit).toHaveBeenCalledWith({
      repo: "renzrollon/interlock",
      ref: "main",
      change: "add-user-auth",
      state: "returned",
      note: "Split the auth change out",
      baseSha: "cp1",
      headSha: HEAD,
    });
  });

  it("names a stale approval after the branch moved and offers Approve again", async () => {
    const user = userEvent.setup();
    const submit = vi.fn(async () => ({
      ok: true as const,
      decision: approved(),
      checkpoint: {
        schema: "interlock.checkpoint/1" as const,
        change: "add-user-auth",
      },
      sha: "cp2",
      commitSha: "c0ffee",
      headSha: HEAD,
    }));
    renderBar({ decision: approved({ headSha: OLD, stale: true }), submit });
    expect(
      screen.getByText("approved at 0123456, branch has moved to 89abcde"),
    ).toBeTruthy();
    expect(approveButton().getAttribute("aria-disabled")).toBeNull();
    await user.click(approveButton());
    expect(submit).toHaveBeenCalledWith({
      repo: "renzrollon/interlock",
      ref: "main",
      change: "add-user-auth",
      state: "approved",
      baseSha: "cp1",
      headSha: HEAD,
    });
    expect(screen.getByRole("status").textContent).toBe(
      "Approved and committed to main",
    );
    expect(document.activeElement).toBe(screen.getByRole("status"));
    expect(screen.queryByText(/branch has moved/)).toBeNull();
    expect(
      screen.getByText("approved · 2026-09-04 19:30 UTC · 89abcde"),
    ).toBeTruthy();
  });

  it("shows the conflict message with the fresh decision and uses the fresh SHAs next time", async () => {
    const user = userEvent.setup();
    const fresh = approved({
      headSha: OLD,
      currentHeadSha: HEAD,
      stale: true,
      note: "",
    });
    const submit = vi.fn(async () => ({
      ok: false as const,
      reason: "conflict" as const,
      message: "The decision file changed on main; reloaded",
      reloaded: {
        text: "{}",
        sha: "cp9",
        present: true,
        problem: null,
        decision: fresh,
        headSha: HEAD,
      },
    }));
    renderBar({ submit });
    await user.click(approveButton());
    expect(screen.getByRole("status").textContent).toBe(
      "The decision file changed on main; reloaded",
    );
    expect(document.activeElement).toBe(screen.getByRole("status"));
    expect(
      screen.getByText("approved at 0123456, branch has moved to 89abcde"),
    ).toBeTruthy();
    await user.click(approveButton());
    expect(submit).toHaveBeenLastCalledWith(
      expect.objectContaining({ baseSha: "cp9", headSha: HEAD }),
    );
  });

  it("refuses on a moved branch, offers Reload, keeps the note and the page head", async () => {
    const user = userEvent.setup();
    const reload = vi.fn();
    const original = window.location;
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { ...original, reload },
    });
    try {
      const submit = vi.fn(async () => ({
        ok: false as const,
        reason: "moved" as const,
        message: "server text",
      }));
      renderBar({ submit });
      await user.click(sendBackButtons()[0]);
      await user.type(screen.getByLabelText("Note"), "Split it");
      await user.click(sendBackButtons()[1]);
      expect(screen.getByRole("status").textContent).toBe(
        "The branch moved past 89abcde; reload to read it",
      );
      expect((screen.getByLabelText("Note") as HTMLTextAreaElement).value).toBe(
        "Split it",
      );
      await user.click(sendBackButtons()[1]);
      expect(submit).toHaveBeenCalledTimes(2);
      expect(submit.mock.calls[1]).toEqual(submit.mock.calls[0]);
      expect(submit).toHaveBeenLastCalledWith(
        expect.objectContaining({ headSha: HEAD, note: "Split it" }),
      );
      await user.click(screen.getByRole("button", { name: "Reload" }));
      expect(reload).toHaveBeenCalledTimes(1);
    } finally {
      Object.defineProperty(window, "location", {
        configurable: true,
        value: original,
      });
    }
  });

  it("shows the server refusal when an approve bypassed the control", async () => {
    const user = userEvent.setup();
    const submit = vi.fn(async () => ({
      ok: false as const,
      reason: "ledger_blocks" as const,
      message: "ledger blocks approval",
      detail: "1 decision still needs you",
    }));
    renderBar({ submit });
    await user.click(approveButton());
    expect(screen.getByRole("status").textContent).toBe(
      "ledger blocks approval: 1 decision still needs you",
    );
  });
});
