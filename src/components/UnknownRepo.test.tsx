import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { UnknownRepo } from "./UnknownRepo";

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

describe("UnknownRepo", () => {
  it("names the requested repository and links each configured one", async () => {
    render(
      await UnknownRepo({
        requested: "someone/else",
        repos: ["renzrollon/interlock", "renzrollon/checkpoint"],
      }),
    );
    expect(
      screen.getByText("Checkpoint is not configured for someone/else"),
    ).toBeTruthy();
    expect(
      screen
        .getByRole("link", { name: "renzrollon/interlock" })
        .getAttribute("href"),
    ).toBe("/?repo=renzrollon%2Finterlock");
    expect(
      screen
        .getByRole("link", { name: "renzrollon/checkpoint" })
        .getAttribute("href"),
    ).toBe("/?repo=renzrollon%2Fcheckpoint");
  });
});
