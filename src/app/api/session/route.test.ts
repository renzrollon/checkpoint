// @vitest-environment node
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { SESSION_COOKIE, verifySession } from "@/lib/auth/session";
import { DELETE, POST } from "./route";

const KEY = "the-access-key";
const ORIGIN = "https://checkpoint.example";

function post(body: Record<string, string>, query = "") {
  const form = new URLSearchParams(body);
  return new NextRequest(`${ORIGIN}/api/session${query}`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: form.toString(),
  });
}

function cookieAttrs(res: Response): string {
  return (res.headers.get("set-cookie") ?? "").toLowerCase();
}

describe("POST /api/session", () => {
  beforeEach(() => {
    process.env.CHECKPOINT_ACCESS_KEY = KEY;
  });
  afterEach(() => {
    delete process.env.CHECKPOINT_ACCESS_KEY;
  });

  it("the correct key issues a session and redirects to next", async () => {
    const res = await POST(post({ key: KEY, next: "/changes/add-user-auth" }));
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe(`${ORIGIN}/changes/add-user-auth`);
    const attrs = cookieAttrs(res);
    expect(attrs).toContain(`${SESSION_COOKIE}=v1.`);
    expect(attrs).toContain("httponly");
    expect(attrs).toContain("secure");
    expect(attrs).toContain("samesite=lax");
    expect(attrs).toContain(`max-age=${30 * 24 * 3600}`);
    const value = res.cookies.get(SESSION_COOKIE)?.value;
    expect(verifySession(KEY, value)).toBe("valid");
  });

  it("redirects to the inbox when next is absent or unsafe", async () => {
    expect((await POST(post({ key: KEY }))).headers.get("location")).toBe(`${ORIGIN}/`);
    expect((await POST(post({ key: KEY, next: "//evil.example" }))).headers.get("location")).toBe(`${ORIGIN}/`);
  });

  it("accepts JSON too", async () => {
    const res = await POST(
      new NextRequest(`${ORIGIN}/api/session`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ key: KEY, next: "/x" }),
      }),
    );
    expect(res.status).toBe(303);
  });

  it("a wrong key is refused with 401 and no cookie", async () => {
    for (const wrong of [KEY + "x", KEY.slice(1), "", KEY.toUpperCase()]) {
      const res = await POST(post({ key: wrong, next: "/changes/add-user-auth" }));
      expect(res.status, JSON.stringify(wrong)).toBe(401);
      expect(res.headers.get("set-cookie")).toBeNull();
      expect(await res.json()).toEqual({ error: "That key was not accepted" });
    }
  });

  it("no configured key blocks login with 503 and no cookie", async () => {
    delete process.env.CHECKPOINT_ACCESS_KEY;
    const res = await POST(post({ key: "anything" }));
    expect(res.status).toBe(503);
    expect(await res.text()).toBe("Checkpoint has no access key configured");
    expect(res.headers.get("set-cookie")).toBeNull();
  });
});

describe("DELETE /api/session", () => {
  it("clears the session cookie", async () => {
    const res = await DELETE();
    expect(res.status).toBe(200);
    const attrs = cookieAttrs(res);
    expect(attrs).toContain(`${SESSION_COOKIE}=;`);
    expect(attrs).toMatch(/max-age=0/);
  });
});
