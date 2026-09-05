/**
 * Every failure that crosses the adapter boundary is a `HostError` with one
 * of these kinds (git-host-adapter spec, "Failure classes are named").
 * Nothing else is thrown out of an adapter, and no message ever carries the
 * token.
 */
export type HostErrorKind =
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "conflict"
  | "forbidden_path"
  | "upstream";

export interface HostErrorShape {
  kind: HostErrorKind;
  message: string;
  path?: string;
  ref?: string;
  /** ISO-8601 time after which a `forbidden` (rate limited) call may be retried. */
  retryAt?: string;
}

export class HostError extends Error implements HostErrorShape {
  readonly kind: HostErrorKind;
  readonly path?: string;
  readonly ref?: string;
  readonly retryAt?: string;

  constructor(shape: HostErrorShape) {
    super(shape.message);
    this.name = "HostError";
    this.kind = shape.kind;
    this.path = shape.path;
    this.ref = shape.ref;
    this.retryAt = shape.retryAt;
  }

  /** Plain data for passing across a server/client boundary. */
  toJSON(): HostErrorShape {
    const out: HostErrorShape = { kind: this.kind, message: this.message };
    if (this.path !== undefined) out.path = this.path;
    if (this.ref !== undefined) out.ref = this.ref;
    if (this.retryAt !== undefined) out.retryAt = this.retryAt;
    return out;
  }
}

export function isHostError(value: unknown): value is HostError {
  return value instanceof HostError;
}

/** Wrap anything that is not already a `HostError` as `upstream`. */
export function asHostError(value: unknown, context: { path?: string; ref?: string } = {}): HostError {
  if (isHostError(value)) return value;
  const message = value instanceof Error ? value.message : String(value);
  return new HostError({ kind: "upstream", message: `git host unreachable: ${message}`, ...context });
}
