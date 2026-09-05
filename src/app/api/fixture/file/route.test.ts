// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { resetEnvCache } from "@/lib/env";
import { resetHost } from "@/lib/githost";
import { GET } from "./route";

const BASE = "http://localhost/api/fixture/file";

beforeEach(() => {
  resetEnvCache();
  resetHost();
});
afterEach(() => {
  vi.unstubAllEnvs();
  resetEnvCache();
  resetHost();
});

describe("GET /api/fixture/file", () => {
  it("is a 404 when the git host is GitHub", async () => {
    vi.stubEnv("CHECKPOINT_GIT_HOST", "github");
    vi.stubEnv("CHECKPOINT_REPO", "owner/name");
    vi.stubEnv("CHECKPOINT_GITHUB_TOKEN", "ghp_test");
    const res = await GET(new NextRequest(`${BASE}?path=openspec/changes/add-user-auth/decisions.md&ref=main`));
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "not found" });
  });

  it("returns the file with its blob SHA on the fixture host", async () => {
    vi.stubEnv("CHECKPOINT_GIT_HOST", "fixture");
    vi.stubEnv("CHECKPOINT_FIXTURE_DIR", "fixtures/repo");
    const res = await GET(new NextRequest(`${BASE}?path=openspec/changes/add-user-auth/decisions.md&ref=main`));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ref).toBe("main");
    expect(body.sha).toMatch(/^[0-9a-f]{40}$/);
    expect(body.text).toContain("# Decisions — add-user-auth");
  });

  it("is a 404 for a file the fixture does not hold", async () => {
    vi.stubEnv("CHECKPOINT_GIT_HOST", "fixture");
    vi.stubEnv("CHECKPOINT_FIXTURE_DIR", "fixtures/repo");
    const res = await GET(new NextRequest(`${BASE}?path=openspec/changes/nope/decisions.md`));
    expect(res.status).toBe(404);
  });
});
