// @vitest-environment node
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { HostError, type GitHost } from "@/lib/githost";
import { createFixtureHost } from "@/lib/githost/fixture";
import { blockingReasonFor, listChanges, loadChange } from "./load";

const FIXTURE_DIR = join(process.cwd(), "fixtures", "repo");
const host = () => createFixtureHost({ dir: FIXTURE_DIR });

const temps: string[] = [];
function tempRepo(build: (changes: string) => void): string {
  const dir = mkdtempSync(join(tmpdir(), "checkpoint-load-"));
  temps.push(dir);
  const changes = join(dir, "openspec", "changes");
  mkdirSync(changes, { recursive: true });
  build(changes);
  return dir;
}
afterEach(() => {
  for (const d of temps.splice(0)) rmSync(d, { recursive: true, force: true });
});

/**
 * Wrap a host so each call's peak concurrency is recorded. `Promise.all`
 * starts every sibling before any of them resolves, so a concurrent reader
 * shows a peak of at least 2 deterministically; the sequential one never
 * exceeds 1, whatever the adapter's timing.
 */
function countingHost(base: GitHost) {
  const inFlight = { readFile: 0, listDir: 0 };
  const peak = { readFile: 0, listDir: 0 };
  function track<A extends unknown[], R>(name: "readFile" | "listDir", call: (...args: A) => Promise<R>) {
    return async (...args: A): Promise<R> => {
      inFlight[name] += 1;
      peak[name] = Math.max(peak[name], inFlight[name]);
      try {
        return await call(...args);
      } finally {
        inFlight[name] -= 1;
      }
    };
  }
  const host: GitHost = {
    ...base,
    readFile: track("readFile", (path: string, ref: string) => base.readFile(path, ref)),
    listDir: track("listDir", (path: string, ref: string) => base.listDir(path, ref)),
  };
  return { host, peak };
}

/** A host whose reads and listings each fail with a fixed error. */
function failingHost(errors: { listDir: HostError; readFile: HostError }): GitHost {
  return {
    name: "failing",
    resolveRef: async (ref) => ({ ref: ref ?? "main", headSha: "a".repeat(40) }),
    readFile: async () => {
      throw errors.readFile;
    },
    listDir: async () => {
      throw errors.listDir;
    },
    writeFile: async () => {
      throw errors.readFile;
    },
  };
}

const CLEAR_LEDGER = `# Decisions — x

| id | question | class | resolution | evidence |
|----|----|----|----|----|
| D1 | q | agent_resolved | r | e |
`;

describe("listChanges", () => {
  it("lists the two fixture changes, blocking first, with status text", async () => {
    const inbox = await listChanges(host(), "main");
    expect(inbox.ref).toBe("main");
    expect(inbox.headSha).toMatch(/^[0-9a-f]{40}$/);
    expect(inbox.entries.map((e) => e.name)).toEqual(["add-user-auth", "add-report-flag"]);
    const [auth, flag] = inbox.entries;
    expect(auth).toMatchObject({
      blocking: true,
      ledger: { status: "blocking", statusText: "1 needs you" },
      tasks: { done: 4, total: 12, waves: 3 },
      decision: "none",
    });
    expect(flag).toMatchObject({
      blocking: false,
      ledger: { status: "clear", statusText: "clear" },
      tasks: { done: 5, total: 5, waves: 2 },
      decision: "approved",
    });
  });

  it("uses the default branch when no ref is given", async () => {
    const inbox = await listChanges(host(), null);
    expect(inbox.ref).toBe("main");
  });

  it("excludes archive", async () => {
    const inbox = await listChanges(host(), "main");
    expect(inbox.entries.some((e) => e.name === "archive")).toBe(false);
  });

  it("a missing ledger reads 'ledger missing' and sorts with the blocking changes", async () => {
    const dir = tempRepo((changes) => {
      mkdirSync(join(changes, "aaa-clear"));
      writeFileSync(join(changes, "aaa-clear", "decisions.md"), CLEAR_LEDGER);
      writeFileSync(join(changes, "aaa-clear", "design.md"), "D1 is here");
      mkdirSync(join(changes, "zzz-no-ledger"));
      writeFileSync(join(changes, "zzz-no-ledger", "tasks.md"), "- [ ] 1 x\n");
    });
    const inbox = await listChanges(createFixtureHost({ dir }), "main");
    expect(inbox.entries.map((e) => e.name)).toEqual(["zzz-no-ledger", "aaa-clear"]);
    expect(inbox.entries[0]).toMatchObject({
      blocking: true,
      ledger: { status: "missing", statusText: "ledger missing" },
      tasks: { done: 0, total: 1, waves: 0 },
    });
    expect(inbox.entries[1].blocking).toBe(false);
  });

  it("an unreadable ledger blocks and says so", async () => {
    const dir = tempRepo((changes) => {
      mkdirSync(join(changes, "bad"));
      writeFileSync(join(changes, "bad", "decisions.md"), "just prose\n");
    });
    const inbox = await listChanges(createFixtureHost({ dir }), "main");
    expect(inbox.entries[0].ledger).toMatchObject({ status: "unparseable", statusText: "ledger unreadable" });
  });

  it("an empty listing when only archive exists", async () => {
    const dir = tempRepo((changes) => {
      mkdirSync(join(changes, "archive", "2026-01-01-old"), { recursive: true });
    });
    expect((await listChanges(createFixtureHost({ dir }), "main")).entries).toEqual([]);
  });

  it("an empty listing when openspec/changes does not exist", async () => {
    const dir = mkdtempSync(join(tmpdir(), "checkpoint-empty-"));
    temps.push(dir);
    expect((await listChanges(createFixtureHost({ dir }), "main")).entries).toEqual([]);
  });

  it("reflects writes on the ref", async () => {
    const h = host();
    const ledger = await h.readFile("openspec/changes/add-user-auth/decisions.md", "main");
    await h.writeFile({
      path: ledger.path,
      ref: "main",
      content: ledger.text.replace("| needs_human | — | — |", "| agent_resolved | cookie | human decision 2026-09-05 via Checkpoint |"),
      message: "m",
      baseSha: ledger.sha,
    });
    const inbox = await listChanges(h, "main");
    expect(inbox.entries.map((e) => e.name)).toEqual(["add-report-flag", "add-user-auth"]);
    expect(inbox.entries[1].ledger.statusText).toBe("clear");
  });
});

describe("loadChange", () => {
  it("an unknown change is a typed not_found with the ref", async () => {
    expect(await loadChange(host(), "feat/auth", "no-such-change")).toEqual({
      kind: "not_found",
      name: "no-such-change",
      ref: "feat/auth",
    });
    expect((await loadChange(host(), "main", "../etc")).kind).toBe("not_found");
    expect((await loadChange(host(), "main", "archive")).kind).toBe("not_found");
  });

  it("computes counts from the artifacts and reads every file", async () => {
    const result = await loadChange(host(), "main", "add-user-auth");
    expect(result.kind).toBe("change");
    if (result.kind !== "change") return;
    const c = result.change;
    expect(c.name).toBe("add-user-auth");
    expect(c.ref).toBe("main");
    expect(c.tasks).toMatchObject({ done: 4, total: 12, waves: 3 });
    expect(c.ledger.summary).toMatchObject({ total: 4, needsHuman: 1, agentResolved: 3, invalid: 0, blocking: true });
    expect(c.ledger.statusText).toBe("1 needs you");
    expect(c.ledger.blockingReason).toBe("1 decision still needs you");
    expect(c.ledger.sha).toMatch(/^[0-9a-f]{40}$/);
    expect(c.artifacts.proposal.text).toContain("## Why");
    expect(c.artifacts.design.missing).toBe(false);
    expect(c.artifacts.tasks.missing).toBe(false);
    expect(c.specs.map((s) => s.path)).toEqual(["access-gate/spec.md", "change-inbox/spec.md"]);
    expect(c.checkpoint.present).toBe(true);
    expect(c.checkpoint.value?.request?.risk?.class).toBe("medium");
    expect(c.risk).toMatchObject({ state: "observed", class: "medium", headSha: c.headSha });
    expect(c.decision).toEqual({ state: "none" });
  });

  it("shows the approved decision and stale risk after the head moves", async () => {
    const h = host();
    const before = await loadChange(h, "main", "add-report-flag");
    if (before.kind !== "change") throw new Error("expected change");
    expect(before.change.decision).toMatchObject({ state: "approved", stale: false });
    expect(before.change.risk.state).toBe("observed");
    // Any write moves the head, so the recorded risk and decision become stale.
    const ledger = await h.readFile("openspec/changes/add-report-flag/decisions.md", "main");
    await h.writeFile({ path: ledger.path, ref: "main", content: ledger.text + "\n", message: "m", baseSha: ledger.sha });
    const after = await loadChange(h, "main", "add-report-flag");
    if (after.kind !== "change") throw new Error("expected change");
    expect(after.change.decision).toMatchObject({ state: "approved", stale: true });
    expect(after.change.risk.state).toBe("stale");
  });

  it("marks missing artifacts per file and audits references against design.md", async () => {
    const dir = tempRepo((changes) => {
      mkdirSync(join(changes, "thin"));
      writeFileSync(join(changes, "thin", "proposal.md"), "## Why\n");
      writeFileSync(join(changes, "thin", "decisions.md"), CLEAR_LEDGER);
    });
    const result = await loadChange(createFixtureHost({ dir }), "main", "thin");
    if (result.kind !== "change") throw new Error("expected change");
    const c = result.change;
    expect(c.artifacts.design).toMatchObject({ file: "design.md", missing: true, text: null, sha: null });
    expect(c.artifacts.tasks.missing).toBe(true);
    expect(c.tasks).toMatchObject({ done: 0, total: 0, waves: 0 });
    expect(c.specs).toEqual([]);
    expect(c.checkpoint).toMatchObject({ present: false, value: null, problem: null });
    expect(c.risk).toEqual({ state: "unobserved" });
    // With no design.md the agent_resolved row cannot resolve its reference, as interlock ready would find.
    expect(c.ledger.summary.invalid).toBe(1);
    expect(c.ledger.rows[0].problems.join(" ")).toMatch(/design\.md is absent/);
    expect(c.ledger.blockingReason).toBe("1 ledger row is invalid; the laptop side would refuse this");
  });

  it("reads the specs concurrently and still returns them sorted", async () => {
    const dir = tempRepo((changes) => {
      const specs = join(changes, "wide", "specs");
      mkdirSync(join(specs, "zzz-gate"), { recursive: true });
      mkdirSync(join(specs, "aaa-inbox"), { recursive: true });
      writeFileSync(join(changes, "wide", "proposal.md"), "## Why\n");
      writeFileSync(join(specs, "zzz-gate", "spec.md"), "gate\n");
      writeFileSync(join(specs, "aaa-inbox", "spec.md"), "inbox\n");
      writeFileSync(join(specs, "aaa-inbox", "extra-spec.md"), "extra\n");
    });
    const counted = countingHost(createFixtureHost({ dir }));
    const result = await loadChange(counted.host, "main", "wide");
    if (result.kind !== "change") throw new Error("expected change");
    expect(result.change.specs.map((s) => s.path)).toEqual([
      "aaa-inbox/extra-spec.md",
      "aaa-inbox/spec.md",
      "zzz-gate/spec.md",
    ]);
    // Sequential reads never exceed one call in flight at a time.
    expect(counted.peak.readFile).toBeGreaterThanOrEqual(2);
    expect(counted.peak.listDir).toBeGreaterThanOrEqual(2);
  });

  it("an unknown change on the fixture is still a typed not_found, with no error escaping", async () => {
    await expect(loadChange(host(), "main", "no-such-change")).resolves.toEqual({
      kind: "not_found",
      name: "no-such-change",
      ref: "main",
    });
  });

  it("the existence failure wins over a simultaneous read failure", async () => {
    const failing = failingHost({
      listDir: new HostError({ kind: "forbidden", message: "rate limited" }),
      readFile: new HostError({ kind: "upstream", message: "git host unreachable" }),
    });
    await expect(loadChange(failing, "main", "add-user-auth")).rejects.toMatchObject({ kind: "forbidden" });
  });

  it("a read failure surfaces when the change exists", async () => {
    const dir = tempRepo((changes) => {
      mkdirSync(join(changes, "one", "specs", "gate"), { recursive: true });
      writeFileSync(join(changes, "one", "specs", "gate", "spec.md"), "gate\n");
    });
    const base = createFixtureHost({ dir });
    const broken: GitHost = {
      ...base,
      readFile: async (path, ref) => {
        if (path.endsWith("/spec.md")) throw new HostError({ kind: "upstream", message: "git host unreachable", path });
        return base.readFile(path, ref);
      },
    };
    await expect(loadChange(broken, "main", "one")).rejects.toMatchObject({ kind: "upstream" });
  });

  it("reports an unreadable checkpoint.json as a problem, not as absent", async () => {
    const dir = tempRepo((changes) => {
      mkdirSync(join(changes, "c"));
      writeFileSync(join(changes, "c", "checkpoint.json"), "{nope");
    });
    const result = await loadChange(createFixtureHost({ dir }), "main", "c");
    if (result.kind !== "change") throw new Error("expected change");
    expect(result.change.checkpoint.present).toBe(true);
    expect(result.change.checkpoint.problem).toMatch(/not JSON/);
    expect(result.change.risk).toEqual({ state: "unobserved" });
  });
});

describe("blockingReasonFor", () => {
  it("words every blocking state", () => {
    const base = { total: 0, agentResolved: 0, invalidCount: 0, exists: true, changeExists: true, blocking: true };
    expect(blockingReasonFor({ ...base, needsHuman: 0, invalid: 0, missing: true, unparseable: false })).toBe(
      "decisions.md is missing; the laptop side would refuse this",
    );
    expect(blockingReasonFor({ ...base, needsHuman: 0, invalid: 0, missing: false, unparseable: true })).toBe(
      "decisions.md is unreadable; the laptop side would refuse this",
    );
    expect(blockingReasonFor({ ...base, needsHuman: 2, invalid: 0, missing: false, unparseable: false })).toBe(
      "2 decisions still need you",
    );
    expect(blockingReasonFor({ ...base, needsHuman: 0, invalid: 3, missing: false, unparseable: false })).toBe(
      "3 ledger rows are invalid; the laptop side would refuse this",
    );
    expect(
      blockingReasonFor({ ...base, needsHuman: 0, invalid: 0, missing: false, unparseable: false, blocking: false }),
    ).toBeNull();
  });
});
