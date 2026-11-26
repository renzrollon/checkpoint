import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createFixtureHost } from "@/lib/githost/fixture";
import type { GitHost } from "@/lib/githost/types";
import {
  FIXTURE_DIR,
  failingHost,
  removeRepo,
  tempRepo,
  writeChange,
} from "@/test/repo";
import { byFullText } from "@/test/dom";
import type { PageContext } from "@/lib/page-context";
import InboxPage from "./page";

let current: GitHost = createFixtureHost({ dir: FIXTURE_DIR });
let repos: string[] = ["renzrollon/interlock"];
let override: PageContext | null = null;
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => ({ value: "v" }) }),
}));
vi.mock("@/lib/auth/session", () => ({
  SESSION_COOKIE: "checkpoint_session",
  configuredKey: () => "k",
  verifySession: () => "valid",
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));
vi.mock("@/lib/page-context", () => ({
  resolvePageContext: (
    search: Record<string, string | string[] | undefined>,
  ): PageContext => {
    if (override) return override;
    const ref =
      typeof search.ref === "string" && search.ref.trim()
        ? search.ref.trim()
        : null;
    return { kind: "ok", repo: repos[0], repos, host: current, ref };
  },
}));

const temps: string[] = [];
afterEach(() => {
  current = createFixtureHost({ dir: FIXTURE_DIR });
  repos = ["renzrollon/interlock"];
  override = null;
  for (const d of temps.splice(0)) removeRepo(d);
});

async function renderInbox(search: Record<string, string> = {}) {
  const ui = await InboxPage({ searchParams: Promise.resolve(search) });
  return render(ui);
}

describe("inbox page", () => {
  it("lists changes with ledger status, blocking first", async () => {
    await renderInbox({ ref: "main" });
    const names = screen
      .getAllByRole("heading", { level: 2 })
      .map((h) => h.textContent);
    expect(names).toEqual(["add-user-auth", "add-report-flag"]);
    const links = screen.getAllByRole("link");
    const auth = links.find((l) => l.textContent?.includes("add-user-auth"))!;
    const flag = links.find((l) => l.textContent?.includes("add-report-flag"))!;
    expect(byFullText("1 needs you", auth)).toBeTruthy();
    expect(byFullText("4 of 12 tasks · 3 waves", auth)).toBeTruthy();
    expect(auth.getAttribute("href")).toBe(
      "/changes/add-user-auth?repo=renzrollon%2Finterlock&ref=main",
    );
    expect(byFullText("clear", flag)).toBeTruthy();
    expect(byFullText("approved", flag)).toBeTruthy();
    expect(byFullText("5 of 5 tasks · 2 waves", flag)).toBeTruthy();
  });

  it("shows a missing ledger as missing, sorted with the blocking changes", async () => {
    const dir = tempRepo((changes) => {
      writeChange(changes, "aaa-clear", {
        "decisions.md":
          "# Decisions — aaa-clear\n\n| id | question | class | resolution | evidence |\n|--|--|--|--|--|\n| D1 | q | agent_resolved | r | e |\n",
        "design.md": "## Decisions\n\n### D1. q\n",
        "tasks.md": "## 1. One\n\n- [x] 1.1 a\n",
      });
      writeChange(changes, "zzz-no-ledger", {
        "tasks.md": "## 1. One\n\n- [ ] 1.1 a\n",
      });
    });
    temps.push(dir);
    current = createFixtureHost({ dir });
    await renderInbox();
    const names = screen
      .getAllByRole("heading", { level: 2 })
      .map((h) => h.textContent);
    expect(names).toEqual(["zzz-no-ledger", "aaa-clear"]);
    expect(screen.getByText("ledger missing")).toBeTruthy();
  });

  it("reads the ref from the query parameter and shows it in the header", async () => {
    await renderInbox({ ref: "feat/auth" });
    expect(screen.getByText("feat/auth")).toBeTruthy();
    expect(
      screen
        .getAllByRole("link")
        .filter((l) => !l.classList.contains("chrome-home"))[0]
        .getAttribute("href"),
    ).toContain("ref=feat%2Fauth");
  });

  it("says when there are no active changes", async () => {
    const dir = tempRepo((changes) => {
      writeChange(changes, "archive/2026-01-01-old", {
        "proposal.md": "# old\n",
      });
    });
    temps.push(dir);
    current = createFixtureHost({ dir });
    await renderInbox();
    expect(screen.getByText("No active changes on main")).toBeTruthy();
    expect(
      screen
        .queryAllByRole("link")
        .filter((l) => !l.classList.contains("chrome-home")),
    ).toHaveLength(0);
  });

  it("names a host failure and offers a retry instead of an empty inbox", async () => {
    current = failingHost({
      kind: "unauthorized",
      message: "GitHub responded 401",
    });
    await renderInbox({ ref: "main" });
    expect(
      screen.getByText("GitHub rejected the token (unauthorized)"),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: "Retry" })).toBeTruthy();
    expect(screen.queryByText(/No active changes/)).toBeNull();
    expect(
      screen
        .queryAllByRole("link")
        .filter((l) => !l.classList.contains("chrome-home")),
    ).toHaveLength(0);
  });

  it("renders ConfigError naming the missing variables", async () => {
    override = { kind: "config", missing: ["CHECKPOINT_REPOS"] };
    await renderInbox();
    expect(screen.getByText(/CHECKPOINT_REPOS/)).toBeTruthy();
  });

  it("renders UnknownRepo with links to the configured repositories", async () => {
    override = {
      kind: "unknown_repo",
      requested: "evil/x",
      repos: ["a/b", "c/d"],
    };
    await renderInbox({ repo: "evil/x" });
    expect(screen.getByText(/evil\/x/)).toBeTruthy();
    expect(screen.getByRole("link", { name: "c/d" }).getAttribute("href")).toBe(
      "/?repo=c%2Fd",
    );
  });

  it("shows the repository and a picker only with several repositories", async () => {
    await renderInbox({ ref: "main" });
    expect(screen.queryByRole("navigation", { name: "Repository" })).toBeNull();
    cleanup();
    repos = ["renzrollon/interlock", "renzrollon/checkpoint"];
    await renderInbox({ ref: "main" });
    expect(screen.getByRole("navigation", { name: "Repository" })).toBeTruthy();
    expect(screen.getAllByText("renzrollon/interlock").length).toBeGreaterThan(
      0,
    );
  });
});
