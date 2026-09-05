// @vitest-environment node
import { describe, expect, it } from "vitest";
import { redirectToPath } from "./redirect";

describe("redirectToPath", () => {
  it("sends a plain path through unchanged", async () => {
    const res = redirectToPath("/changes/add-user-auth", 303);
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("/changes/add-user-auth");
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.text()).toBe("");
  });

  it("keeps a query string verbatim", () => {
    const res = redirectToPath("/login?next=%2Fchanges%2Fx%3Fref%3Dfeat%2Fauth", 307);
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("/login?next=%2Fchanges%2Fx%3Fref%3Dfeat%2Fauth");
  });

  it("never emits a Location that leaves the origin", () => {
    for (const path of ["//evil.example", "https://evil.example", "/\\evil.example", "", "changes/x", "/x\nSet-Cookie: a=b"]) {
      expect(() => redirectToPath(path, 303), JSON.stringify(path)).toThrow(/same-origin path/);
    }
  });
});
