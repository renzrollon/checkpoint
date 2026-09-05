import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import type { Artifact, SpecFile } from "@/lib/change/load";
import { ArtifactTabs } from "./ArtifactTabs";

function artifact(file: string, text: string | null): Artifact {
  return text === null ? { file, text: null, sha: null, missing: true } : { file, text, sha: "abc", missing: false };
}

const artifacts = {
  proposal: artifact("proposal.md", "# Proposal\n\nWhy this change."),
  design: artifact("design.md", "# Design\n\n<script>alert(1)</script>"),
  tasks: artifact("tasks.md", "## 1. Foundation\n\n- [x] 1.1 done\n- [ ] 1.2 open"),
};

const specs: SpecFile[] = [
  { path: "access-gate/spec.md", text: "## Purpose\n\nGate." },
  { path: "change-inbox/spec.md", text: "## Purpose\n\nInbox." },
];

function renderTabs(over: Partial<Parameters<typeof ArtifactTabs>[0]> = {}) {
  return render(
    <ArtifactTabs refName="feat/auth" artifacts={artifacts} specs={specs} ledger={<p>ledger panel</p>} {...over} />,
  );
}

function panel(id: string): HTMLElement {
  return document.getElementById(`panel-${id}`)!;
}

afterEach(() => {
  window.history.replaceState(null, "", window.location.pathname);
});

describe("ArtifactTabs", () => {
  it("renders the five tabs in order with Proposal active and its markdown shown", () => {
    renderTabs();
    const tabs = screen.getAllByRole("tab");
    expect(tabs.map((t) => t.textContent)).toEqual(["Proposal", "Design", "Tasks", "Specs", "Ledger"]);
    expect(tabs[0].getAttribute("aria-selected")).toBe("true");
    expect(tabs.filter((t) => t.getAttribute("tabindex") === "0")).toHaveLength(1);
    expect(panel("proposal").hidden).toBe(false);
    expect(panel("design").hidden).toBe(true);
    expect(screen.getByRole("heading", { name: "Proposal" })).toBeTruthy();
  });

  it("escapes raw HTML in an artifact", () => {
    renderTabs();
    expect(panel("design").textContent).toContain("<script>alert(1)</script>");
    expect(document.querySelector("script")).toBeNull();
  });

  it("says when design.md is missing on the ref and renders the other tabs normally", () => {
    renderTabs({ artifacts: { ...artifacts, design: artifact("design.md", null) } });
    expect(screen.getByText("design.md is missing on feat/auth")).toBeTruthy();
    expect(panel("proposal").textContent).toContain("Why this change.");
    expect(panel("tasks").textContent).toContain("1.1 done");
  });

  it("renders every delta spec under its capability path", () => {
    renderTabs();
    const headings = Array.from(panel("specs").querySelectorAll("h2.spec-path")).map((h) => h.textContent);
    expect(headings).toEqual(["access-gate/spec.md", "change-inbox/spec.md"]);
    expect(panel("specs").textContent).toContain("Gate.");
    expect(panel("specs").textContent).toContain("Inbox.");
  });

  it("switches tabs on click and writes the active tab to the URL hash", async () => {
    const user = userEvent.setup();
    renderTabs();
    await user.click(screen.getByRole("tab", { name: "Ledger" }));
    expect(window.location.hash).toBe("#ledger");
    expect(panel("ledger").hidden).toBe(false);
    expect(panel("ledger").textContent).toContain("ledger panel");
    expect(screen.getByRole("tab", { name: "Ledger" }).getAttribute("aria-selected")).toBe("true");
  });

  it("opens the tab named in the URL hash", () => {
    window.location.hash = "#tasks";
    renderTabs();
    expect(screen.getByRole("tab", { name: "Tasks" }).getAttribute("aria-selected")).toBe("true");
    expect(panel("tasks").hidden).toBe(false);
  });

  it("moves between tabs with the arrow keys and wraps", async () => {
    const user = userEvent.setup();
    renderTabs();
    screen.getByRole("tab", { name: "Proposal" }).focus();
    await user.keyboard("{ArrowRight}");
    expect(document.activeElement?.textContent).toBe("Design");
    expect(screen.getByRole("tab", { name: "Design" }).getAttribute("aria-selected")).toBe("true");
    await user.keyboard("{ArrowLeft}{ArrowLeft}");
    expect(document.activeElement?.textContent).toBe("Ledger");
    expect(window.location.hash).toBe("#ledger");
  });
});
