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
  CHECKPOINT_REPOS: z.array(z.string()),
  CHECKPOINT_GITHUB_TOKEN: nonEmpty("CHECKPOINT_GITHUB_TOKEN"),
  CHECKPOINT_FIXTURE_DIR: z.string().optional(),
});

const fixtureEnv = z.object({
  CHECKPOINT_GIT_HOST: z.literal("fixture"),
  CHECKPOINT_ACCESS_KEY: optionalKey,
  CHECKPOINT_REPOS: z.array(z.string()),
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

const REPO_PATTERN = /^[^/\s,]+\/[^/\s,]+$/;

/**
 * Resolve the repository allowlist from `CHECKPOINT_REPOS` (or the one-entry
 * `CHECKPOINT_REPO` fallback). Errors name variables, never values.
 */
function parseRepos(
  source: Record<string, string | undefined>,
  host: "github" | "fixture",
): string[] {
  const single = source.CHECKPOINT_REPO?.trim() ? source.CHECKPOINT_REPO : undefined;
  const list = source.CHECKPOINT_REPOS?.trim() ? source.CHECKPOINT_REPOS : undefined;
  if (single !== undefined && list !== undefined) {
    throw new EnvError(
      ["CHECKPOINT_REPO", "CHECKPOINT_REPOS"],
      "CHECKPOINT_REPO and CHECKPOINT_REPOS are both set; use only CHECKPOINT_REPOS",
    );
  }
  const name = list !== undefined ? "CHECKPOINT_REPOS" : "CHECKPOINT_REPO";
  const rawValue = list ?? single;
  if (rawValue === undefined) {
    if (host === "fixture") return ["fixture/repo"];
    throw new EnvError(["CHECKPOINT_REPOS"], "CHECKPOINT_REPOS is required");
  }
  const entries = rawValue.split(",").map((e) => e.trim());
  if (entries.some((e) => !REPO_PATTERN.test(e))) {
    throw new EnvError([name], `${name} must be a comma-separated list of owner/name`);
  }
  const seen = new Set<string>();
  for (const e of entries) {
    const key = e.toLowerCase();
    if (seen.has(key)) throw new EnvError([name], `${name} lists the same repository twice`);
    seen.add(key);
  }
  if (host === "fixture" && entries.length > 1) {
    throw new EnvError([name], `${name} must hold exactly one repository with CHECKPOINT_GIT_HOST=fixture`);
  }
  return entries;
}

/** Validate a raw environment. Throws `EnvError` naming what is wrong. */
export function parseEnv(source: Record<string, string | undefined>): Env {
  const raw = {
    CHECKPOINT_GIT_HOST: source.CHECKPOINT_GIT_HOST?.trim() || "github",
    CHECKPOINT_ACCESS_KEY: source.CHECKPOINT_ACCESS_KEY,
    CHECKPOINT_REPOS: [] as string[],
    CHECKPOINT_GITHUB_TOKEN: source.CHECKPOINT_GITHUB_TOKEN,
    CHECKPOINT_FIXTURE_DIR: source.CHECKPOINT_FIXTURE_DIR,
  };
  if (raw.CHECKPOINT_GIT_HOST !== "github" && raw.CHECKPOINT_GIT_HOST !== "fixture") {
    throw new EnvError(
      ["CHECKPOINT_GIT_HOST"],
      `CHECKPOINT_GIT_HOST must be "github" or "fixture", got "${raw.CHECKPOINT_GIT_HOST}"`,
    );
  }
  if (raw.CHECKPOINT_GIT_HOST === "fixture" && process.env.NODE_ENV === "production") {
    throw new EnvError(
      ["CHECKPOINT_GIT_HOST"],
      "CHECKPOINT_GIT_HOST=fixture is not allowed in production",
    );
  }
  // Token problems are reported together with repository problems.
  let reposError: EnvError | undefined;
  try {
    raw.CHECKPOINT_REPOS = parseRepos(source, raw.CHECKPOINT_GIT_HOST);
  } catch (e) {
    if (!(e instanceof EnvError)) throw e;
    reposError = e;
  }
  const result = envSchema.safeParse(raw);
  if (reposError) {
    const names = new Set(reposError.missing);
    const details = [reposError.message.replace("Checkpoint environment is incomplete: ", "")];
    if (!result.success) {
      for (const issue of result.error.issues) {
        const n = String(issue.path[0] ?? "");
        if (n && n !== "CHECKPOINT_REPOS") {
          names.add(n);
          details.push(issue.message.includes(n) ? issue.message : `${n}: ${issue.message}`);
        }
      }
    }
    throw new EnvError([...names], details.join("; "));
  }
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
