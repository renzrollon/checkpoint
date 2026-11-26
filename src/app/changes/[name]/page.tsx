import Link from "next/link";
import { isHostError } from "@/lib/githost";
import { loadChange, type LoadChangeResult } from "@/lib/change/load";
import { ChangeWorkspace } from "@/components/ChangeWorkspace";
import { Chrome } from "@/components/Chrome";
import { HostError } from "@/components/HostError";
import { ConfigError } from "@/components/ConfigError";
import { UnknownRepo } from "@/components/UnknownRepo";
import { resolvePageContext, type SearchParams } from "@/lib/page-context";
import { locationHref } from "@/lib/repo";

export const dynamic = "force-dynamic";

function hostLabel(name: string): string {
  return name === "fixture" ? "Fixture" : "GitHub";
}

/**
 * One change on a ref (change-reading spec). An unknown change and a failed
 * host read are both spoken, with the ref, and never render as an empty page.
 */
export default async function ChangePage({
  params,
  searchParams,
}: {
  params: Promise<{ name: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const [{ name }, search] = await Promise.all([params, searchParams]);
  const context = resolvePageContext(search);
  if (context.kind === "config") {
    return ConfigError({ missing: context.missing });
  }
  if (context.kind === "unknown_repo") {
    return UnknownRepo({ requested: context.requested, repos: context.repos });
  }
  const { repo, host, ref: requestedRef } = context;
  const showRepo = context.repos.length > 1;
  let result: LoadChangeResult;
  try {
    result = await loadChange(host, requestedRef, name);
  } catch (e) {
    if (!isHostError(e)) throw e;
    return (
      <>
        {await Chrome({ repo, ref: requestedRef ?? undefined })}
        <main className="inbox">
          <h1 className="page-title">{name}</h1>
          <p className="ref-line">
            <span className="label">Ref</span>
            <span>{requestedRef ?? e.ref ?? "the default branch"}</span>
          </p>
          <div className="change-body">
            <HostError
              error={e.toJSON()}
              refName={requestedRef}
              hostName={hostLabel(host.name)}
            />
          </div>
        </main>
      </>
    );
  }

  if (result.kind === "not_found") {
    return (
      <>
        {await Chrome({ repo, ref: result.ref })}
        <main className="inbox">
          <h1 className="page-title">Checkpoint</h1>
          <div className="change-body">
            <p className="missing">
              No change named {result.name} on {result.ref}
              {showRepo ? ` in ${repo}` : ""}
            </p>
            <p>
              <Link href={locationHref("/", { repo, ref: result.ref })}>
                Back to the inbox
              </Link>
            </p>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      {await Chrome({ repo, ref: result.change.ref })}
      <ChangeWorkspace change={result.change} repo={repo} showRepo={showRepo} />
    </>
  );
}
