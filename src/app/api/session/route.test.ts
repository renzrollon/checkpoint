// @vitest-environment node
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { SESSION_COOKIE, verifySession } from "@/lib/auth/session";
import { DELETE, POST } from "./route";

const KEY = "the-access-key";
const ORIGIN = "https://checkpoint.example";
/** What Next reports as `request.url` when the server is bound to 0.0.0.0. */
const BIND_ORIGIN = "http://0.0.0.0:3200";
/** What it reports behind a tunnel that forwards to localhost. */
const TUNNEL_BIND_ORIGIN = "http://localhost:3000";
/** The address the phone actually used; Next does not derive the URL from it. */
const PHONE_HOST = "192.168.7.42:3200";

function post(
  body: Record<string, string>,
  init: { origin?: string; query?: string; headers?: Record<string, string> } = {},
) {
  const form = new URLSearchParams(body);
  const headers = new Headers({ "content-type": "application/x-www-form-urlencoded", ...(init.headers ?? {}) });
  return new NextRequest(`${init.origin ?? ORIGIN}/api/session${init.query ?? ""}`, {
    method: "POST",
    headers,
    body: form.toString(),
  });
}

/** A request as it reaches a server bound to 0.0.0.0 from a phone on the LAN. */
function fromPhone(body: Record<string, string>, extraHeaders: Record<string, string> = {}) {
  return post(body, { origin: BIND_ORIGIN, headers: { host: PHONE_HOST, ...extraHeaders } });
}

function cookieAttrs(res: Response): string {
  return (res.headers.get("set-cookie") ?? "").toLowerCase();
}

/** A Location the browser resolves against its own origin: a path, never a URL. */
function expectRelativeLocation(res: Response, expected: string) {
  const location = res.headers.get("location");
  expect(location).toBe(expected);
  expect(location).not.toContain("://");
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
    expectRelativeLocation(res, "/changes/add-user-auth");
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
    expectRelativeLocation(await POST(post({ key: KEY })), "/");
    expectRelativeLocation(await POST(post({ key: KEY, next: "//evil.example" })), "/");
    expectRelativeLocation(await POST(post({ key: KEY, next: "https://evil.example/x" })), "/");
    expectRelativeLocation(await POST(post({ key: KEY, next: "/login" })), "/");
  });

  it("the redirect does not depend on how the server was addressed", async () => {
    const cases: Array<[string | undefined, string]> = [
      ["/changes/add-user-auth", "/changes/add-user-auth"],
      ["/", "/"],
      ["/changes/x", "/changes/x"],
      ["//evil.example", "/"],
      ["https://evil.example/x", "/"],
      ["/login", "/"],
      [undefined, "/"],
    ];
    for (const [next, expected] of cases) {
      const res = await POST(fromPhone(next === undefined ? { key: KEY } : { key: KEY, next }));
      expect(res.status, String(next)).toBe(303);
      expectRelativeLocation(res, expected);
      // The bind address the server sees must not leak into the header.
      expect(res.headers.get("location")).not.toContain("0.0.0.0");
      expect(res.headers.get("location")).not.toContain("localhost");
      // The session is still issued on the very same response.
      expect(verifySession(KEY, res.cookies.get(SESSION_COOKIE)?.value)).toBe("valid");
    }
  });

  it("ignores a forwarding proxy's idea of the host and scheme", async () => {
    const res = await POST(
      fromPhone(
        { key: KEY, next: "/changes/x" },
        { "x-forwarded-proto": "https", "x-forwarded-host": "checkpoint.example.app" },
      ),
    );
    expect(res.status).toBe(303);
    expectRelativeLocation(res, "/changes/x");
    expect(res.headers.get("location")).not.toContain("checkpoint.example.app");
  });

  it("stays relative behind a tunnel that reaches localhost", async () => {
    const res = await POST(
      post({ key: KEY, next: "/changes/x" }, { origin: TUNNEL_BIND_ORIGIN, headers: { host: PHONE_HOST } }),
    );
    expect(res.status).toBe(303);
    expectRelativeLocation(res, "/changes/x");
  });

  it("the Secure attribute follows the transport, not the header", async () => {
    expect(process.env.NODE_ENV).not.toBe("production");
    const overHttp = await POST(fromPhone({ key: KEY, next: "/" }));
    expect(cookieAttrs(overHttp)).toContain(`${SESSION_COOKIE}=v1.`);
    expect(cookieAttrs(overHttp)).not.toContain("secure");

    const overHttps = await POST(post({ key: KEY, next: "/" }));
    expect(cookieAttrs(overHttps)).toContain("secure");
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
    expectRelativeLocation(res, "/x");
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
