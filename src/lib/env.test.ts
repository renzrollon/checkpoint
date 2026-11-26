import { afterEach, describe, expect, it, vi } from "vitest";
import { EnvError, parseEnv } from "./env";

describe("parseEnv", () => {
  it("fails naming the missing variable", () => {
    expect(() =>
      parseEnv({ CHECKPOINT_GIT_HOST: "github", CHECKPOINT_REPOS: "o/r" }),
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
      expect.arrayContaining(["CHECKPOINT_REPOS", "CHECKPOINT_GITHUB_TOKEN"]),
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
      CHECKPOINT_REPOS: "renzrollon/specflow",
      CHECKPOINT_GITHUB_TOKEN: "t",
      CHECKPOINT_ACCESS_KEY: "k",
    });
    expect(env.CHECKPOINT_REPOS).toEqual(["renzrollon/specflow"]);
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

  describe("repository allowlist", () => {
    const base = { CHECKPOINT_GIT_HOST: "github", CHECKPOINT_GITHUB_TOKEN: "t" };
    const failure = (src: Record<string, string>) => {
      try {
        parseEnv(src);
      } catch (e) {
        return e as EnvError;
      }
      throw new Error("expected parseEnv to throw");
    };

    it("keeps order and takes the first as default", () => {
      const env = parseEnv({
        ...base,
        CHECKPOINT_REPOS: "renzrollon/interlock, renzrollon/checkpoint",
      });
      expect(env.CHECKPOINT_REPOS).toEqual(["renzrollon/interlock", "renzrollon/checkpoint"]);
    });

    it("reads CHECKPOINT_REPO alone as a one-entry list", () => {
      const env = parseEnv({ ...base, CHECKPOINT_REPO: "renzrollon/interlock" });
      expect(env.CHECKPOINT_REPOS).toEqual(["renzrollon/interlock"]);
    });

    it("fixture defaults to fixture/repo", () => {
      expect(parseEnv({ CHECKPOINT_GIT_HOST: "fixture" }).CHECKPOINT_REPOS).toEqual([
        "fixture/repo",
      ]);
    });

    it("rejects both variables, naming both", () => {
      const e = failure({ ...base, CHECKPOINT_REPO: "a/b", CHECKPOINT_REPOS: "a/b" });
      expect(e.missing).toEqual(expect.arrayContaining(["CHECKPOINT_REPO", "CHECKPOINT_REPOS"]));
    });

    it("rejects a malformed entry without echoing it", () => {
      const e = failure({ ...base, CHECKPOINT_REPOS: "not-a-repo" });
      expect(e.missing).toContain("CHECKPOINT_REPOS");
      expect(e.message).not.toContain("not-a-repo");
    });

    it("rejects an empty entry in the list", () => {
      expect(failure({ ...base, CHECKPOINT_REPOS: "a/b,,c/d" }).missing).toContain(
        "CHECKPOINT_REPOS",
      );
    });

    it("rejects an empty list when no fallback is set", () => {
      expect(failure({ ...base, CHECKPOINT_REPOS: "  " }).missing).toContain("CHECKPOINT_REPOS");
    });

    it("rejects a case-insensitive duplicate", () => {
      const e = failure({ ...base, CHECKPOINT_REPOS: "renzrollon/interlock,RenzRollon/Interlock" });
      expect(e.missing).toContain("CHECKPOINT_REPOS");
    });

    it("rejects two repositories with the fixture adapter", () => {
      const e = failure({ CHECKPOINT_GIT_HOST: "fixture", CHECKPOINT_REPOS: "a/one,b/two" });
      expect(e.missing).toContain("CHECKPOINT_REPOS");
    });

    it("reports a repository problem together with a missing token", () => {
      const e = failure({ CHECKPOINT_GIT_HOST: "github", CHECKPOINT_REPOS: "bad" });
      expect(e.missing).toEqual(
        expect.arrayContaining(["CHECKPOINT_REPOS", "CHECKPOINT_GITHUB_TOKEN"]),
      );
    });
  });

  describe("production", () => {
    afterEach(() => vi.unstubAllEnvs());

    it("refuses the fixture adapter, naming CHECKPOINT_GIT_HOST", () => {
      vi.stubEnv("NODE_ENV", "production");
      let caught: unknown;
      try {
        parseEnv({ CHECKPOINT_GIT_HOST: "fixture" });
      } catch (e) {
        caught = e;
      }
      expect(caught).toBeInstanceOf(EnvError);
      expect((caught as EnvError).missing).toContain("CHECKPOINT_GIT_HOST");
    });

    it("still accepts the fixture adapter in development", () => {
      vi.stubEnv("NODE_ENV", "development");
      expect(parseEnv({ CHECKPOINT_GIT_HOST: "fixture" }).CHECKPOINT_GIT_HOST).toBe("fixture");
    });
  });
});
