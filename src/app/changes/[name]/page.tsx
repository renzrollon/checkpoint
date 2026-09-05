import Link from "next/link";
import { getHost, isHostError } from "@/lib/githost";
import { loadChange, type LoadChangeResult } from "@/lib/change/load";
import { ChangeWorkspace } from "@/components/ChangeWorkspace";
import { HostError } from "@/components/HostError";

export const dynamic = "force-dynamic";

type Search = Record<string, string | string[] | undefined>;

function refParam(params: Search): string | null {
  const raw = params.ref;
  const value = Array.isArray(raw) ? raw[0] : raw;
  return value && value.trim() ? value.trim() : null;
}

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
  searchParams: Promise<Search>;
}) {
  const [{ name }, search] = await Promise.all([params, searchParams]);
  const requestedRef = refParam(search);
  const host = getHost();
  let result: LoadChangeResult;
  try {
    result = await loadChange(host, requestedRef, name);
  } catch (e) {
    if (!isHostError(e)) throw e;
    return (
      <main className="inbox">
        <h1 className="page-title">{name}</h1>
        <p className="ref-line">
          <span className="label">Ref</span>
          <span>{requestedRef ?? e.ref ?? "the default branch"}</span>
        </p>
        <div className="change-body">
          <HostError error={e.toJSON()} refName={requestedRef} hostName={hostLabel(host.name)} />
        </div>
      </main>
    );
  }

  if (result.kind === "not_found") {
    return (
      <main className="inbox">
        <h1 className="page-title">Checkpoint</h1>
        <div className="change-body">
          <p className="missing">
            No change named {result.name} on {result.ref}
          </p>
          <p>
            <Link href={`/?ref=${encodeURIComponent(result.ref)}`}>Back to the inbox</Link>
          </p>
        </div>
      </main>
    );
  }

  return <ChangeWorkspace change={result.change} />;
}
