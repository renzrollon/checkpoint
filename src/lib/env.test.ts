import { describe, expect, it } from "vitest";
import { EnvError, parseEnv } from "./env";

describe("parseEnv", () => {
  it("fails naming the missing variable", () => {
    expect(() =>
      parseEnv({ CHECKPOINT_GIT_HOST: "github", CHECKPOINT_REPO: "o/r" }),
    ).toThrow(/CHECKPOINT_GITHUB_TOKEN/);
  });

  it("reports every missing variable by name", () => {
    let caught: unknown;
    try {
      parseEnv({ CHECKPOINT_GIT_HOST: "github" });
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(EnvError);
    expect((caught as EnvError).missing).toEqual(
      expect.arrayContaining(["CHECKPOINT_REPO", "CHECKPOINT_GITHUB_TOKEN"]),
    );
  });

  it("never echoes the token in the error", () => {
    let message = "";
    try {
      parseEnv({ CHECKPOINT_GIT_HOST: "github", CHECKPOINT_GITHUB_TOKEN: "ghp_secret" });
    } catch (e) {
      message = (e as Error).message;
    }
    expect(message).toMatch(/CHECKPOINT_REPO/);
    expect(message).not.toContain("ghp_secret");
  });

  it("accepts a github configuration", () => {
    const env = parseEnv({
      CHECKPOINT_GIT_HOST: "github",
      CHECKPOINT_REPO: "renzrollon/specflow",
      CHECKPOINT_GITHUB_TOKEN: "t",
      CHECKPOINT_ACCESS_KEY: "k",
    });
    expect(env.CHECKPOINT_GIT_HOST).toBe("github");
    expect(env.CHECKPOINT_ACCESS_KEY).toBe("k");
  });

  it("defaults to github when the host is unset", () => {
    expect(() => parseEnv({})).toThrow(/CHECKPOINT_GITHUB_TOKEN/);
  });

  it("rejects an unknown host by name", () => {
    expect(() => parseEnv({ CHECKPOINT_GIT_HOST: "gitlab" })).toThrow(/CHECKPOINT_GIT_HOST/);
  });

  it("fixture mode needs no token and defaults the fixture directory", () => {
    const env = parseEnv({ CHECKPOINT_GIT_HOST: "fixture" });
    expect(env.CHECKPOINT_GIT_HOST).toBe("fixture");
    expect(env.CHECKPOINT_FIXTURE_DIR).toBe("fixtures/repo");
    expect(env.CHECKPOINT_ACCESS_KEY).toBeUndefined();
  });

  it("treats a blank access key as absent", () => {
    const env = parseEnv({ CHECKPOINT_GIT_HOST: "fixture", CHECKPOINT_ACCESS_KEY: "   " });
    expect(env.CHECKPOINT_ACCESS_KEY).toBeUndefined();
  });
});
