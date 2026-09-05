import { HostError } from "./errors";
import { guardWritePath } from "./guard";
import type { DirEntry, FileRead, GitHost, RefInfo, WriteInput, WriteResult } from "./types";

/**
 * GitHub contents API adapter (design D2, D10). One repository, one
 * fine-grained token held server-side. Every HTTP status the API can answer
 * is mapped to a named `HostError`; the token appears in the Authorization
 * header and nowhere else.
 */

export interface GitHubHostOptions {
  /** `owner/name`. */
  repo: string;
  token: string;
  apiBase?: string;
  fetch?: typeof fetch;
}

type Json = Record<string, unknown>;

function encodePath(path: string): string {
  return path
    .split("/")
    .map((seg) => encodeURIComponent(seg))
    .join("/");
}

function decodeBase64(content: string): string {
  return Buffer.from(content.replace(/\n/g, ""), "base64").toString("utf8");
}

function encodeBase64(text: string): string {
  return Buffer.from(text, "utf8").toString("base64");
}

function retryAtFrom(headers: Headers): string | undefined {
  const reset = headers.get("x-ratelimit-reset");
  if (reset && /^\d+$/.test(reset)) return new Date(Number(reset) * 1000).toISOString();
  const after = headers.get("retry-after");
  if (after && /^\d+$/.test(after)) return new Date(Date.now() + Number(after) * 1000).toISOString();
  return undefined;
}

export function createGitHubHost(options: GitHubHostOptions): GitHost {
  const { repo, token } = options;
  const apiBase = (options.apiBase ?? "https://api.github.com").replace(/\/+$/, "");
  const doFetch = options.fetch ?? globalThis.fetch;
  if (!/^[^/\s]+\/[^/\s]+$/.test(repo)) {
    throw new Error("GitHub adapter needs CHECKPOINT_REPO as owner/name");
  }
  const repoBase = `${apiBase}/repos/${encodePath(repo)}`;
  // Belt and braces: no message built here may carry the token, even one
  // quoted from a lower layer's error.
  const scrub = (s: string) => (token ? s.split(token).join("[token]") : s);

  async function request(
    method: "GET" | "PUT",
    url: string,
    context: { path?: string; ref?: string },
    body?: unknown,
  ): Promise<{ status: number; json: unknown; headers: Headers }> {
    let res: Response;
    try {
      res = await doFetch(url, {
        method,
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${token}`,
          "X-GitHub-Api-Version": "2022-11-28",
          ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
        cache: "no-store",
      });
    } catch (e) {
      throw new HostError({
        kind: "upstream",
        message: scrub(`GitHub unreachable: ${e instanceof Error ? e.message : String(e)}`),
        ...context,
      });
    }

    const where = context.path ? ` for ${context.path}` : "";
    const on = context.ref ? ` on ${context.ref}` : "";

    if (res.status === 401) {
      throw new HostError({ kind: "unauthorized", message: "GitHub rejected the token", ...context });
    }
    if (res.status === 403 || res.status === 429) {
      const retryAt = retryAtFrom(res.headers);
      throw new HostError({
        kind: "forbidden",
        message: retryAt
          ? `GitHub refused${where}${on}: rate limited or token lacks permission`
          : `GitHub refused${where}${on}: token lacks permission`,
        retryAt,
        ...context,
      });
    }
    if (res.status === 404) {
      throw new HostError({ kind: "not_found", message: `not found${where}${on}`, ...context });
    }
    if (res.status === 409 || res.status === 422) {
      throw new HostError({
        kind: "conflict",
        message: `GitHub rejected the write${where}${on}: the file changed since it was read`,
        ...context,
      });
    }
    if (res.status >= 500) {
      throw new HostError({ kind: "upstream", message: `GitHub answered ${res.status}${where}${on}`, ...context });
    }
    if (!res.ok) {
      throw new HostError({ kind: "upstream", message: `GitHub answered ${res.status}${where}${on}`, ...context });
    }

    let json: unknown = null;
    try {
      json = await res.json();
    } catch {
      throw new HostError({ kind: "upstream", message: `GitHub answered with a body that is not JSON${where}${on}`, ...context });
    }
    return { status: res.status, json, headers: res.headers };
  }

  async function defaultBranch(): Promise<string> {
    const { json } = await request("GET", repoBase, {});
    const branch = (json as Json)?.default_branch;
    if (typeof branch !== "string" || !branch) {
      throw new HostError({ kind: "upstream", message: "GitHub did not report a default branch" });
    }
    return branch;
  }

  return {
    name: "GitHub",

    async resolveRef(ref?: string | null): Promise<RefInfo> {
      const name = ref && ref.trim() ? ref.trim() : await defaultBranch();
      const { json } = await request("GET", `${repoBase}/commits/${encodeURIComponent(name)}`, { ref: name });
      const sha = (json as Json)?.sha;
      if (typeof sha !== "string") {
        throw new HostError({ kind: "upstream", message: `GitHub did not report a head for ${name}`, ref: name });
      }
      return { ref: name, headSha: sha };
    },

    async readFile(path: string, ref: string): Promise<FileRead> {
      const url = `${repoBase}/contents/${encodePath(path)}?ref=${encodeURIComponent(ref)}`;
      const { json } = await request("GET", url, { path, ref });
      if (Array.isArray(json) || (json as Json)?.type !== "file") {
        throw new HostError({ kind: "not_found", message: `${path} is not a file on ${ref}`, path, ref });
      }
      const file = json as Json;
      const sha = file.sha;
      const content = file.content;
      if (typeof sha !== "string" || typeof content !== "string") {
        throw new HostError({ kind: "upstream", message: `GitHub returned no content for ${path} on ${ref}`, path, ref });
      }
      return { path, ref, text: decodeBase64(content), sha };
    },

    async listDir(path: string, ref: string): Promise<DirEntry[]> {
      const url = `${repoBase}/contents/${encodePath(path)}?ref=${encodeURIComponent(ref)}`;
      const { json } = await request("GET", url, { path, ref });
      if (!Array.isArray(json)) {
        throw new HostError({ kind: "not_found", message: `${path} is not a directory on ${ref}`, path, ref });
      }
      return json
        .filter((e): e is Json => !!e && typeof e === "object")
        .map((e) => ({
          name: String(e.name ?? ""),
          type: e.type === "dir" || e.type === "submodule" ? ("dir" as const) : ("file" as const),
        }))
        .filter((e) => e.name);
    },

    async writeFile(input: WriteInput): Promise<WriteResult> {
      guardWritePath(input.path);
      const url = `${repoBase}/contents/${encodePath(input.path)}`;
      const body: Json = {
        message: input.message,
        content: encodeBase64(input.content),
        branch: input.ref,
      };
      if (input.baseSha) body.sha = input.baseSha;
      const { json } = await request("PUT", url, { path: input.path, ref: input.ref }, body);
      const out = json as Json;
      const sha = (out?.content as Json | undefined)?.sha;
      const commitSha = (out?.commit as Json | undefined)?.sha;
      if (typeof sha !== "string" || typeof commitSha !== "string") {
        throw new HostError({
          kind: "upstream",
          message: `GitHub did not confirm the write of ${input.path} on ${input.ref}`,
          path: input.path,
          ref: input.ref,
        });
      }
      return { sha, commitSha };
    },
  };
}
