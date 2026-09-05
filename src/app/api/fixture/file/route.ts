import { NextResponse, type NextRequest } from "next/server";
import { getEnv } from "@/lib/env";
import { getFixtureHost, isHostError } from "@/lib/githost";

/**
 * Test-only read of a file on the fixture host, so the e2e smoke can assert
 * what the app committed. Exists only when `CHECKPOINT_GIT_HOST=fixture`;
 * on any other host it is a 404 like any unknown route. It is still behind
 * the session gate like every other `/api/*` route.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  if (getEnv().CHECKPOINT_GIT_HOST !== "fixture") {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const host = getFixtureHost();
  if (!host) return NextResponse.json({ error: "not found" }, { status: 404 });

  const path = request.nextUrl.searchParams.get("path") ?? "";
  const ref = request.nextUrl.searchParams.get("ref") || (await host.resolveRef(null)).ref;
  if (!path) return NextResponse.json({ error: "path is required" }, { status: 400 });
  try {
    const read = await host.readFile(path, ref);
    return NextResponse.json({ path: read.path, ref: read.ref, sha: read.sha, text: read.text });
  } catch (e) {
    if (isHostError(e)) return NextResponse.json({ error: e.toJSON() }, { status: e.kind === "not_found" ? 404 : 500 });
    throw e;
  }
}
