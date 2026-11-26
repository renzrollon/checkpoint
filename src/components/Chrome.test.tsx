import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

let state: "valid" | "missing" = "valid";
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined }),
}));
vi.mock("@/lib/auth/session", () => ({
  SESSION_COOKIE: "checkpoint_session",
  configuredKey: () => "k",
  verifySession: () => state,
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

import { Chrome } from "./Chrome";
import NotFound from "@/app/not-found";

beforeEach(() => {
  state = "valid";
});

describe("Chrome", () => {
  it("encodes a canonical repository and a ref with a slash", async () => {
    render(
      await Chrome({ repo: "renzrollon/interlock", ref: "feature/phone" }),
    );
    expect(
      screen.getByRole("link", { name: "Checkpoint" }).getAttribute("href"),
    ).toBe("/?repo=renzrollon%2Finterlock&ref=feature%2Fphone");
  });

  it("links to a bare / with no props", async () => {
    render(await Chrome({}));
    expect(
      screen.getByRole("link", { name: "Checkpoint" }).getAttribute("href"),
    ).toBe("/");
  });

  it("renders Sign out", async () => {
    render(await Chrome({}));
    expect(screen.getByRole("button", { name: "Sign out" })).toBeTruthy();
  });

  it("renders nothing without a signed-in session", async () => {
    state = "missing";
    const { container } = render(await Chrome({}));
    expect(container.innerHTML).toBe("");
  });

  it("is rendered by not-found with a bare home link", async () => {
    render(await NotFound());
    expect(
      screen.getByRole("link", { name: "Checkpoint" }).getAttribute("href"),
    ).toBe("/");
    expect(screen.getByRole("button", { name: "Sign out" })).toBeTruthy();
  });
});
