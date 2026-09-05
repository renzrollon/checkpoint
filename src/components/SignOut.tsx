"use client";

import { useRouter } from "next/navigation";

/** "Sign out": clears the session cookie and returns to the login page. */
export function SignOut() {
  const router = useRouter();
  async function onClick() {
    try {
      await fetch("/api/session", { method: "DELETE" });
    } finally {
      router.push("/login");
      router.refresh();
    }
  }
  return (
    <button type="button" onClick={onClick} className="signout">
      Sign out
    </button>
  );
}
