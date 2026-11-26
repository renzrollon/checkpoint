// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetEnvCache } from "@/lib/env";
import { getFixtureHost, getHost, resetHost } from "./index";

const A = "renzrollon/interlock";
const B = "renzrollon/specflow";

function reset() {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  resetEnvCache();
  resetHost();
}

function stubGithub(repos: string) {
  vi.stubEnv("CHECKPOINT_GIT_HOST", "github");
  vi.stubEnv("CHECKPOINT_REPOS", repos);
  vi.stubEnv("CHECKPOINT_GITHUB_TOKEN", "ghp_test");
}

beforeEach(reset);
afterEach(reset);

describe("getHost (one host per configured repository)", () => {
  it("creates a distinct host per repository and reuses each on later calls", () => {
    stubGithub(`${A},${B}`);
    const a = getHost(A);
    const b = getHost(B);
    expect(a).not.toBe(b);
    expect(getHost(A)).toBe(a);
    expect(getHost(B)).toBe(b);
  });

  it("reads each host's own repository", async () => {
    stubGithub(`${A},${B}`);
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ default_branch: "main" }), { status: 200, headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);
    const urls = () => (fetchMock.mock.calls as unknown as [RequestInfo | URL][]).map((c) => String(c[0]));
    await getHost(A).resolveRef().catch(() => undefined);
    const afterA = urls();
    expect(afterA.length).toBeGreaterThan(0);
    expect(afterA.every((u) => u.includes(`/repos/${A}`))).toBe(true);
    await getHost(B).resolveRef().catch(() => undefined);
    const forB = urls().slice(afterA.length);
    expect(forB.length).toBeGreaterThan(0);
    expect(forB.every((u) => u.includes(`/repos/${B}`))).toBe(true);
  });

  it("treats an omitted repository as the default, the first configured", () => {
    stubGithub(`${A},${B}`);
    expect(getHost()).toBe(getHost(A));
  });

  it("throws for an unlisted repository and makes no GitHub request", () => {
    stubGithub(`${A},${B}`);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    expect(() => getHost("someone/else")).toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not match a repository by a different case", () => {
    stubGithub(A);
    expect(() => getHost(A.toUpperCase())).toThrow();
  });

  it("resetHost forgets every host", () => {
    stubGithub(`${A},${B}`);
    const a = getHost(A);
    resetHost();
    expect(getHost(A)).not.toBe(a);
  });
});

describe("fixture mode", () => {
  beforeEach(() => {
    vi.stubEnv("CHECKPOINT_GIT_HOST", "fixture");
  });

  it("creates the fixture host once for the single fixture repository", () => {
    const host = getHost();
    expect(host.name).toBe("fixture");
    expect(getHost("fixture/repo")).toBe(host);
    expect(getFixtureHost()).toBe(host);
  });

  it("serves the first configured name", () => {
    vi.stubEnv("CHECKPOINT_REPOS", A);
    expect(getHost(A)).toBe(getHost());
    expect(() => getHost("fixture/repo")).toThrow();
  });

  it("getFixtureHost is null on the GitHub host", () => {
    stubGithub(A);
    expect(getFixtureHost()).toBeNull();
  });
});
