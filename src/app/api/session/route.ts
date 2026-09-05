import { NextResponse, type NextRequest } from "next/server";
import { redirectToPath } from "@/lib/auth/redirect";
import {
  NO_KEY_MESSAGE,
  SESSION_COOKIE,
  configuredKey,
  keyMatches,
  makeSession,
  safeNextPath,
} from "@/lib/auth/session";

/**
 * Access key exchange (access-gate spec). POST compares the presented key to
 * the configured one in constant time and, on success, sets the session
 * cookie and redirects to the preserved `next` path. Failure is a 401 that
 * does not say whether a key is configured. DELETE clears the session.
 */

export const dynamic = "force-dynamic";

function cookieSecure(request: NextRequest): boolean {
  return process.env.NODE_ENV === "production" || request.nextUrl.protocol === "https:";
}

async function readBody(request: NextRequest): Promise<{ key: string; next: string | null }> {
  const type = request.headers.get("content-type") ?? "";
  if (type.includes("application/json")) {
    const json = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    return { key: typeof json.key === "string" ? json.key : "", next: typeof json.next === "string" ? json.next : null };
  }
  const form = await request.formData().catch(() => null);
  const key = form?.get("key");
  const next = form?.get("next");
  return { key: typeof key === "string" ? key : "", next: typeof next === "string" ? next : null };
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const configured = configuredKey();
  if (!configured) {
    return new NextResponse(NO_KEY_MESSAGE, {
      status: 503,
      headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
    });
  }

  const { key, next } = await readBody(request);
  if (!keyMatches(configured, key)) {
    return NextResponse.json({ error: "That key was not accepted" }, { status: 401, headers: { "cache-control": "no-store" } });
  }

  const session = makeSession(configured);
  const destination = safeNextPath(next ?? request.nextUrl.searchParams.get("next"));
  const response = redirectToPath(destination, 303);
  response.cookies.set({
    name: SESSION_COOKIE,
    value: session.value,
    httpOnly: true,
    secure: cookieSecure(request),
    sameSite: "lax",
    path: "/",
    maxAge: session.maxAge,
    expires: session.expires,
  });
  response.headers.set("cache-control", "no-store");
  return response;
}

export async function DELETE(): Promise<NextResponse> {
  const response = NextResponse.json({ ok: true }, { headers: { "cache-control": "no-store" } });
  response.cookies.set({
    name: SESSION_COOKIE,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
    expires: new Date(0),
  });
  return response;
}
