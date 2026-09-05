/**
 * Task and wave counts computed from `tasks.md` on the ref (design D20),
 * with the same regexes Interlock's `lib/artifacts.mjs` uses so the phone
 * counts exactly what `interlock tasks` would.
 */

// A tasks.md checkbox line: "- [ ] 1.1 Do the thing" / "- [x] ..."
const TASK_LINE = /^\s*[-*]\s*\[( |x|X)\]\s*(.+?)\s*$/;

// The leading `1.2` / `1.2.3` of a checkbox line.
const TASK_ID = /^(\d+(?:\.\d+)*)(?:\s|$)/;

// A wave heading: "## 1. Foundation". Only numbered second-level headings count.
const WAVE_HEADING = /^##\s+\d+\.(?:\s|$)/;

export interface TaskItem {
  id: string | null;
  text: string;
  done: boolean;
  /** 1-based line in the source text. */
  line: number;
}

export interface ParsedTasks {
  total: number;
  done: number;
  waves: number;
  tasks: TaskItem[];
}

export function parseTasks(markdown: string | null | undefined): ParsedTasks {
  const tasks: TaskItem[] = [];
  let waves = 0;
  const lines = (markdown || "").split("\n");
  lines.forEach((line, i) => {
    if (WAVE_HEADING.test(line)) {
      waves += 1;
      return;
    }
    const m = TASK_LINE.exec(line);
    if (!m) return;
    const idMatch = TASK_ID.exec(m[2]);
    tasks.push({
      done: m[1].toLowerCase() === "x",
      text: m[2],
      id: idMatch ? idMatch[1] : null,
      line: i + 1,
    });
  });
  return {
    total: tasks.length,
    done: tasks.filter((t) => t.done).length,
    waves,
    tasks,
  };
}
