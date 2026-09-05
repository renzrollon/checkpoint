/**
 * The one narrow contract every git host implements (design D10, D16, D17):
 * resolve a ref, read a file with its blob SHA, list a directory, and write
 * one of two guarded files against a base blob SHA.
 */

export interface RefInfo {
  /** The ref as resolved: the branch name when the caller gave none. */
  ref: string;
  /** Head commit SHA of that ref. */
  headSha: string;
}

export interface FileRead {
  path: string;
  ref: string;
  text: string;
  /** Blob SHA the host reports for this path on this ref. */
  sha: string;
}

export interface DirEntry {
  name: string;
  type: "file" | "dir";
}

export interface WriteInput {
  path: string;
  ref: string;
  content: string;
  message: string;
  /** Blob SHA last read for this path, or `null` to declare the file new. */
  baseSha: string | null;
}

export interface WriteResult {
  /** New blob SHA of the written file. */
  sha: string;
  /** SHA of the commit the write produced. */
  commitSha: string;
}

export interface GitHost {
  /** Which host this is, for display ("GitHub", "fixture"). */
  readonly name: string;
  resolveRef(ref?: string | null): Promise<RefInfo>;
  readFile(path: string, ref: string): Promise<FileRead>;
  listDir(path: string, ref: string): Promise<DirEntry[]>;
  writeFile(input: WriteInput): Promise<WriteResult>;
}
