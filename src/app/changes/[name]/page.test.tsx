import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createFixtureHost } from "@/lib/githost/fixture";
import type { GitHost } from "@/lib/githost/types";
import { FIXTURE_DIR, failingHost } from "@/test/repo";
import ChangePage from "./page";

let current: GitHost = createFixtureHost({ dir: FIXTURE_DIR });
vi.mock("@/lib/githost", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/githost")>();
  return { ...original, getHost: () => current };
});
vi.mock("./actions", () => ({
  answerRowAction: vi.fn(),
  decideAction: vi.fn(),
}));

afterEach(() => {
  current = createFixtureHost({ dir: FIXTURE_DIR });
});

async function renderPage(name: string, search: Record<string, string> = {}) {
  const ui = await ChangePage({ params: Promise.resolve({ name }), searchParams: Promise.resolve(search) });
  return render(ui);
}

describe("change page", () => {
  it("renders the header, the five tabs and the ledger for a fixture change", async () => {
    await renderPage("add-user-auth", { ref: "main" });
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("add-user-auth");
    expect(screen.getAllByRole("tab").map((t) => t.textContent)).toEqual(["Proposal", "Design", "Tasks", "Specs", "Ledger"]);
    expect(screen.getByText("1 needs you, 3 resolved, 0 invalid, of 4 rows")).toBeTruthy();
    expect(screen.getByText("risk medium")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Approve" }).getAttribute("aria-disabled")).toBe("true");
    expect(screen.getAllByText("1 decision still needs you").length).toBeGreaterThan(0);
  });

  it("names an unknown change on the ref and links to the inbox", async () => {
    await renderPage("no-such-change", { ref: "main" });
    expect(screen.getByText("No change named no-such-change on main")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Back to the inbox" }).getAttribute("href")).toBe("/?ref=main");
    expect(screen.queryAllByRole("tab")).toHaveLength(0);
  });

  it("names a forbidden failure with its retry time and offers a retry", async () => {
    current = failingHost({ kind: "forbidden", message: "rate limited", retryAt: "2026-09-05T12:34:00Z" });
    await renderPage("add-user-auth", { ref: "main" });
    expect(screen.getByText("GitHub refused (forbidden), retry after 12:34 UTC")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Retry" })).toBeTruthy();
    expect(screen.queryAllByRole("tab")).toHaveLength(0);
  });
});
