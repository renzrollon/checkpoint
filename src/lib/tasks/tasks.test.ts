import { describe, expect, it } from "vitest";
import { parseTasks } from "./tasks";

describe("parseTasks", () => {
  it("counts 4 of 12 tasks and 3 waves", () => {
    const lines: string[] = [];
    let n = 0;
    for (let wave = 1; wave <= 3; wave += 1) {
      lines.push(`## ${wave}. Wave ${wave}`, "");
      for (let t = 1; t <= 4; t += 1) {
        n += 1;
        lines.push(`- [${n <= 4 ? "x" : " "}] ${wave}.${t} Task ${n}`);
      }
      lines.push("");
    }
    const parsed = parseTasks(lines.join("\n"));
    expect(parsed.total).toBe(12);
    expect(parsed.done).toBe(4);
    expect(parsed.waves).toBe(3);
    expect(parsed.tasks[0]).toEqual({ id: "1.1", text: "1.1 Task 1", done: true, line: 3 });
  });

  it("a file with no section headings has zero waves", () => {
    const parsed = parseTasks("- [ ] 1 one\n- [x] 2 two\n");
    expect(parsed.waves).toBe(0);
    expect(parsed.total).toBe(2);
    expect(parsed.done).toBe(1);
  });

  it("upper-case [X] counts as done", () => {
    const parsed = parseTasks("- [X] 1.1 shouted\n* [x] 1.2 starred\n");
    expect(parsed.done).toBe(2);
    expect(parsed.total).toBe(2);
  });

  it("bullets that are not checkboxes are not tasks", () => {
    const parsed = parseTasks(["## 1. Only wave", "- a plain bullet", "- [ ]", "- [ ] 1.1 real", "- [y] 1.2 not a box", "  - [ ] 1.3 nested"].join("\n"));
    expect(parsed.total).toBe(2);
    expect(parsed.tasks.map((t) => t.id)).toEqual(["1.1", "1.3"]);
    expect(parsed.waves).toBe(1);
  });

  it("only numbered second-level headings are waves", () => {
    const parsed = parseTasks(["# 1. title", "## Intro", "## 2. real", "### 3. deeper", "## 4.5 not a wave", "## 6."].join("\n"));
    expect(parsed.waves).toBe(2);
  });

  it("a task without a leading id has id null", () => {
    expect(parseTasks("- [ ] Write the thing").tasks[0].id).toBeNull();
  });

  it("tolerates empty input", () => {
    expect(parseTasks(null)).toEqual({ total: 0, done: 0, waves: 0, tasks: [] });
  });
});
