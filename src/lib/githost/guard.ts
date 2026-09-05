import { HostError } from "./errors";

/**
 * The reader writes exactly two files (design D17): `decisions.md` and
 * `checkpoint.json`, and only directly under `openspec/changes/<change>/`.
 * Everything else is refused here, before any request reaches the host.
 */

export const CHANGES_DIR = "openspec/changes";
export const WRITABLE_FILES = Object.freeze(["decisions.md", "checkpoint.json"] as const);
export type WritableFile = (typeof WRITABLE_FILES)[number];

export interface GuardedPath {
  change: string;
  file: WritableFile;
}

const CHANGE_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

export function guardWritePath(path: string): GuardedPath {
  const refuse = (why: string) =>
    new HostError({
      kind: "forbidden_path",
      path,
      message: `refusing to write ${JSON.stringify(path)}: ${why}`,
    });

  if (typeof path !== "string" || !path) throw refuse("empty path");
  if (path.startsWith("/") || path.includes("\\") || path.includes("\0")) throw refuse("not a repository-relative path");
  const parts = path.split("/");
  if (parts.some((p) => p === "" || p === "." || p === "..")) throw refuse("path must not contain empty, . or .. segments");
  if (parts.length !== 4 || parts[0] !== "openspec" || parts[1] !== "changes") {
    throw refuse(`only ${CHANGES_DIR}/<change>/{${WRITABLE_FILES.join(",")}} may be written`);
  }
  const [, , change, file] = parts;
  if (!CHANGE_NAME.test(change) || change === "archive") throw refuse(`"${change}" is not a writable change directory`);
  if (!(WRITABLE_FILES as readonly string[]).includes(file)) {
    throw refuse(`only ${WRITABLE_FILES.join(" and ")} may be written`);
  }
  return { change, file: file as WritableFile };
}

/** Build the guarded path for a change's file. */
export function changeFilePath(change: string, file: WritableFile | string): string {
  return `${CHANGES_DIR}/${change}/${file}`;
}
