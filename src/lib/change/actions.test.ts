// @vitest-environment node
import { beforeEach, describe, expect, it } from "vitest";
import { createFixtureHost, type FixtureHost } from "@/lib/githost/fixture";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseLedger, summarize } from "@/lib/ledger/ledger";
import { answerRow, decide } from "./actions";

const FIXTURE_DIR = join(process.cwd(), "fixtures", "repo");
const LEDGER = "openspec/changes/add-user-auth/decisions.md";
const CHECKPOINT = "openspec/changes/add-user-auth/checkpoint.json";
const TODAY = "2026-09-05";
const NOW = "2026-09-05T04:00:00Z";

let host: FixtureHost;
beforeEach(() => {
  host = createFixtureHost({ dir: FIXTURE_DIR });
});

describe("answerRow", () => {
  it("flips the row and leaves every other line byte-identical", async () => {
    const before = await host.readFile(LEDGER, "main");
    const result = await answerRow(host, {
      ref: "main",
      change: "add-user-auth",
      id: "D1",
      answer: "a session cookie",
      baseSha: before.sha,
      today: TODAY,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const after = await host.readFile(LEDGER, "main");
    expect(after.sha).toBe(result.sha);
    const b = before.text.split("\n");
    const a = after.text.split("\n");
    expect(a.length).toBe(b.length);
    const changed = a.map((l, i) => (l === b[i] ? null : i)).filter((i) => i !== null);
    expect(changed).toHaveLength(1);
    expect(a[changed[0]!]).toBe(
      "| D1 | How is the app gated: a session cookie, Vercel Deployment Protection, or Cloudflare Access? | agent_resolved | a session cookie | human decision 2026-09-05 via Checkpoint |",
    );
    expect(result.row).toMatchObject({ id: "D1", class: "agent_resolved", valid: true });
    expect(result.summary).toMatchObject({ needsHuman: 0, agentResolved: 4, invalid: 0, blocking: false });
    expect(result.blockingReason).toBeNull();
    expect(result.headSha).toBe((await host.resolveRef("main")).headSha);
    expect(summarize(parseLedger(after.text)).blocking).toBe(false);
  });

  it("refuses a resolved row and writes nothing", async () => {
    const before = await host.readFile(LEDGER, "main");
    const result = await answerRow(host, {
      ref: "main",
      change: "add-user-auth",
      id: "D2",
      answer: "x",
      baseSha: before.sha,
      today: TODAY,
    });
    expect(result).toMatchObject({ ok: false, reason: "not_needs_human", message: "D2 is not waiting on a person" });
    expect(host.overlay("main").size).toBe(0);
  });

  it("refuses a blank answer and writes nothing", async () => {
    const before = await host.readFile(LEDGER, "main");
    const result = await answerRow(host, {
      ref: "main",
      change: "add-user-auth",
      id: "D1",
      answer: "  ",
      baseSha: before.sha,
      today: TODAY,
    });
    expect(result).toMatchObject({ ok: false, reason: "blank_answer", message: "An answer is required" });
    expect(host.overlay("main").size).toBe(0);
  });

  it("a conflict returns the reloaded file and writes nothing", async () => {
    const shown = await host.readFile(LEDGER, "main");
    // Someone else commits between page load and the answer.
    const elsewhere = shown.text.replace("| D4 |", "| D4 |") + "\nA line added on the laptop.\n";
    await host.writeFile({ path: LEDGER, ref: "main", content: elsewhere, message: "laptop", baseSha: shown.sha });
    const result = await answerRow(host, {
      ref: "main",
      change: "add-user-auth",
      id: "D1",
      answer: "cookie",
      baseSha: shown.sha,
      today: TODAY,
    });
    expect(result.ok).toBe(false);
    if (result.ok || result.reason !== "conflict") throw new Error("expected conflict");
    expect(result.message).toBe("The ledger changed on main since you opened it; reloaded");
    expect(result.reloaded.text).toBe(elsewhere);
    expect(result.reloaded.rows.find((r) => r.id === "D1")?.class).toBe("needs_human");
    expect((await host.readFile(LEDGER, "main")).text).toBe(elsewhere);
  });

  it("a missing ledger is reported", async () => {
    const result = await answerRow(host, {
      ref: "main",
      change: "no-such-change",
      id: "D1",
      answer: "x",
      baseSha: null,
      today: TODAY,
    });
    expect(result).toMatchObject({ ok: false, reason: "missing" });
  });
});

describe("decide", () => {
  it("the server refuses an approve while the ledger blocks and writes nothing", async () => {
    const shown = await host.readFile(CHECKPOINT, "main");
    const result = await decide(host, {
      ref: "main",
      change: "add-user-auth",
      state: "approved",
      baseSha: shown.sha,
      headSha: (await host.resolveRef("main")).headSha,
      now: NOW,
    });
    expect(result).toMatchObject({
      ok: false,
      reason: "ledger_blocks",
      message: "ledger blocks approval",
      detail: "1 decision still needs you",
    });
    expect(host.overlay("main").size).toBe(0);
  });

  it("approve writes the decision file with the head sha and the request preserved", async () => {
    const ledger = await host.readFile(LEDGER, "main");
    const answered = await answerRow(host, {
      ref: "main",
      change: "add-user-auth",
      id: "D1",
      answer: "cookie",
      baseSha: ledger.sha,
      today: TODAY,
    });
    expect(answered.ok).toBe(true);
    const shown = await host.readFile(CHECKPOINT, "main");
    const original = JSON.parse(shown.text);
    const headBefore = (await host.resolveRef("main")).headSha;

    const result = await decide(host, {
      ref: "main",
      change: "add-user-auth",
      state: "approved",
      baseSha: shown.sha,
      headSha: headBefore,
      now: NOW,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const written = JSON.parse((await host.readFile(CHECKPOINT, "main")).text);
    expect(written.schema).toBe("interlock.checkpoint/1");
    expect(written.change).toBe("add-user-auth");
    expect(written.decision).toEqual({
      state: "approved",
      note: "",
      decidedAt: NOW,
      decidedBy: "checkpoint",
      headSha: headBefore,
    });
    expect(written.request).toEqual(original.request);
    expect(written.senderNote).toBe(original.senderNote);
    expect(result.decision).toMatchObject({ state: "approved", headSha: headBefore, stale: false });
    expect(result.headSha).toBe(headBefore);
    // The write itself moved the head, so a fresh load would call it stale; that is honest.
    expect((await host.resolveRef("main")).headSha).not.toBe(headBefore);
  });

  it("send back writes the note even while the ledger blocks", async () => {
    const shown = await host.readFile(CHECKPOINT, "main");
    const result = await decide(host, {
      ref: "main",
      change: "add-user-auth",
      state: "returned",
      note: "Split the auth change out",
      baseSha: shown.sha,
      headSha: (await host.resolveRef("main")).headSha,
      now: NOW,
    });
    expect(result.ok).toBe(true);
    const written = JSON.parse((await host.readFile(CHECKPOINT, "main")).text);
    expect(written.decision).toMatchObject({ state: "returned", note: "Split the auth change out", decidedBy: "checkpoint" });
    expect(written.request).toBeDefined();
  });

  it("send back requires a note and writes nothing", async () => {
    const result = await decide(host, {
      ref: "main",
      change: "add-user-auth",
      state: "returned",
      note: "   ",
      baseSha: null,
      headSha: "x",
      now: NOW,
    });
    expect(result).toMatchObject({ ok: false, reason: "note_required", message: "Say what should change" });
    expect(host.overlay("main").size).toBe(0);
  });

  it("creates checkpoint.json when none exists", async () => {
    const dir = mkdtempSync(join(tmpdir(), "checkpoint-decide-"));
    try {
      const change = join(dir, "openspec", "changes", "fresh");
      mkdirSync(change, { recursive: true });
      writeFileSync(join(change, "design.md"), "D1 is recorded here\n");
      writeFileSync(
        join(change, "decisions.md"),
        "# Decisions — fresh\n\n| id | question | class | resolution | evidence |\n|----|----|----|----|----|\n| D1 | q | agent_resolved | r | e |\n",
      );
      const fresh = createFixtureHost({ dir });
      const head = (await fresh.resolveRef("main")).headSha;
      const result = await decide(fresh, {
        ref: "main",
        change: "fresh",
        state: "approved",
        baseSha: null,
        headSha: head,
        now: NOW,
      });
      expect(result.ok).toBe(true);
      const written = JSON.parse((await fresh.readFile("openspec/changes/fresh/checkpoint.json", "main")).text);
      expect(written).toEqual({
        schema: "interlock.checkpoint/1",
        change: "fresh",
        decision: { state: "approved", note: "", decidedAt: NOW, decidedBy: "checkpoint", headSha: head },
      });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("a decision write conflict returns the reloaded file", async () => {
    const shown = await host.readFile(CHECKPOINT, "main");
    const laptop = JSON.parse(shown.text);
    laptop.decision = { state: "returned", note: "from the laptop", decidedAt: NOW, decidedBy: "laptop", headSha: "abc" };
    await host.writeFile({
      path: CHECKPOINT,
      ref: "main",
      content: JSON.stringify(laptop, null, 2) + "\n",
      message: "laptop",
      baseSha: shown.sha,
    });
    const result = await decide(host, {
      ref: "main",
      change: "add-user-auth",
      state: "returned",
      note: "from the phone",
      baseSha: shown.sha,
      headSha: "x",
      now: NOW,
    });
    expect(result.ok).toBe(false);
    if (result.ok || result.reason !== "conflict") throw new Error("expected conflict");
    expect(result.message).toBe("The decision file changed on main; reloaded");
    expect(result.reloaded.decision).toMatchObject({ state: "returned", note: "from the laptop" });
    expect(JSON.parse((await host.readFile(CHECKPOINT, "main")).text).decision.note).toBe("from the laptop");
  });

  it("refuses to overwrite an unreadable checkpoint.json", async () => {
    const shown = await host.readFile(CHECKPOINT, "main");
    await host.writeFile({ path: CHECKPOINT, ref: "main", content: "{broken", message: "m", baseSha: shown.sha });
    const broken = await host.readFile(CHECKPOINT, "main");
    const result = await decide(host, {
      ref: "main",
      change: "add-user-auth",
      state: "returned",
      note: "n",
      baseSha: broken.sha,
      headSha: "x",
      now: NOW,
    });
    expect(result).toMatchObject({ ok: false, reason: "checkpoint_unreadable" });
    expect((await host.readFile(CHECKPOINT, "main")).text).toBe("{broken");
  });
});
