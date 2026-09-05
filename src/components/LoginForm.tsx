"use client";

import { useId, useRef, useState, type FormEvent } from "react";

/**
 * The one unauthenticated form. Posts the key to `/api/session`; a 401 shows
 * "That key was not accepted" and keeps focus on the field, a 303 is followed
 * to the preserved `next` path. Works as a plain form post without script.
 */
export function LoginForm({ next }: { next: string }) {
  const id = useId();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const field = useRef<HTMLInputElement>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const body = new FormData(event.currentTarget);
      const res = await fetch("/api/session", { method: "POST", body, redirect: "follow" });
      if (res.redirected) {
        window.location.assign(res.url);
        return;
      }
      if (res.ok) {
        window.location.assign(next || "/");
        return;
      }
      if (res.status === 401) {
        setError("That key was not accepted");
      } else {
        setError((await res.text().catch(() => "")) || `Sign-in failed (${res.status})`);
      }
      field.current?.focus();
    } catch {
      setError("Sign-in failed; check the connection");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form method="post" action="/api/session" onSubmit={onSubmit} className="login-form">
      <input type="hidden" name="next" value={next} />
      <label htmlFor={`${id}-key`} className="login-label">
        Access key
      </label>
      <input
        ref={field}
        id={`${id}-key`}
        name="key"
        type="password"
        autoComplete="current-password"
        required
        autoFocus
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className="login-input"
      />
      {error ? (
        <p id={`${id}-error`} role="alert" className="login-error">
          {error}
        </p>
      ) : null}
      <button type="submit" disabled={busy} className="login-submit">
        Sign in
      </button>
    </form>
  );
}
