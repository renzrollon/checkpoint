import { NextResponse, type NextRequest } from "next/server";
import { NO_KEY_MESSAGE, SESSION_COOKIE, configuredKey, verifySession } from "@/lib/auth/session";

/**
 * The access gate (design D1). Runs before every route except static assets.
 *
 * - No configured key: 503 with a plain statement, on everything but the
 *   manifest and icons. The app fails closed.
 * - `/login`, `/api/session`, the manifest and icons are exempt.
 * - A page request without a valid session redirects to `/login?next=<path>`.
 * - An API request or a server-action post without a valid session gets 401
 *   JSON `{ "error": "unauthenticated" }`.
 * - A cookie that is present but tampered or expired is cleared on the way.
 */

const ALWAYS_OPEN = ["/manifest.webmanifest"];
const ALWAYS_OPEN_PREFIXES = ["/icons/"];
const EXEMPT = ["/login", "/api/session"];

function isAlwaysOpen(pathname: string): boolean {
  return ALWAYS_OPEN.includes(pathname) || ALWAYS_OPEN_PREFIXES.some((p) => pathname.startsWith(p));
}

function isWriteLike(request: NextRequest): boolean {
  const pathname = request.nextUrl.pathname;
  if (pathname.startsWith("/api/")) return true;
  if (request.headers.has("next-action")) return true;
  const method = request.method.toUpperCase();
  return method !== "GET" && method !== "HEAD";
}

export function proxy(request: NextRequest): NextResponse {
  const { pathname, search } = request.nextUrl;

  if (isAlwaysOpen(pathname)) return NextResponse.next();

  const key = configuredKey();
  if (!key) {
    return new NextResponse(NO_KEY_MESSAGE, {
      status: 503,
      headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
    });
  }

  if (EXEMPT.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return NextResponse.next();

  const cookie = request.cookies.get(SESSION_COOKIE)?.value;
  const state = verifySession(key, cookie);
  if (state === "valid") return NextResponse.next();

  let response: NextResponse;
  if (isWriteLike(request)) {
    response = NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  } else {
    const login = new URL("/login", request.url);
    login.searchParams.set("next", `${pathname}${search}`);
    response = NextResponse.redirect(login);
  }
  response.headers.set("cache-control", "no-store");
  if (cookie !== undefined) response.cookies.delete(SESSION_COOKIE);
  return response;
}

export default proxy;

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon\\.ico).*)"],
};
