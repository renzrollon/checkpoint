import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  verify: vi.fn(),
  getHost: vi.fn(),
  getEnv: vi.fn(),
  answerRow: vi.fn(),
  decide: vi.fn(),
}));

vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => ({ value: "v" }) }) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({
  SESSION_COOKIE: "s",
  configuredKey: () => "k",
  verifySession: mocks.verify,
}));
vi.mock("@/lib/githost", () => ({ getHost: mocks.getHost }));
vi.mock("@/lib/change/actions", () => ({ answerRow: mocks.answerRow, decide: mocks.decide }));
vi.mock("@/lib/env", async (orig) => ({ ...(await orig<typeof import("@/lib/env")>()), getEnv: mocks.getEnv }));

import { EnvError } from "@/lib/env";
import { answerRowAction, decideAction } from "./actions";

const answerInput = { repo: "renzrollon/interlock", headSha: "h0", ref: "main", change: "c", id: "Q1", answer: "yes", baseSha: null };
const decideInput = { repo: "renzrollon/interlock", ref: "main", change: "c", state: "approved" as const, baseSha: null, headSha: "h" };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.verify.mockReturnValue("valid");
  mocks.getEnv.mockReturnValue({ CHECKPOINT_REPOS: ["renzrollon/interlock", "a/b"] });
  mocks.getHost.mockReturnValue({ id: "host" });
  mocks.answerRow.mockResolvedValue({ ok: true });
  mocks.decide.mockResolvedValue({ ok: true });
});

describe("repo re-validation", () => {
  it("refuses an unauthenticated request before resolving", async () => {
    mocks.verify.mockReturnValue("invalid");
    expect(await decideAction(decideInput)).toMatchObject({ reason: "unauthenticated" });
    expect(mocks.getEnv).not.toHaveBeenCalled();
  });

  it("refuses an unlisted repo without writing", async () => {
    const a = await answerRowAction({ ...answerInput, repo: "someone/else" });
    const d = await decideAction({ ...decideInput, repo: "someone/else" });
    expect(a).toMatchObject({ ok: false, reason: "unknown_repo" });
    expect(d).toMatchObject({ ok: false, reason: "unknown_repo" });
    expect(mocks.getHost).not.toHaveBeenCalled();
    expect(mocks.answerRow).not.toHaveBeenCalled();
    expect(mocks.decide).not.toHaveBeenCalled();
  });

  it("answers config with variable names only when the env is broken", async () => {
    mocks.getEnv.mockImplementation(() => {
      throw new EnvError(["CHECKPOINT_REPOS"], "secret-value-detail");
    });
    const d = await decideAction(decideInput);
    expect(d).toMatchObject({ ok: false, reason: "config", missing: ["CHECKPOINT_REPOS"] });
    expect(JSON.stringify(d)).not.toContain("secret-value-detail");
    expect(mocks.decide).not.toHaveBeenCalled();
  });

  it("writes through the canonical repo host", async () => {
    await decideAction({ ...decideInput, repo: "RENZROLLON/interlock" });
    expect(mocks.getHost).toHaveBeenCalledWith("renzrollon/interlock");
    expect(mocks.decide.mock.calls[0][1]).not.toHaveProperty("repo");
  });

  it("passes headSha to answerRow", async () => {
    await answerRowAction({ ...answerInput, headSha: "h1" });
    expect(mocks.getHost).toHaveBeenCalledWith("renzrollon/interlock");
    expect(mocks.answerRow.mock.calls[0][1]).toMatchObject({ headSha: "h1" });
  });
});
