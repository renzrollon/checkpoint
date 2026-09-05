import { z } from "zod";

/**
 * Environment contract for the reader (design §Error handling). Validation
 * runs once, on first use, and a missing variable stops the request with the
 * variable's name; the token is never echoed anywhere.
 *
 * `CHECKPOINT_ACCESS_KEY` is deliberately optional here: the access-gate spec
 * says a missing key fails closed with a 503 on every gated route, which is a
 * runtime response, not a boot failure. Everything else the selected adapter
 * needs is required.
 */

const nonEmpty = (name: string) =>
  z
    .string({ error: `${name} is required` })
    .trim()
    .min(1, { error: `${name} is required` });

const optionalKey = z
  .string()
  .optional()
  .transform((v) => (v && v.trim() ? v : undefined));

const githubEnv = z.object({
  CHECKPOINT_GIT_HOST: z.literal("github"),
  CHECKPOINT_ACCESS_KEY: optionalKey,
  CHECKPOINT_REPO: nonEmpty("CHECKPOINT_REPO").regex(/^[^/\s]+\/[^/\s]+$/, {
    error: "CHECKPOINT_REPO must be owner/name",
  }),
  CHECKPOINT_GITHUB_TOKEN: nonEmpty("CHECKPOINT_GITHUB_TOKEN"),
  CHECKPOINT_FIXTURE_DIR: z.string().optional(),
});

const fixtureEnv = z.object({
  CHECKPOINT_GIT_HOST: z.literal("fixture"),
  CHECKPOINT_ACCESS_KEY: optionalKey,
  CHECKPOINT_REPO: z.string().trim().optional().default("fixture/repo"),
  CHECKPOINT_GITHUB_TOKEN: z.string().optional(),
  CHECKPOINT_FIXTURE_DIR: z.string().trim().optional().default("fixtures/repo"),
});

const envSchema = z.discriminatedUnion("CHECKPOINT_GIT_HOST", [githubEnv, fixtureEnv]);

export type Env = z.infer<typeof envSchema>;

export class EnvError extends Error {
  readonly missing: string[];
  constructor(missing: string[], detail: string) {
    super(`Checkpoint environment is incomplete: ${detail}`);
    this.name = "EnvError";
    this.missing = missing;
  }
}

/** Validate a raw environment. Throws `EnvError` naming what is wrong. */
export function parseEnv(source: Record<string, string | undefined>): Env {
  const raw = {
    CHECKPOINT_GIT_HOST: source.CHECKPOINT_GIT_HOST?.trim() || "github",
    CHECKPOINT_ACCESS_KEY: source.CHECKPOINT_ACCESS_KEY,
    CHECKPOINT_REPO: source.CHECKPOINT_REPO,
    CHECKPOINT_GITHUB_TOKEN: source.CHECKPOINT_GITHUB_TOKEN,
    CHECKPOINT_FIXTURE_DIR: source.CHECKPOINT_FIXTURE_DIR,
  };
  if (raw.CHECKPOINT_GIT_HOST !== "github" && raw.CHECKPOINT_GIT_HOST !== "fixture") {
    throw new EnvError(
      ["CHECKPOINT_GIT_HOST"],
      `CHECKPOINT_GIT_HOST must be "github" or "fixture", got "${raw.CHECKPOINT_GIT_HOST}"`,
    );
  }
  const result = envSchema.safeParse(raw);
  if (result.success) return result.data;
  const names = new Set<string>();
  const details: string[] = [];
  for (const issue of result.error.issues) {
    const name = String(issue.path[0] ?? "");
    if (name) names.add(name);
    details.push(issue.message.includes(name) ? issue.message : `${name}: ${issue.message}`);
  }
  throw new EnvError([...names], details.join("; "));
}

let cached: Env | undefined;

/** The validated process environment, parsed once and cached. */
export function getEnv(): Env {
  if (!cached) cached = parseEnv(process.env);
  return cached;
}

/** Test hook: forget the cached environment. */
export function resetEnvCache(): void {
  cached = undefined;
}
