// @vitest-environment node
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { SESSION_COOKIE, makeSession } from "@/lib/auth/session";
import { proxy } from "./proxy";

const KEY = "the-access-key";
const ORIGIN = "https://checkpoint.example";
/** What Next reports as `request.url` when the server is bound to 0.0.0.0. */
const BIND_ORIGIN = "http://0.0.0.0:3200";
/** What it reports behind a tunnel that forwards to localhost. */
const TUNNEL_BIND_ORIGIN = "http://localhost:3000";
/** The address the phone actually used; Next does not derive the URL from it. */
const PHONE_HOST = "192.168.7.42:3200";

function req(
  path: string,
  init: { method?: string; cookie?: string; headers?: Record<string, string>; origin?: string } = {},
) {
  const headers = new Headers(init.headers ?? {});
  if (init.cookie !== undefined) headers.set("cookie", `${SESSION_COOKIE}=${init.cookie}`);
  return new NextRequest(`${init.origin ?? ORIGIN}${path}`, { method: init.method ?? "GET", headers });
}

/** A request as it reaches a server bound to 0.0.0.0 from a phone on the LAN. */
function fromPhone(path: string, init: { cookie?: string; origin?: string } = {}) {
  return req(path, { ...init, origin: init.origin ?? BIND_ORIGIN, headers: { host: PHONE_HOST } });
}

function clearedCookie(res: Response): boolean {
  const set = res.headers.get("set-cookie") ?? "";
  return set.includes(`${SESSION_COOKIE}=`) && /max-age=0|expires=thu, 01 jan 1970/i.test(set);
}

/** A Location the browser resolves against its own origin: a path, never a URL. */
function expectRelativeLocation(res: Response, expected: string) {
  const location = res.headers.get("location");
  expect(location).toBe(expected);
  expect(location).not.toContain("://");
}

describe("proxy with a configured key", () => {
  beforeEach(() => {
    process.env.CHECKPOINT_ACCESS_KEY = KEY;
  });
  afterEach(() => {
    delete process.env.CHECKPOINT_ACCESS_KEY;
  });

  it("redirects an unauthenticated page request to login with next preserved", () => {
    const res = proxy(req("/changes/add-user-auth"));
    expect(res.status).toBe(307);
    expectRelativeLocation(res, "/login?next=%2Fchanges%2Fadd-user-auth");
    expect(res.headers.get("set-cookie")).toBeNull();
  });

  it("keeps the query string in next", () => {
    const res = proxy(req("/changes/add-user-auth?ref=feat/auth"));
    expectRelativeLocation(res, "/login?next=%2Fchanges%2Fadd-user-auth%3Fref%3Dfeat%2Fauth");
  });

  it("the redirect ignores the server's bind address", () => {
    const plain = proxy(fromPhone("/changes/add-user-auth"));
    expect(plain.status).toBe(307);
    expectRelativeLocation(plain, "/login?next=%2Fchanges%2Fadd-user-auth");

    const withQuery = proxy(fromPhone("/changes/add-user-auth?ref=feat/auth"));
    expect(withQuery.status).toBe(307);
    expectRelativeLocation(withQuery, "/login?next=%2Fchanges%2Fadd-user-auth%3Fref%3Dfeat%2Fauth");

    for (const res of [plain, withQuery]) {
      expect(res.headers.get("location")).not.toContain("0.0.0.0");
      expect(res.headers.get("location")).not.toContain(PHONE_HOST);
    }
  });

  it("stays relative behind a tunnel that reaches localhost", () => {
    const res = proxy(fromPhone("/changes/add-user-auth", { origin: TUNNEL_BIND_ORIGIN }));
    expect(res.status).toBe(307);
    expectRelativeLocation(res, "/login?next=%2Fchanges%2Fadd-user-auth");
    expect(res.headers.get("location")).not.toContain("localhost");
  });

  it("answers 401 JSON for an unauthenticated API request", async () => {
    const res = proxy(req("/api/anything", { method: "POST" }));
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "unauthenticated" });
  });

  it("answers 401 JSON for an unauthenticated server-action post", async () => {
    const res = proxy(req("/changes/add-user-auth", { method: "POST", headers: { "next-action": "abc123" } }));
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "unauthenticated" });
  });

  it("treats a tampered cookie as unauthenticated and clears it", () => {
    const res = proxy(req("/changes/add-user-auth", { cookie: "v1.9999999999.deadbeef" }));
    expect(res.status).toBe(307);
    expect(clearedCookie(res)).toBe(true);
  });

  it("clears a tampered cookie on the relative redirect too", () => {
    const res = proxy(fromPhone("/changes/add-user-auth", { cookie: "v1.9999999999.deadbeef" }));
    expect(res.status).toBe(307);
    expectRelativeLocation(res, "/login?next=%2Fchanges%2Fadd-user-auth");
    expect(clearedCookie(res)).toBe(true);
  });

  it("treats an expired cookie as unauthenticated and clears it", () => {
    const old = makeSession(KEY, Date.now() - 31 * 24 * 3600 * 1000);
    const res = proxy(req("/", { cookie: old.value }));
    expect(res.status).toBe(307);
    expect(clearedCookie(res)).toBe(true);
  });

  it("lets a valid session through", () => {
    const res = proxy(req("/changes/add-user-auth", { cookie: makeSession(KEY).value }));
    expect(res.status).toBe(200);
    expect(res.headers.get("x-middleware-next")).toBe("1");
  });

  it("exempts login, the session endpoint, the manifest and icons", () => {
    for (const path of ["/login", "/login?next=/x", "/api/session", "/manifest.webmanifest", "/icons/icon-192.png"]) {
      const res = proxy(req(path, { method: path === "/api/session" ? "POST" : "GET" }));
      expect(res.status, path).toBe(200);
    }
  });
});

describe("proxy without a configured key", () => {
  beforeEach(() => {
    delete process.env.CHECKPOINT_ACCESS_KEY;
  });

  it("answers 503 with the configuration message on gated routes and on login", async () => {
    for (const path of ["/", "/changes/x", "/login", "/api/session"]) {
      const res = proxy(req(path, { method: path === "/api/session" ? "POST" : "GET" }));
      expect(res.status, path).toBe(503);
      expect(await res.text()).toBe("Checkpoint has no access key configured");
    }
  });

  it("still serves the manifest and icons", () => {
    expect(proxy(req("/manifest.webmanifest")).status).toBe(200);
    expect(proxy(req("/icons/icon-512.png")).status).toBe(200);
  });

  it("a blank key counts as no key", () => {
    process.env.CHECKPOINT_ACCESS_KEY = "   ";
    expect(proxy(req("/")).status).toBe(503);
    delete process.env.CHECKPOINT_ACCESS_KEY;
  });
});
