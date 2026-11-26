import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createFixtureHost } from "@/lib/githost/fixture";
import type { GitHost } from "@/lib/githost/types";
import { FIXTURE_DIR, failingHost } from "@/test/repo";
import type { PageContext } from "@/lib/page-context";
import ChangePage from "./page";

let current: GitHost = createFixtureHost({ dir: FIXTURE_DIR });
let repos: string[] = ["renzrollon/interlock"];
let override: PageContext | null = null;
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => ({ value: "v" }) }) }));
vi.mock("@/lib/auth/session", () => ({
  SESSION_COOKIE: "checkpoint_session",
  configuredKey: () => "k",
  verifySession: () => "valid",
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
vi.mock("@/lib/page-context", () => ({
  resolvePageContext: (search: Record<string, string | string[] | undefined>): PageContext => {
    if (override) return override;
    const ref = typeof search.ref === "string" && search.ref.trim() ? search.ref.trim() : null;
    const asked = typeof search.repo === "string" ? search.repo.toLowerCase() : repos[0];
    const repo = repos.find((r) => r.toLowerCase() === asked);
    if (!repo) return { kind: "unknown_repo", requested: String(search.repo), repos };
    return { kind: "ok", repo, repos, host: current, ref };
  },
}));
vi.mock("./actions", () => ({
  answerRowAction: vi.fn(),
  decideAction: vi.fn(),
}));

afterEach(() => {
  current = createFixtureHost({ dir: FIXTURE_DIR });
  repos = ["renzrollon/interlock"];
  override = null;
});

async function renderPage(name: string, search: Record<string, string> = {}) {
  const ui = await ChangePage({ params: Promise.resolve({ name }), searchParams: Promise.resolve(search) });
  return render(ui);
}

describe("change page", () => {
  it("keeps the home link on the canonical repository for a differently cased request", async () => {
    await renderPage("add-user-auth", { repo: "RENZROLLON/Interlock", ref: "main" });
    const home = screen.getByRole("link", { name: "Checkpoint" });
    expect(home.getAttribute("href")).toBe("/?repo=renzrollon%2Finterlock&ref=main");
    expect(screen.getByRole("button", { name: "Sign out" })).toBeTruthy();
  });

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
    expect(screen.getByRole("link", { name: "Back to the inbox" }).getAttribute("href")).toBe(
      "/?repo=renzrollon%2Finterlock&ref=main",
    );
    expect(screen.queryAllByRole("tab")).toHaveLength(0);
  });

  it("names the repository of an unknown change when several are configured", async () => {
    repos = ["renzrollon/checkpoint", "renzrollon/interlock"];
    await renderPage("no-such-change", { repo: "renzrollon/interlock", ref: "main" });
    expect(screen.getByText("No change named no-such-change on main in renzrollon/interlock")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Back to the inbox" }).getAttribute("href")).toBe(
      "/?repo=renzrollon%2Finterlock&ref=main",
    );
  });

  it("shows the repository and an Inbox link in the header when several are configured", async () => {
    repos = ["renzrollon/checkpoint", "renzrollon/interlock"];
    await renderPage("add-user-auth", { repo: "renzrollon/checkpoint", ref: "main" });
    expect(screen.getByText("renzrollon/checkpoint")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Inbox" }).getAttribute("href")).toBe("/?repo=renzrollon%2Fcheckpoint&ref=main");
  });

  it("shows no repository in the header with one configured", async () => {
    await renderPage("add-user-auth", { ref: "main" });
    expect(screen.queryByText("renzrollon/interlock")).toBeNull();
  });

  it("speaks a configuration error and an unknown repository", async () => {
    override = { kind: "config", missing: ["CHECKPOINT_REPOS"] };
    await renderPage("add-user-auth");
    expect(screen.getByText("Checkpoint is not configured")).toBeTruthy();
    override = null;
    cleanup();
    await renderPage("add-user-auth", { repo: "someone/else" });
    expect(screen.getByText("Checkpoint is not configured for someone/else")).toBeTruthy();
  });

  it("names a forbidden failure with its retry time and offers a retry", async () => {
    current = failingHost({ kind: "forbidden", message: "rate limited", retryAt: "2026-09-05T12:34:00Z" });
    await renderPage("add-user-auth", { ref: "main" });
    expect(screen.getByText("GitHub refused (forbidden), retry after 12:34 UTC")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Retry" })).toBeTruthy();
    expect(screen.queryAllByRole("tab")).toHaveLength(0);
  });
});
