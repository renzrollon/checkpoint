import { describe, expect, it } from "vitest";
import type { Comparison } from "../githost/types";
import { classifyFreshness } from "./freshness";

const C = "add-user-auth";
const base = `openspec/changes/${C}`;
const cmp = (status: Comparison["status"], files: string[], truncated = false): Comparison => ({ status, files, truncated });
const run = (comparison: Comparison | undefined, recordedHead = "a", currentHead = "b") =>
  classifyFreshness({ recordedHead, currentHead, comparison, change: C });

describe("classifyFreshness", () => {
  it("equal heads are fresh without a comparison", () => {
    expect(run(undefined, "a", "a")).toBe("fresh");
  });
  it("ahead touching only this change's decisions.md and checkpoint.json is fresh", () => {
    expect(run(cmp("ahead", [`${base}/decisions.md`, `${base}/checkpoint.json`]))).toBe("fresh");
  });
  it("identical is fresh", () => {
    expect(run(cmp("identical", []))).toBe("fresh");
  });
  it("ahead touching design.md is stale", () => {
    expect(run(cmp("ahead", [`${base}/design.md`]))).toBe("stale");
  });
  it("ahead touching another change's checkpoint.json is stale", () => {
    expect(run(cmp("ahead", ["openspec/changes/other/checkpoint.json"]))).toBe("stale");
  });
  it("behind is stale", () => {
    expect(run(cmp("behind", []))).toBe("stale");
  });
  it("diverged is stale", () => {
    expect(run(cmp("diverged", []))).toBe("stale");
  });
  it("truncated is stale", () => {
    expect(run(cmp("ahead", [`${base}/checkpoint.json`], true))).toBe("stale");
  });
  it("an absent comparison is stale", () => {
    expect(run(undefined)).toBe("stale");
  });
});
