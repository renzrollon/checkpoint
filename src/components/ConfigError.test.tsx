import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ConfigError } from "./ConfigError";

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

describe("ConfigError", () => {
  it("speaks the heading and names each variable", async () => {
    render(
      await ConfigError({
        missing: ["CHECKPOINT_GITHUB_TOKEN", "CHECKPOINT_REPOS"],
      }),
    );
    expect(screen.getByText("Checkpoint is not configured")).toBeTruthy();
    expect(screen.getByText("CHECKPOINT_GITHUB_TOKEN")).toBeTruthy();
    expect(screen.getByText("CHECKPOINT_REPOS")).toBeTruthy();
  });

  it("renders only the names, no values", async () => {
    render(await ConfigError({ missing: ["CHECKPOINT_REPOS"] }));
    expect(screen.getByRole("alert").textContent).toBe(
      "Checkpoint is not configuredCHECKPOINT_REPOS",
    );
  });

  it("renders the header bar with a bare home link", async () => {
    render(await ConfigError({ missing: ["CHECKPOINT_REPOS"] }));
    expect(
      screen.getByRole("link", { name: "Checkpoint" }).getAttribute("href"),
    ).toBe("/");
  });
});
