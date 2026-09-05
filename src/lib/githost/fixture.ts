import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve, sep } from "node:path";
import { HostError } from "./errors";
import { guardWritePath } from "./guard";
import type { DirEntry, FileRead, GitHost, RefInfo, WriteInput, WriteResult } from "./types";

/**
 * Fixture adapter (design D16): serves a directory tree as if it were one
 * repository on every ref, computes blob SHAs the way git does, and keeps
 * writes in an in-memory overlay per ref so tests and local development
 * never touch the tree on disk. The head SHA of a ref is derived from the
 * overlay, so every write moves the head exactly as a commit would.
 */

export interface FixtureHostOptions {
  /** Directory served as the repository root. */
  dir: string;
  defaultBranch?: string;
}

interface OverlayEntry {
  content: string;
  sha: string;
}

/** `sha1("blob <len>\0" + content)`, as git computes it. */
export function gitBlobSha(content: string): string {
  const bytes = Buffer.from(content, "utf8");
  return createHash("sha1").update(`blob ${bytes.length}\0`).update(bytes).digest("hex");
}

export interface FixtureHost extends GitHost {
  /** Drop every in-memory write, on every ref. */
  reset(): void;
  /** The overlay for a ref: path → content. Empty when nothing was written. */
  overlay(ref: string): ReadonlyMap<string, string>;
}

function safeSegments(path: string): string[] {
  const parts = path.split("/").filter((p) => p !== "" && p !== ".");
  if (parts.some((p) => p === "..")) {
    throw new HostError({ kind: "not_found", message: `not found for ${path}`, path });
  }
  return parts;
}

export function createFixtureHost(options: FixtureHostOptions): FixtureHost {
  const root = resolve(options.dir);
  const defaultBranch = options.defaultBranch ?? "main";
  const overlays = new Map<string, Map<string, OverlayEntry>>();

  function overlayFor(ref: string): Map<string, OverlayEntry> {
    let o = overlays.get(ref);
    if (!o) {
      o = new Map();
      overlays.set(ref, o);
    }
    return o;
  }

  function diskPath(path: string): string {
    const full = resolve(root, ...safeSegments(path));
    if (full !== root && !full.startsWith(root + sep)) {
      throw new HostError({ kind: "not_found", message: `not found for ${path}`, path });
    }
    return full;
  }

  function headSha(ref: string): string {
    const h = createHash("sha1").update(`checkpoint-fixture\0${ref}`);
    const o = overlays.get(ref);
    if (o) {
      for (const [p, e] of [...o.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) {
        h.update(`\0${p}\0${e.sha}`);
      }
    }
    return h.digest("hex");
  }

  function currentSha(path: string, ref: string): string | null {
    const o = overlays.get(ref)?.get(path);
    if (o) return o.sha;
    const full = diskPath(path);
    if (existsSync(full) && statSync(full).isFile()) return gitBlobSha(readFileSync(full, "utf8"));
    return null;
  }

  return {
    name: "fixture",

    reset() {
      overlays.clear();
    },

    overlay(ref: string): ReadonlyMap<string, string> {
      const out = new Map<string, string>();
      for (const [p, e] of overlays.get(ref) ?? []) out.set(p, e.content);
      return out;
    },

    async resolveRef(ref?: string | null): Promise<RefInfo> {
      const name = ref && ref.trim() ? ref.trim() : defaultBranch;
      return { ref: name, headSha: headSha(name) };
    },

    async readFile(path: string, ref: string): Promise<FileRead> {
      const o = overlays.get(ref)?.get(path);
      if (o) return { path, ref, text: o.content, sha: o.sha };
      const full = diskPath(path);
      if (!existsSync(full) || !statSync(full).isFile()) {
        throw new HostError({ kind: "not_found", message: `not found for ${path} on ${ref}`, path, ref });
      }
      const text = readFileSync(full, "utf8");
      return { path, ref, text, sha: gitBlobSha(text) };
    },

    async listDir(path: string, ref: string): Promise<DirEntry[]> {
      const full = diskPath(path);
      const entries = new Map<string, DirEntry["type"]>();
      if (existsSync(full) && statSync(full).isDirectory()) {
        for (const name of readdirSync(full)) {
          if (name === ".DS_Store") continue;
          entries.set(name, statSync(join(full, name)).isDirectory() ? "dir" : "file");
        }
      }
      const prefix = safeSegments(path).join("/");
      for (const p of overlays.get(ref)?.keys() ?? []) {
        const rel = prefix ? (p.startsWith(prefix + "/") ? p.slice(prefix.length + 1) : null) : p;
        if (rel === null) continue;
        const [first, ...rest] = rel.split("/");
        if (!entries.has(first)) entries.set(first, rest.length ? "dir" : "file");
      }
      if (entries.size === 0 && !(existsSync(full) && statSync(full).isDirectory())) {
        throw new HostError({ kind: "not_found", message: `not found for ${path} on ${ref}`, path, ref });
      }
      return [...entries.entries()]
        .map(([name, type]) => ({ name, type }))
        .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
    },

    async writeFile(input: WriteInput): Promise<WriteResult> {
      guardWritePath(input.path);
      const current = currentSha(input.path, input.ref);
      if ((input.baseSha ?? null) !== current) {
        throw new HostError({
          kind: "conflict",
          message: `${input.path} changed on ${input.ref} since it was read`,
          path: input.path,
          ref: input.ref,
        });
      }
      const sha = gitBlobSha(input.content);
      overlayFor(input.ref).set(input.path, { content: input.content, sha });
      return { sha, commitSha: headSha(input.ref) };
    },
  };
}
