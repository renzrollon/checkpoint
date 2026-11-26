import { describe, expect, it } from "vitest";
import { locationHref, resolveRepo } from "./repo";

const repos = ["renzrollon/interlock", "renzrollon/checkpoint"];

describe("resolveRepo", () => {
  it("returns the configured entry for a case-different value", () => {
    expect(resolveRepo("RenzRollon/Interlock", repos)).toEqual({
      ok: true,
      repo: "renzrollon/interlock",
    });
  });

  it("trims surrounding whitespace", () => {
    expect(resolveRepo("  renzrollon/checkpoint\t", repos)).toEqual({
      ok: true,
      repo: "renzrollon/checkpoint",
    });
  });

  it("returns the default for an absent, null or blank value", () => {
    for (const raw of [undefined, null, "", "   "]) {
      expect(resolveRepo(raw, repos)).toEqual({ ok: true, repo: "renzrollon/interlock" });
    }
  });

  it("reports an unknown repository, never the default", () => {
    expect(resolveRepo(" someone/else ", repos)).toEqual({ ok: false, requested: "someone/else" });
  });

  it("does not match a prefix of an entry", () => {
    expect(resolveRepo("renzrollon/inter", repos)).toEqual({
      ok: false,
      requested: "renzrollon/inter",
    });
  });
});

describe("locationHref", () => {
  it("encodes repo and ref", () => {
    expect(locationHref("/", { repo: "renzrollon/interlock", ref: "main" })).toBe(
      "/?repo=renzrollon%2Finterlock&ref=main",
    );
  });

  it("encodes a ref containing a slash", () => {
    expect(
      locationHref("/changes/add-user-auth", {
        repo: "renzrollon/interlock",
        ref: "carlrollon/sunstar",
      }),
    ).toBe("/changes/add-user-auth?repo=renzrollon%2Finterlock&ref=carlrollon%2Fsunstar");
  });

  it("omits a missing value", () => {
    expect(locationHref("/", { repo: "a/b" })).toBe("/?repo=a%2Fb");
    expect(locationHref("/", { ref: "main" })).toBe("/?ref=main");
    expect(locationHref("/", {})).toBe("/");
    expect(locationHref("/")).toBe("/");
  });
});
