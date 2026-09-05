import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Access-gate session (design D1 default). The cookie value is
 * `v1.<expiry>.<tag>` where `tag` is an HMAC-SHA256 over `v1|<expiry>` keyed
 * by the shared access key and `expiry` is a Unix timestamp in seconds, 30
 * days out. Verifying needs only the key; nothing is stored server-side.
 */

export const SESSION_COOKIE = "checkpoint_session";
export const SESSION_TTL_SECONDS = 30 * 24 * 60 * 60;
const VERSION = "v1";

function tag(key: string, expiry: number): string {
  return createHmac("sha256", key).update(`${VERSION}|${expiry}`).digest("hex");
}

/** Constant-time equality of two strings; unequal lengths are simply false. */
export function constantTimeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(String(a ?? ""), "utf8");
  const bb = Buffer.from(String(b ?? ""), "utf8");
  if (ab.length !== bb.length) {
    // Still touch the bytes so the length mismatch is the only early signal.
    timingSafeEqual(ab, ab);
    return false;
  }
  return timingSafeEqual(ab, bb);
}

/** Does a presented key match the configured one? Constant time. */
export function keyMatches(configured: string | undefined, presented: string | undefined): boolean {
  if (!configured || !configured.trim() || typeof presented !== "string") return false;
  return constantTimeEqual(configured, presented);
}

export interface Session {
  value: string;
  /** Expiry as a Date, for the cookie. */
  expires: Date;
  /** Seconds until expiry, for `Max-Age`. */
  maxAge: number;
}

export function makeSession(key: string, now: number = Date.now()): Session {
  const expiry = Math.floor(now / 1000) + SESSION_TTL_SECONDS;
  return {
    value: `${VERSION}.${expiry}.${tag(key, expiry)}`,
    expires: new Date(expiry * 1000),
    maxAge: SESSION_TTL_SECONDS,
  };
}

export type SessionState = "valid" | "missing" | "tampered" | "expired";

export function verifySession(
  key: string | undefined,
  value: string | undefined | null,
  now: number = Date.now(),
): SessionState {
  if (!value) return "missing";
  if (!key) return "tampered";
  const parts = value.split(".");
  if (parts.length !== 3 || parts[0] !== VERSION || !/^\d{1,12}$/.test(parts[1]) || !/^[0-9a-f]{64}$/.test(parts[2])) {
    return "tampered";
  }
  const expiry = Number(parts[1]);
  if (!constantTimeEqual(tag(key, expiry), parts[2])) return "tampered";
  if (expiry * 1000 <= now) return "expired";
  return "valid";
}

/** The configured access key, or `undefined` when none is set. */
export function configuredKey(env: Record<string, string | undefined> = process.env): string | undefined {
  const k = env.CHECKPOINT_ACCESS_KEY;
  return k && k.trim() ? k : undefined;
}

/** Only same-origin absolute paths may be used as a post-login destination. */
export function safeNextPath(next: string | null | undefined): string {
  if (typeof next !== "string") return "/";
  if (!next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return "/";
  if (/[\r\n]/.test(next)) return "/";
  if (next === "/login" || next.startsWith("/login?")) return "/";
  return next;
}

export const NO_KEY_MESSAGE = "Checkpoint has no access key configured";
