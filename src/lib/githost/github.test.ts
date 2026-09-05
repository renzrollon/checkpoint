import { describe, expect, it, vi } from "vitest";
import { HostError } from "./errors";
import { createGitHubHost } from "./github";

const TOKEN = "github_pat_SECRET_VALUE";
const REPO = "renzrollon/specflow";

type Call = { url: string; init: RequestInit };

function jsonResponse(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

function makeHost(responder: (call: Call, n: number) => Response | Promise<Response>) {
  const calls: Call[] = [];
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const call = { url: String(input), init: init ?? {} };
    calls.push(call);
    return responder(call, calls.length);
  });
  const host = createGitHubHost({ repo: REPO, token: TOKEN, fetch: fetchMock as unknown as typeof fetch });
  return { host, calls, fetchMock };
}

async function expectHostError(p: Promise<unknown>, kind: HostError["kind"]): Promise<HostError> {
  let caught: unknown;
  try {
    await p;
  } catch (e) {
    caught = e;
  }
  expect(caught).toBeInstanceOf(HostError);
  expect((caught as HostError).kind).toBe(kind);
  expect((caught as HostError).message).not.toContain(TOKEN);
  return caught as HostError;
}

const b64 = (s: string) => Buffer.from(s, "utf8").toString("base64");

describe("GitHub adapter", () => {
  it("sends the token as a bearer header and nowhere else", async () => {
    const { host, calls } = makeHost(() =>
      jsonResponse(200, { type: "file", sha: "abc", content: b64("hi"), encoding: "base64" }),
    );
    await host.readFile("openspec/changes/x/decisions.md", "main");
    const headers = calls[0].init.headers as Record<string, string>;
    expect(headers.Authorization).toBe(`Bearer ${TOKEN}`);
    expect(calls[0].url).not.toContain(TOKEN);
    expect(calls[0].url).toBe(
      "https://api.github.com/repos/renzrollon/specflow/contents/openspec/changes/x/decisions.md?ref=main",
    );
  });

  it("reads a file, decoding base64 with embedded newlines", async () => {
    const text = "# Decisions — x\n\n| id | question |\n";
    const wrapped = b64(text).replace(/(.{10})/g, "$1\n");
    const { host } = makeHost(() => jsonResponse(200, { type: "file", sha: "blob1", content: wrapped }));
    const file = await host.readFile("openspec/changes/x/decisions.md", "feat/auth");
    expect(file).toEqual({ path: "openspec/changes/x/decisions.md", ref: "feat/auth", text, sha: "blob1" });
  });

  it("encodes a ref with a slash in the query", async () => {
    const { host, calls } = makeHost(() => jsonResponse(200, { type: "file", sha: "s", content: b64("x") }));
    await host.readFile("a/b.md", "feat/auth");
    expect(calls[0].url).toMatch(/\?ref=feat%2Fauth$/);
  });

  it("401 is unauthorized", async () => {
    const { host } = makeHost(() => jsonResponse(401, { message: "Bad credentials" }));
    const err = await expectHostError(host.readFile("a.md", "main"), "unauthorized");
    expect(err.message).toBe("GitHub rejected the token");
  });

  it("403 with a rate-limit reset header is forbidden with retryAt", async () => {
    const reset = 1_800_000_000;
    const { host } = makeHost(() =>
      jsonResponse(403, { message: "rate limited" }, { "x-ratelimit-reset": String(reset) }),
    );
    const err = await expectHostError(host.readFile("a.md", "main"), "forbidden");
    expect(err.retryAt).toBe(new Date(reset * 1000).toISOString());
  });

  it("403 without a reset header is forbidden without retryAt", async () => {
    const { host } = makeHost(() => jsonResponse(403, { message: "Resource not accessible" }));
    const err = await expectHostError(host.readFile("a.md", "main"), "forbidden");
    expect(err.retryAt).toBeUndefined();
  });

  it("404 is not_found naming the path and ref", async () => {
    const { host } = makeHost(() => jsonResponse(404, { message: "Not Found" }));
    const err = await expectHostError(host.readFile("openspec/changes/x/design.md", "feat/a"), "not_found");
    expect(err.path).toBe("openspec/changes/x/design.md");
    expect(err.ref).toBe("feat/a");
  });

  it("409 and 422 on a write are conflicts", async () => {
    for (const status of [409, 422]) {
      const { host } = makeHost(() => jsonResponse(status, { message: "sha does not match" }));
      await expectHostError(
        host.writeFile({
          path: "openspec/changes/x/decisions.md",
          ref: "main",
          content: "x",
          message: "m",
          baseSha: "old",
        }),
        "conflict",
      );
    }
  });

  it("5xx is upstream", async () => {
    const { host } = makeHost(() => jsonResponse(502, { message: "bad gateway" }));
    await expectHostError(host.readFile("a.md", "main"), "upstream");
  });

  it("a network failure is upstream and never retried", async () => {
    const { host, fetchMock } = makeHost(() => {
      throw new Error(`ECONNRESET while sending ${TOKEN}`);
    });
    const err = await expectHostError(host.readFile("a.md", "main"), "upstream");
    expect(err.message).not.toContain(TOKEN);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("resolves the default branch from the repository endpoint when no ref is given", async () => {
    const { host, calls } = makeHost((call) => {
      if (call.url === "https://api.github.com/repos/renzrollon/specflow") {
        return jsonResponse(200, { default_branch: "trunk" });
      }
      if (call.url === "https://api.github.com/repos/renzrollon/specflow/commits/trunk") {
        return jsonResponse(200, { sha: "0123456789abcdef0123456789abcdef01234567" });
      }
      return jsonResponse(404, {});
    });
    const info = await host.resolveRef();
    expect(info).toEqual({ ref: "trunk", headSha: "0123456789abcdef0123456789abcdef01234567" });
    expect(calls).toHaveLength(2);
  });

  it("resolves an explicit ref without consulting the repository endpoint", async () => {
    const { host, calls } = makeHost(() => jsonResponse(200, { sha: "89abcdef0123456789abcdef0123456789abcdef" }));
    const info = await host.resolveRef("feat/auth");
    expect(info).toEqual({ ref: "feat/auth", headSha: "89abcdef0123456789abcdef0123456789abcdef" });
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe("https://api.github.com/repos/renzrollon/specflow/commits/feat%2Fauth");
  });

  it("lists a directory mapping entry types", async () => {
    const { host } = makeHost(() =>
      jsonResponse(200, [
        { name: "add-user-auth", type: "dir" },
        { name: "archive", type: "dir" },
        { name: "README.md", type: "file" },
        { name: "link", type: "symlink" },
        { name: "sub", type: "submodule" },
      ]),
    );
    expect(await host.listDir("openspec/changes", "main")).toEqual([
      { name: "add-user-auth", type: "dir" },
      { name: "archive", type: "dir" },
      { name: "README.md", type: "file" },
      { name: "link", type: "file" },
      { name: "sub", type: "dir" },
    ]);
  });

  it("reading a directory as a file is not_found", async () => {
    const { host } = makeHost(() => jsonResponse(200, [{ name: "x", type: "file" }]));
    await expectHostError(host.readFile("openspec/changes", "main"), "not_found");
  });

  it("writes with PUT, base64 content, the branch and the base sha, returning both shas", async () => {
    const { host, calls } = makeHost(() =>
      jsonResponse(200, { content: { sha: "newblob" }, commit: { sha: "newcommit" } }),
    );
    const result = await host.writeFile({
      path: "openspec/changes/add-user-auth/decisions.md",
      ref: "feat/auth",
      content: "# Decisions — add-user-auth\n",
      message: "checkpoint(add-user-auth): answer D1",
      baseSha: "oldblob",
    });
    expect(result).toEqual({ sha: "newblob", commitSha: "newcommit" });
    expect(calls[0].init.method).toBe("PUT");
    expect(calls[0].url).toBe(
      "https://api.github.com/repos/renzrollon/specflow/contents/openspec/changes/add-user-auth/decisions.md",
    );
    expect(JSON.parse(String(calls[0].init.body))).toEqual({
      message: "checkpoint(add-user-auth): answer D1",
      content: b64("# Decisions — add-user-auth\n"),
      branch: "feat/auth",
      sha: "oldblob",
    });
  });

  it("omits sha when the file is declared new", async () => {
    const { host, calls } = makeHost(() => jsonResponse(201, { content: { sha: "b" }, commit: { sha: "c" } }));
    await host.writeFile({
      path: "openspec/changes/x/checkpoint.json",
      ref: "main",
      content: "{}",
      message: "checkpoint(x): approve",
      baseSha: null,
    });
    expect(JSON.parse(String(calls[0].init.body))).not.toHaveProperty("sha");
  });

  it("refuses a guarded path before any request", async () => {
    const { host, fetchMock } = makeHost(() => jsonResponse(200, {}));
    for (const path of ["src/app/page.tsx", "openspec/changes/add-user-auth/tasks.md"]) {
      await expectHostError(
        host.writeFile({ path, ref: "main", content: "x", message: "m", baseSha: null }),
        "forbidden_path",
      );
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("refuses a malformed repo name at construction", () => {
    expect(() => createGitHubHost({ repo: "nope", token: "t" })).toThrow(/owner\/name/);
  });
});
