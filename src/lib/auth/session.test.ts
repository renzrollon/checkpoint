// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  SESSION_TTL_SECONDS,
  constantTimeEqual,
  keyMatches,
  makeSession,
  safeNextPath,
  verifySession,
} from "./session";

const KEY = "correct horse battery staple";
const NOW = Date.parse("2026-09-05T04:00:00Z");

describe("makeSession / verifySession", () => {
  it("round-trips a fresh session", () => {
    const s = makeSession(KEY, NOW);
    expect(s.value).toMatch(/^v1\.\d+\.[0-9a-f]{64}$/);
    expect(s.maxAge).toBe(SESSION_TTL_SECONDS);
    expect(s.expires.getTime()).toBe((Math.floor(NOW / 1000) + SESSION_TTL_SECONDS) * 1000);
    expect(verifySession(KEY, s.value, NOW)).toBe("valid");
    expect(verifySession(KEY, s.value, NOW + 29 * 24 * 3600 * 1000)).toBe("valid");
  });

  it("a missing cookie is missing", () => {
    expect(verifySession(KEY, undefined, NOW)).toBe("missing");
    expect(verifySession(KEY, "", NOW)).toBe("missing");
  });

  it("a tampered tag is rejected", () => {
    const s = makeSession(KEY, NOW);
    const [v, exp, tag] = s.value.split(".");
    const flipped = (tag[0] === "0" ? "1" : "0") + tag.slice(1);
    expect(verifySession(KEY, `${v}.${exp}.${flipped}`, NOW)).toBe("tampered");
  });

  it("a tampered expiry is rejected", () => {
    const s = makeSession(KEY, NOW);
    const [v, exp, tag] = s.value.split(".");
    expect(verifySession(KEY, `${v}.${Number(exp) + 1}.${tag}`, NOW)).toBe("tampered");
  });

  it("a cookie signed with another key is rejected", () => {
    expect(verifySession(KEY, makeSession("other").value, NOW)).toBe("tampered");
  });

  it("garbage is rejected", () => {
    for (const v of ["v1", "v1.abc.def", "v2.1.aa", "v1.1.zz", "..."]) {
      expect(verifySession(KEY, v, NOW), v).toBe("tampered");
    }
  });

  it("an expired session is expired, not tampered", () => {
    const s = makeSession(KEY, NOW);
    expect(verifySession(KEY, s.value, NOW + (SESSION_TTL_SECONDS + 1) * 1000)).toBe("expired");
    expect(verifySession(KEY, s.value, s.expires.getTime())).toBe("expired");
  });

  it("no configured key verifies nothing", () => {
    expect(verifySession(undefined, makeSession(KEY, NOW).value, NOW)).toBe("tampered");
  });
});

describe("keyMatches", () => {
  it("accepts only the exact key", () => {
    expect(keyMatches(KEY, KEY)).toBe(true);
    expect(keyMatches(KEY, KEY + " ")).toBe(false);
    expect(keyMatches(KEY, KEY.slice(0, -1))).toBe(false);
    expect(keyMatches(KEY, "")).toBe(false);
    expect(keyMatches(KEY, undefined)).toBe(false);
  });

  it("refuses everything when no key is configured", () => {
    expect(keyMatches(undefined, "")).toBe(false);
    expect(keyMatches("", "")).toBe(false);
    expect(keyMatches("  ", "  ")).toBe(false);
  });

  it("compares in constant time over unequal lengths", () => {
    expect(constantTimeEqual("abc", "abcd")).toBe(false);
    expect(constantTimeEqual("abc", "abc")).toBe(true);
  });
});

describe("safeNextPath", () => {
  it("keeps same-origin paths and drops everything else", () => {
    expect(safeNextPath("/changes/add-user-auth?ref=feat%2Fauth")).toBe("/changes/add-user-auth?ref=feat%2Fauth");
    expect(safeNextPath("//evil.example")).toBe("/");
    expect(safeNextPath("https://evil.example")).toBe("/");
    expect(safeNextPath("/login?next=/x")).toBe("/");
    expect(safeNextPath(undefined)).toBe("/");
    expect(safeNextPath("/x\r\nSet-Cookie: a=b")).toBe("/");
  });
});
