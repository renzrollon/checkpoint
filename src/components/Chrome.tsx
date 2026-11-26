import Link from "next/link";
import { cookies } from "next/headers";
import {
  SESSION_COOKIE,
  configuredKey,
  verifySession,
} from "@/lib/auth/session";
import { SignOut } from "@/components/SignOut";
import { locationHref } from "@/lib/repo";

type Where = { repo?: string; ref?: string };

function homeHref(where: Where): string {
  return locationHref("/", { repo: where.repo, ref: where.ref });
}

/**
 * The header bar: a home link that stays on the canonical repository and ref
 * it is given (design D9, D14), and Sign out. It never reads the URL and
 * renders only for a signed-in session. Call as `await Chrome(props)` from
 * server components that return early.
 */
export async function Chrome(where: Where) {
  const store = await cookies();
  const authenticated =
    verifySession(configuredKey(), store.get(SESSION_COOKIE)?.value) ===
    "valid";
  if (!authenticated) return null;
  return (
    <header className="chrome">
      <Link href={homeHref(where)} className="chrome-home">
        Checkpoint
      </Link>
      <SignOut />
    </header>
  );
}
