"use client";

import type { HostErrorShape } from "@/lib/githost/errors";
import { formatUtcTime } from "@/lib/format";

/**
 * A failed host read, named. One component in two placements (design
 * transcription §3.1): on the inbox it replaces the card list inside a
 * surface panel; on the change page it sits in the page body. The retry
 * time, when the host supplied one, is part of the same sentence.
 */

export interface HostErrorProps {
  error: HostErrorShape;
  /** The ref the read was for, when known. */
  refName?: string | null;
  /** "GitHub" in production; the fixture host names itself otherwise. */
  hostName?: string;
  placement?: "inbox" | "page";
}

export function hostErrorText(error: HostErrorShape, refName?: string | null, hostName = "GitHub"): string {
  const ref = error.ref ?? refName ?? "the ref";
  switch (error.kind) {
    case "unauthorized":
      return `${hostName} rejected the token (unauthorized)`;
    case "forbidden":
      return error.retryAt
        ? `${hostName} refused (forbidden), retry after ${formatUtcTime(error.retryAt)}`
        : `${hostName} refused (forbidden)`;
    case "not_found":
      return `${error.path ? `${error.path} ` : ""}not found on ${ref} (not_found)`;
    case "conflict":
      return `${error.path ?? "the file"} changed on ${ref} (conflict)`;
    case "forbidden_path":
      return `write refused outside the change directory (forbidden_path)`;
    case "upstream":
    default:
      return `${hostName} unreachable (upstream)`;
  }
}

export function HostError({ error, refName, hostName = "GitHub", placement = "page" }: HostErrorProps) {
  const text = hostErrorText(error, refName, hostName);
  function retry() {
    window.location.reload();
  }
  return (
    <div className={`host-error${placement === "inbox" ? " host-error-panel" : ""}`} role="alert">
      <p className="reason">{text}</p>
      <button type="button" className="btn" onClick={retry}>
        Retry
      </button>
    </div>
  );
}
