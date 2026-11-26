// @vitest-environment node
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { SESSION_COOKIE, makeSession } from "@/lib/auth/session";
import { getRelativeURL } from "next/dist/shared/lib/router/utils/relativize-url";
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

/**
 * The Location the client receives: Next's proxy adapter rewrites a redirect on
 * the request's own host with this same `getRelativeURL` before it leaves the
 * server (and crashes on a bare path, which is why the proxy hands it an
 * absolute URL). The browser then resolves a path, never a URL.
 */
function wireLocation(res: Response, request: NextRequest): string | null {
  const location = res.headers.get("location");
  if (location === null) return null;
  expect(new URL(location).host).toBe(new URL(request.url).host);
  return getRelativeURL(location, request.url);
}

function expectRelativeLocation(res: Response, expected: string, request: NextRequest) {
  const location = wireLocation(res, request);
  expect(location).toBe(expected);
  expect(location).not.toContain("://");
}

/** Run the proxy and assert the wire Location in one step. */
function redirected(request: NextRequest) {
  const res = proxy(request);
  return { res, expectLocation: (expected: string) => expectRelativeLocation(res, expected, request), wire: () => wireLocation(res, request) };
}

describe("proxy with a configured key", () => {
  beforeEach(() => {
    process.env.CHECKPOINT_ACCESS_KEY = KEY;
  });
  afterEach(() => {
    delete process.env.CHECKPOINT_ACCESS_KEY;
  });

  it("redirects an unauthenticated page request to login with next preserved", () => {
    const { res, expectLocation } = redirected(req("/changes/add-user-auth"));
    expect(res.status).toBe(307);
    expectLocation("/login?next=%2Fchanges%2Fadd-user-auth");
    expect(res.headers.get("set-cookie")).toBeNull();
  });

  it("keeps the query string in next", () => {
    redirected(req("/changes/add-user-auth?ref=feat/auth")).expectLocation(
      "/login?next=%2Fchanges%2Fadd-user-auth%3Fref%3Dfeat%2Fauth",
    );
  });

  it("keeps a push link's repo and ref in next, encoded", () => {
    const { res, expectLocation, wire } = redirected(
      req("/changes/add-user-auth?repo=renzrollon%2Finterlock&ref=carlrollon%2Fsunstar"),
    );
    expect(res.status).toBe(307);
    expectLocation("/login?next=%2Fchanges%2Fadd-user-auth%3Frepo%3Drenzrollon%252Finterlock%26ref%3Dcarlrollon%252Fsunstar");
    const next = new URL(wire()!, ORIGIN).searchParams.get("next");
    expect(next).toBe("/changes/add-user-auth?repo=renzrollon%2Finterlock&ref=carlrollon%2Fsunstar");
  });

  it("hands Next an absolute Location, which its adapter requires", () => {
    const res = proxy(req("/changes/add-user-auth"));
    expect(() => new URL(res.headers.get("location")!)).not.toThrow();
  });

  it("the redirect ignores the server's bind address", () => {
    const plain = redirected(fromPhone("/changes/add-user-auth"));
    expect(plain.res.status).toBe(307);
    plain.expectLocation("/login?next=%2Fchanges%2Fadd-user-auth");

    const withQuery = redirected(fromPhone("/changes/add-user-auth?ref=feat/auth"));
    expect(withQuery.res.status).toBe(307);
    withQuery.expectLocation("/login?next=%2Fchanges%2Fadd-user-auth%3Fref%3Dfeat%2Fauth");

    for (const r of [plain, withQuery]) {
      expect(r.wire()).not.toContain("0.0.0.0");
      expect(r.wire()).not.toContain(PHONE_HOST);
    }
  });

  it("stays relative behind a tunnel that reaches localhost", () => {
    const { res, expectLocation, wire } = redirected(fromPhone("/changes/add-user-auth", { origin: TUNNEL_BIND_ORIGIN }));
    expect(res.status).toBe(307);
    expectLocation("/login?next=%2Fchanges%2Fadd-user-auth");
    expect(wire()).not.toContain("localhost");
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
    const { res, expectLocation } = redirected(fromPhone("/changes/add-user-auth", { cookie: "v1.9999999999.deadbeef" }));
    expect(res.status).toBe(307);
    expectLocation("/login?next=%2Fchanges%2Fadd-user-auth");
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
