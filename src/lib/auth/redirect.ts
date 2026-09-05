import { NextResponse } from "next/server";

/**
 * Relative redirects (design D1). Next derives `request.url` from the address
 * the server is bound to, not the address the client used, so an absolute
 * `Location` built from it sends a phone on the LAN to `http://0.0.0.0:3200`.
 * RFC 7231 §7.1.2 permits a relative reference; the browser (and `fetch`)
 * resolves it against the request URL, which is the address that actually
 * works. `NextResponse.redirect` refuses a relative target, so the response is
 * built by hand.
 */

/** Is this a same-origin path — one leading slash, no scheme, no host? */
function isSameOriginPath(path: string): boolean {
  if (typeof path !== "string" || !path.startsWith("/")) return false;
  // `//host` and `/\host` are protocol-relative; browsers leave the origin.
  if (path.startsWith("//") || path.startsWith("/\\")) return false;
  return !/[\r\n]/.test(path);
}

/**
 * A redirect whose `Location` is the given path verbatim. Throws on anything
 * that is not a same-origin path, so a caller can never emit an off-origin
 * `Location` by accident.
 */
export function redirectToPath(path: string, status: 303 | 307): NextResponse {
  if (!isSameOriginPath(path)) {
    throw new Error(`redirectToPath: not a same-origin path: ${JSON.stringify(path)}`);
  }
  return new NextResponse(null, {
    status,
    headers: { location: path, "cache-control": "no-store" },
  });
}
