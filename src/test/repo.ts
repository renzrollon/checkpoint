import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { HostError, type HostErrorShape } from "@/lib/githost/errors";
import type { GitHost } from "@/lib/githost/types";

/** Build a throwaway repository tree under `openspec/changes/`; returns its root. */
export function tempRepo(build: (changes: string) => void): string {
  const dir = mkdtempSync(join(tmpdir(), "checkpoint-ui-"));
  const changes = join(dir, "openspec", "changes");
  mkdirSync(changes, { recursive: true });
  build(changes);
  return dir;
}

export function removeRepo(dir: string): void {
  rmSync(dir, { recursive: true, force: true });
}

export function writeChange(changes: string, name: string, files: Record<string, string>): void {
  const dir = join(changes, name);
  mkdirSync(dir, { recursive: true });
  for (const [file, text] of Object.entries(files)) {
    mkdirSync(join(dir, file, ".."), { recursive: true });
    writeFileSync(join(dir, file), text);
  }
}

/** A host whose every call fails with the given error. */
export function failingHost(shape: HostErrorShape, name = "github"): GitHost {
  const fail = async () => {
    throw new HostError(shape);
  };
  return { name, resolveRef: fail, readFile: fail, listDir: fail, writeFile: fail };
}

export const FIXTURE_DIR = join(process.cwd(), "fixtures", "repo");
