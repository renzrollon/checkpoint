import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetHost } from "@/lib/githost";
import { resolvePageContext } from "./page-context";

const KEYS = ["CHECKPOINT_GIT_HOST", "CHECKPOINT_ACCESS_KEY", "CHECKPOINT_REPOS", "CHECKPOINT_REPO", "CHECKPOINT_GITHUB_TOKEN"];

describe("resolvePageContext", () => {
  beforeEach(() => {
    for (const k of KEYS) vi.stubEnv(k, "");
    vi.stubEnv("CHECKPOINT_GIT_HOST", "github");
    vi.stubEnv("CHECKPOINT_ACCESS_KEY", "k".repeat(32));
    vi.stubEnv("CHECKPOINT_REPOS", "renzrollon/interlock,renzrollon/checkpoint");
    vi.stubEnv("CHECKPOINT_GITHUB_TOKEN", "tok");
    resetHost();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    resetHost();
  });

  it("reports config with the missing names", () => {
    vi.stubEnv("CHECKPOINT_GITHUB_TOKEN", "");
    const ctx = resolvePageContext({});
    expect(ctx.kind).toBe("config");
    if (ctx.kind === "config") expect(ctx.missing).toContain("CHECKPOINT_GITHUB_TOKEN");
  });

  it("reports an unknown repository without creating a host", () => {
    expect(resolvePageContext({ repo: "someone/else" })).toEqual({
      kind: "unknown_repo",
      requested: "someone/else",
      repos: ["renzrollon/interlock", "renzrollon/checkpoint"],
    });
  });

  it("resolves the default repository and a trimmed ref", () => {
    const ctx = resolvePageContext({ ref: [" main ", "x"] });
    expect(ctx.kind).toBe("ok");
    if (ctx.kind === "ok") {
      expect(ctx.repo).toBe("renzrollon/interlock");
      expect(ctx.ref).toBe("main");
    }
  });

  it("canonicalizes the repo case and treats a blank ref as null", () => {
    const ctx = resolvePageContext({ repo: "RenzRollon/Checkpoint", ref: "  " });
    expect(ctx.kind).toBe("ok");
    if (ctx.kind === "ok") {
      expect(ctx.repo).toBe("renzrollon/checkpoint");
      expect(ctx.ref).toBeNull();
    }
  });
});
