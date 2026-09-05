import { describe, expect, it } from "vitest";
import {
  CHECKPOINT_SCHEMA,
  decisionView,
  readCheckpoint,
  riskView,
  serializeCheckpoint,
  withDecision,
} from "./checkpoint";

const HEAD = "0123456789abcdef0123456789abcdef01234567";
const OLD = "89abcdef0123456789abcdef0123456789abcdef";

const sample = {
  schema: CHECKPOINT_SCHEMA,
  change: "add-user-auth",
  request: {
    kind: "checkpoint",
    requestedAt: "2026-09-05T03:10:00Z",
    headSha: HEAD,
    risk: { class: "medium", signals: ["shared-value-transform"] },
    tasks: { total: 12, waves: 3 },
    ledger: { needsHuman: 1, agentResolved: 8, invalid: 0 },
  },
};

describe("readCheckpoint", () => {
  it("an absent file is not present and not a problem", () => {
    expect(readCheckpoint(null)).toEqual({ present: false, checkpoint: null });
  });

  it("reads the D9 contract", () => {
    const r = readCheckpoint(JSON.stringify(sample));
    expect(r.present).toBe(true);
    expect(r.checkpoint?.request?.headSha).toBe(HEAD);
    expect(r.checkpoint?.request?.risk?.class).toBe("medium");
  });

  it("tolerates an unknown risk class", () => {
    const r = readCheckpoint(JSON.stringify({ ...sample, request: { ...sample.request, risk: { class: "purple" } } }));
    expect(r.checkpoint).not.toBeNull();
    expect(riskView(r.checkpoint, HEAD)).toEqual({ state: "unobserved", raw: "purple" });
  });

  it("reports invalid JSON as a problem, not as absent", () => {
    const r = readCheckpoint("{not json");
    expect(r.present).toBe(true);
    expect(r.checkpoint).toBeNull();
    expect(r.problem).toMatch(/not JSON/);
  });

  it("reports a wrong schema as a problem", () => {
    const r = readCheckpoint(JSON.stringify({ schema: "other/9", change: "x" }));
    expect(r.checkpoint).toBeNull();
    expect(r.problem).toMatch(/interlock\.checkpoint\/1/);
  });
});

describe("riskView", () => {
  it("recorded risk is shown with its head", () => {
    const r = readCheckpoint(JSON.stringify(sample));
    expect(riskView(r.checkpoint, HEAD)).toEqual({
      state: "observed",
      class: "medium",
      headSha: HEAD,
      signals: ["shared-value-transform"],
    });
  });

  it("risk recorded for an older head is stale", () => {
    const r = readCheckpoint(JSON.stringify(sample));
    expect(riskView(r.checkpoint, OLD)).toMatchObject({
      state: "stale",
      class: "medium",
      headSha: HEAD,
      currentHeadSha: OLD,
    });
  });

  it("no recorded risk is unobserved", () => {
    expect(riskView(null, HEAD)).toEqual({ state: "unobserved" });
    const noRequest = readCheckpoint(JSON.stringify({ schema: CHECKPOINT_SCHEMA, change: "x" }));
    expect(riskView(noRequest.checkpoint, HEAD)).toEqual({ state: "unobserved" });
    const noRisk = readCheckpoint(JSON.stringify({ ...sample, request: { headSha: HEAD } }));
    expect(riskView(noRisk.checkpoint, HEAD)).toEqual({ state: "unobserved" });
  });
});

describe("withDecision", () => {
  it("unknown fields and the request survive a decision write", () => {
    const withExtra = { ...sample, vendorNote: { keep: true }, anotherField: 7 };
    const r = readCheckpoint(JSON.stringify(withExtra));
    const next = withDecision(r.checkpoint, "add-user-auth", {
      state: "approved",
      decidedAt: "2026-09-05T04:00:00Z",
      headSha: HEAD,
    });
    const written = JSON.parse(serializeCheckpoint(next));
    expect(written.vendorNote).toEqual({ keep: true });
    expect(written.anotherField).toBe(7);
    expect(written.request).toEqual(sample.request);
    expect(written.decision).toEqual({
      state: "approved",
      note: "",
      decidedAt: "2026-09-05T04:00:00Z",
      decidedBy: "checkpoint",
      headSha: HEAD,
    });
    expect(written.schema).toBe(CHECKPOINT_SCHEMA);
    expect(written.change).toBe("add-user-auth");
  });

  it("a decision replaces a previous one", () => {
    const first = withDecision(null, "add-user-auth", {
      state: "returned",
      note: "Split the auth change out",
      decidedAt: "2026-09-05T04:00:00Z",
      headSha: OLD,
    });
    expect(first.decision?.note).toBe("Split the auth change out");
    const second = withDecision(first, "add-user-auth", {
      state: "approved",
      decidedAt: "2026-09-06T04:00:00Z",
      headSha: HEAD,
    });
    expect(second.decision).toEqual({
      state: "approved",
      note: "",
      decidedAt: "2026-09-06T04:00:00Z",
      decidedBy: "checkpoint",
      headSha: HEAD,
    });
    expect(second.request).toBeUndefined();
  });

  it("starts a file when none existed", () => {
    const fresh = withDecision(null, "new-change", { state: "approved", decidedAt: "t", headSha: HEAD });
    expect(fresh).toMatchObject({ schema: CHECKPOINT_SCHEMA, change: "new-change" });
  });

  it("serialises with a trailing newline", () => {
    expect(serializeCheckpoint(withDecision(null, "x", { state: "approved", decidedAt: "t", headSha: HEAD }))).toMatch(
      /\n$/,
    );
  });
});

describe("decisionView", () => {
  it("is none without a decision", () => {
    expect(decisionView(readCheckpoint(JSON.stringify(sample)).checkpoint, HEAD)).toEqual({ state: "none" });
  });

  it("flags a decision stale when the head moved", () => {
    const cp = withDecision(null, "x", { state: "approved", decidedAt: "t", headSha: OLD });
    expect(decisionView(cp, HEAD)).toMatchObject({ state: "approved", stale: true, headSha: OLD, currentHeadSha: HEAD });
    expect(decisionView(cp, OLD)).toMatchObject({ state: "approved", stale: false });
  });
});
