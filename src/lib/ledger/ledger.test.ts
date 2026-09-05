import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { answerRow, isEmptyCell, parseLedger, serializeLedger, summarize } from "./ledger";

const FIXTURES = join(process.cwd(), "fixtures", "ledger");
const names = readdirSync(FIXTURES)
  .filter((f) => f.endsWith(".md") && !f.endsWith(".serialized.md"))
  .map((f) => f.replace(/\.md$/, ""));

const read = (file: string) => readFileSync(join(FIXTURES, file), "utf8");

describe("golden fixtures from Interlock", () => {
  it("has the five hand-written fixtures", () => {
    expect(names.sort()).toEqual(["basic", "escaped-pipe", "hedges", "missing-columns", "unparseable"]);
  });

  for (const name of names) {
    it(`${name}: parse equals the golden parse`, () => {
      const parsed = parseLedger(read(`${name}.md`));
      const golden = JSON.parse(read(`${name}.parsed.json`));
      expect(JSON.parse(JSON.stringify(parsed))).toEqual(golden);
    });

    it(`${name}: serialize is byte-identical to the golden serializer`, () => {
      const parsed = parseLedger(read(`${name}.md`));
      const out = serializeLedger(parsed.change, parsed.rows);
      expect(out).toBe(read(`${name}.serialized.md`));
    });

    it(`${name}: serialize → parse → serialize is stable`, () => {
      const parsed = parseLedger(read(`${name}.md`));
      const once = serializeLedger(parsed.change, parsed.rows);
      const twice = serializeLedger(parseLedger(once).change, parseLedger(once).rows);
      expect(twice).toBe(once);
    });
  }
});

describe("isEmptyCell", () => {
  it("treats placeholders and hedges as empty", () => {
    for (const v of ["", " ", "-", "—", "n/a", "TBD", "Obvious.", "see above", "Standard practice."]) {
      expect(isEmptyCell(v), v).toBe(true);
    }
  });
  it("keeps substantive cells that merely contain a hedge word", () => {
    expect(isEmptyCell("lib/session.ts:42 — the obvious existing helper")).toBe(false);
  });
});

describe("hedge cells", () => {
  it("read as empty and invalidate an agent_resolved row", () => {
    const parsed = parseLedger(read("hedges.md"));
    const d1 = parsed.rows.find((r) => r.id === "D1")!;
    const d2 = parsed.rows.find((r) => r.id === "D2")!;
    expect(d1.evidence).toBe("");
    expect(d2.evidence).toBe("");
    expect(d1.valid).toBe(false);
    expect(d1.problems).toContain("agent_resolved without evidence");
    expect(d2.valid).toBe(false);
    const d3 = parsed.rows.find((r) => r.id === "D3")!;
    expect(d3.valid).toBe(true);
  });
});

describe("unparseable ledger", () => {
  it("is reported, not emptied", () => {
    const parsed = parseLedger(read("unparseable.md"));
    expect(parsed.parseable).toBe(false);
    expect(parsed.rows).toEqual([]);
    const s = summarize({ ...parsed, exists: true });
    expect(s.unparseable).toBe(true);
    expect(s.blocking).toBe(true);
    expect(s.total).toBe(0);
  });

  it("offers no rows to answer", () => {
    const result = answerRow(read("unparseable.md"), { id: "D1", answer: "x", today: "2026-09-05" });
    expect(result).toMatchObject({ ok: false, reason: "unparseable" });
  });
});

describe("summarize", () => {
  it("counts the change-reading spec example: 1 needs you, 3 resolved, 1 invalid, of 5 rows", () => {
    const text = [
      "# Decisions — x",
      "",
      "| id | question | class | resolution | evidence |",
      "|----|----|----|----|----|",
      "| D1 | q1 | needs_human | — | — |",
      "| D2 | q2 | agent_resolved | r | e |",
      "| D3 | q3 | agent_resolved | r | e |",
      "| D4 | q4 | agent_resolved | r | e |",
      "| D5 | q5 | agent_resolved | r | — |",
      "",
    ].join("\n");
    const s = summarize(parseLedger(text));
    expect(s).toMatchObject({ total: 5, needsHuman: 1, agentResolved: 3, invalid: 1, blocking: true });
  });

  it("a missing ledger blocks and is missing, not empty", () => {
    const s = summarize({ exists: false, rows: [], invalid: [] });
    expect(s.missing).toBe(true);
    expect(s.blocking).toBe(true);
    expect(s.unparseable).toBe(false);
  });

  it("a clear ledger does not block", () => {
    const parsed = parseLedger(read("basic.md"));
    const rows = parsed.rows.filter((r) => r.class === "agent_resolved");
    expect(summarize({ rows, invalid: [], parseable: true }).blocking).toBe(false);
  });
});

describe("answerRow", () => {
  const D1_QUESTION =
    "How is the reader app itself gated: a shared access key exchanged for an httpOnly session cookie, Vercel Deployment Protection, or Cloudflare Access?";

  it("produces the exact D1 row and leaves every other line byte-identical", () => {
    const before = read("basic.md");
    const result = answerRow(before, { id: "D1", answer: "shared access key cookie", today: "2026-09-05" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const beforeLines = before.split("\n");
    const afterLines = result.text.split("\n");
    expect(afterLines.length).toBe(beforeLines.length);
    const changed = afterLines.map((l, i) => (l === beforeLines[i] ? null : i)).filter((i) => i !== null);
    expect(changed).toEqual([result.line - 1]);
    expect(afterLines[result.line - 1]).toBe(
      `| D1 | ${D1_QUESTION} | agent_resolved | shared access key cookie | human decision 2026-09-05 via Checkpoint |`,
    );
    expect(result.row).toMatchObject({
      id: "D1",
      class: "agent_resolved",
      resolution: "shared access key cookie",
      evidence: "human decision 2026-09-05 via Checkpoint",
      valid: true,
    });
    // The written file still parses clean under Interlock's grammar.
    const reparsed = parseLedger(result.text);
    expect(reparsed.invalid).toEqual([]);
    expect(summarize(reparsed).blocking).toBe(false);
  });

  it("takes the date from a Date in UTC", () => {
    const result = answerRow(read("basic.md"), {
      id: "D1",
      answer: "cookie",
      today: new Date("2026-09-05T23:59:00Z"),
    });
    expect(result.ok && result.row.evidence).toBe("human decision 2026-09-05 via Checkpoint");
  });

  it("escapes a pipe in the answer and the row stays valid with five columns", () => {
    const result = answerRow(read("basic.md"), { id: "D1", answer: "cookie | 30 days", today: "2026-09-05" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const line = result.text.split("\n")[result.line - 1];
    expect(line).toContain("| cookie \\| 30 days |");
    expect(result.row.resolution).toBe("cookie | 30 days");
    expect(result.row.valid).toBe(true);
    expect(result.row.problems).toEqual([]);
  });

  it("an escaped pipe in the question survives the edit", () => {
    const before = read("escaped-pipe.md");
    const result = answerRow(before, { id: "D1", answer: "keep it whole", today: "2026-09-05" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const line = result.text.split("\n")[result.line - 1];
    expect(line).toContain("`a \\| b`");
    const reparsed = parseLedger(result.text);
    expect(reparsed.rows.every((r) => r.problems.every((p) => !p.startsWith("expected 5 columns")))).toBe(true);
    expect(reparsed.rows.find((r) => r.id === "D1")!.question).toBe("Should the row split on `a | b` or keep it whole?");
  });

  it("collapses newlines in the answer to spaces", () => {
    const result = answerRow(read("basic.md"), { id: "D1", answer: "a\nb\r\n  c", today: "2026-09-05" });
    expect(result.ok && result.row.resolution).toBe("a b c");
  });

  it("refuses a blank answer", () => {
    const result = answerRow(read("basic.md"), { id: "D1", answer: "   \n ", today: "2026-09-05" });
    expect(result).toMatchObject({ ok: false, reason: "blank_answer", message: "An answer is required" });
  });

  it("refuses a row that is not waiting on a person", () => {
    const result = answerRow(read("basic.md"), { id: "D2", answer: "x", today: "2026-09-05" });
    expect(result).toMatchObject({ ok: false, reason: "not_needs_human", message: "D2 is not waiting on a person" });
  });

  it("refuses an unknown row", () => {
    const result = answerRow(read("basic.md"), { id: "D9", answer: "x", today: "2026-09-05" });
    expect(result).toMatchObject({ ok: false, reason: "not_found" });
  });
});
