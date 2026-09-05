import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { HostError } from "./errors";
import { createFixtureHost, gitBlobSha, type FixtureHost } from "./fixture";
import type { GitHost } from "./types";

/**
 * The shared adapter contract (git-host-adapter spec). Every scenario here is
 * written against the `GitHost` interface; the fixture adapter is the one
 * that runs it in-process. The GitHub adapter covers the same observable
 * results with mocked HTTP in github.test.ts.
 */

const FIXTURE_DIR = join(process.cwd(), "fixtures", "repo");
const LEDGER = "openspec/changes/add-user-auth/decisions.md";
const CHECKPOINT = "openspec/changes/add-user-auth/checkpoint.json";

async function expectHostError(p: Promise<unknown>, kind: HostError["kind"]): Promise<HostError> {
  let caught: unknown;
  try {
    await p;
  } catch (e) {
    caught = e;
  }
  expect(caught).toBeInstanceOf(HostError);
  expect((caught as HostError).kind).toBe(kind);
  return caught as HostError;
}

function contractSuite(name: string, make: () => GitHost) {
  describe(`${name} adapter contract`, () => {
    let host: GitHost;
    beforeEach(() => {
      host = make();
    });

    it("reads a file with its blob sha", async () => {
      const file = await host.readFile(LEDGER, "feat/auth");
      expect(file.text).toContain("# Decisions — add-user-auth");
      expect(file.text).toContain("needs_human");
      expect(file.ref).toBe("feat/auth");
      expect(file.path).toBe(LEDGER);
      expect(file.sha).toMatch(/^[0-9a-f]{40}$/);
    });

    it("a missing file is a typed not_found naming the path and ref", async () => {
      const err = await expectHostError(host.readFile("openspec/changes/add-user-auth/nope.md", "main"), "not_found");
      expect(err.path).toBe("openspec/changes/add-user-auth/nope.md");
      expect(err.ref).toBe("main");
    });

    it("uses the default branch when no ref is given", async () => {
      const info = await host.resolveRef();
      expect(info.ref).toBe("main");
      expect(info.headSha).toMatch(/^[0-9a-f]{40}$/);
      const explicit = await host.resolveRef("main");
      expect(explicit.headSha).toBe(info.headSha);
    });

    it("lists a directory distinguishing files from directories, archive included", async () => {
      const entries = await host.listDir("openspec/changes", "main");
      expect(entries).toEqual(
        expect.arrayContaining([
          { name: "add-user-auth", type: "dir" },
          { name: "add-report-flag", type: "dir" },
          { name: "archive", type: "dir" },
        ]),
      );
      const inChange = await host.listDir("openspec/changes/add-user-auth", "main");
      expect(inChange).toEqual(
        expect.arrayContaining([
          { name: "decisions.md", type: "file" },
          { name: "specs", type: "dir" },
        ]),
      );
    });

    it("a missing directory is not_found", async () => {
      await expectHostError(host.listDir("openspec/changes/no-such-change", "main"), "not_found");
    });

    it("writes with the current sha and reports new blob and commit shas", async () => {
      const before = await host.readFile(LEDGER, "main");
      const head0 = (await host.resolveRef("main")).headSha;
      const content = before.text.replace("needs_human", "agent_resolved");
      const result = await host.writeFile({
        path: LEDGER,
        ref: "main",
        content,
        message: "checkpoint(add-user-auth): answer D1",
        baseSha: before.sha,
      });
      expect(result.sha).toMatch(/^[0-9a-f]{40}$/);
      expect(result.sha).not.toBe(before.sha);
      expect(result.commitSha).toMatch(/^[0-9a-f]{40}$/);
      expect(result.commitSha).not.toBe(head0);
      expect((await host.resolveRef("main")).headSha).toBe(result.commitSha);
      const after = await host.readFile(LEDGER, "main");
      expect(after.text).toBe(content);
      expect(after.sha).toBe(result.sha);
    });

    it("a stale sha is a conflict and nothing changes", async () => {
      const before = await host.readFile(LEDGER, "main");
      await expectHostError(
        host.writeFile({ path: LEDGER, ref: "main", content: "x", message: "m", baseSha: "0".repeat(40) }),
        "conflict",
      );
      expect((await host.readFile(LEDGER, "main")).text).toBe(before.text);
    });

    it("declaring an existing file new is a conflict", async () => {
      await expectHostError(
        host.writeFile({ path: LEDGER, ref: "main", content: "x", message: "m", baseSha: null }),
        "conflict",
      );
    });

    it("creates a file that does not exist when declared new", async () => {
      const path = "openspec/changes/add-user-auth/checkpoint.json";
      const ref = "feat/fresh";
      // On this ref the file exists on disk, so pick a change without one.
      const missing = "openspec/changes/archive-free/checkpoint.json";
      void path;
      await expectHostError(host.readFile(missing, ref), "not_found");
      const result = await host.writeFile({ path: missing, ref, content: "{}\n", message: "m", baseSha: null });
      expect(result.sha).toBe(gitBlobSha("{}\n"));
      expect((await host.readFile(missing, ref)).text).toBe("{}\n");
    });

    it("refuses writes outside the allowed paths before contacting the host", async () => {
      for (const path of [
        "src/app/page.tsx",
        "openspec/changes/add-user-auth/tasks.md",
        "openspec/changes/add-user-auth/specs/decisions.md",
        "openspec/changes/archive/x/decisions.md",
        "openspec/changes/../decisions.md",
        "/openspec/changes/add-user-auth/decisions.md",
      ]) {
        const err = await expectHostError(
          host.writeFile({ path, ref: "main", content: "x", message: "m", baseSha: null }),
          "forbidden_path",
        );
        expect(err.path).toBe(path);
      }
    });

    it("write then read on the same ref reflects the write and leaves disk unchanged", async () => {
      const onDisk = readFileSync(join(FIXTURE_DIR, CHECKPOINT), "utf8");
      const before = await host.readFile(CHECKPOINT, "main");
      const content = '{"schema":"interlock.checkpoint/1","change":"add-user-auth","decision":{"state":"approved"}}\n';
      const result = await host.writeFile({
        path: CHECKPOINT,
        ref: "main",
        content,
        message: "checkpoint(add-user-auth): approve",
        baseSha: before.sha,
      });
      const after = await host.readFile(CHECKPOINT, "main");
      expect(after.text).toBe(content);
      expect(after.sha).toBe(result.sha);
      expect(after.sha).not.toBe(before.sha);
      expect(readFileSync(join(FIXTURE_DIR, CHECKPOINT), "utf8")).toBe(onDisk);
      // Another ref still sees the disk content.
      expect((await host.readFile(CHECKPOINT, "other")).text).toBe(onDisk);
    });
  });
}

contractSuite("fixture", () => createFixtureHost({ dir: FIXTURE_DIR }));

describe("fixture adapter specifics", () => {
  let host: FixtureHost;
  beforeEach(() => {
    host = createFixtureHost({ dir: FIXTURE_DIR });
  });

  it("computes blob shas the way git does", () => {
    const text = "hello\n";
    const expected = createHash("sha1").update(`blob ${Buffer.byteLength(text)}\0${text}`).digest("hex");
    expect(gitBlobSha(text)).toBe(expected);
    // `printf 'hello\n' | git hash-object --stdin`
    expect(gitBlobSha(text)).toBe("ce013625030ba8dba906f756967f9e9ca394464a");
  });

  it("reports the on-disk file's git blob sha", async () => {
    const onDisk = readFileSync(join(FIXTURE_DIR, LEDGER), "utf8");
    expect((await host.readFile(LEDGER, "main")).sha).toBe(gitBlobSha(onDisk));
  });

  it("head sha is stable per ref and moves with every write", async () => {
    const a = (await host.resolveRef("main")).headSha;
    const b = (await host.resolveRef("main")).headSha;
    expect(a).toBe(b);
    expect((await host.resolveRef("feat/x")).headSha).not.toBe(a);
    const file = await host.readFile(LEDGER, "main");
    await host.writeFile({ path: LEDGER, ref: "main", content: file.text + "\n", message: "m", baseSha: file.sha });
    expect((await host.resolveRef("main")).headSha).not.toBe(a);
  });

  it("reset drops the overlay", async () => {
    const file = await host.readFile(LEDGER, "main");
    await host.writeFile({ path: LEDGER, ref: "main", content: "changed", message: "m", baseSha: file.sha });
    expect(host.overlay("main").get(LEDGER)).toBe("changed");
    host.reset();
    expect(host.overlay("main").size).toBe(0);
    expect((await host.readFile(LEDGER, "main")).text).toBe(file.text);
  });

  it("a written file appears in directory listings", async () => {
    const path = "openspec/changes/add-report-flag/decisions.md";
    const file = await host.readFile(path, "main");
    await host.writeFile({ path, ref: "main", content: file.text, message: "m", baseSha: file.sha });
    const entries = await host.listDir("openspec/changes/add-report-flag", "main");
    expect(entries.filter((e) => e.name === "decisions.md")).toHaveLength(1);
    // A file created in a change directory that exists only in the overlay.
    await host.writeFile({
      path: "openspec/changes/brand-new/checkpoint.json",
      ref: "main",
      content: "{}",
      message: "m",
      baseSha: null,
    });
    expect(await host.listDir("openspec/changes", "main")).toEqual(
      expect.arrayContaining([{ name: "brand-new", type: "dir" }]),
    );
  });
});
