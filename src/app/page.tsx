import { isHostError } from "@/lib/githost";
import { listChanges, type Inbox } from "@/lib/change/load";
import { ChangeCard } from "@/components/ChangeCard";
import { ConfigError } from "@/components/ConfigError";
import { UnknownRepo } from "@/components/UnknownRepo";
import { InboxControls } from "@/components/InboxControls";
import { resolvePageContext, type SearchParams } from "@/lib/page-context";
import { Chrome } from "@/components/Chrome";
import { HostError } from "@/components/HostError";

export const dynamic = "force-dynamic";

function hostLabel(name: string): string {
  return name === "fixture" ? "Fixture" : "GitHub";
}

/**
 * The inbox (change-inbox spec): every active change on the ref, blocking
 * first. A failed read is named with a retry control and never renders as
 * an empty inbox.
 */
export default async function InboxPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const ctx = resolvePageContext(await searchParams);
  if (ctx.kind === "config") return ConfigError({ missing: ctx.missing });
  if (ctx.kind === "unknown_repo")
    return UnknownRepo({ requested: ctx.requested, repos: ctx.repos });
  const { host, repo, repos } = ctx;
  const requestedRef = ctx.ref;
  const header = (refName: string) => (
    <InboxHeader refName={refName} repo={repo} repos={repos} />
  );
  let inbox: Inbox;
  try {
    inbox = await listChanges(host, requestedRef);
  } catch (e) {
    if (!isHostError(e)) throw e;
    return (
      <>
        {await Chrome({ repo, ref: requestedRef ?? undefined })}
        <main className="inbox">
          {header(requestedRef ?? e.ref ?? "the default branch")}
          <HostError
            error={e.toJSON()}
            refName={requestedRef}
            hostName={hostLabel(host.name)}
            placement="inbox"
          />
        </main>
      </>
    );
  }

  return (
    <>
      {await Chrome({ repo, ref: inbox.ref })}
      <main className="inbox">
        {header(inbox.ref)}
        {inbox.entries.length === 0 ? (
          <p className="empty">No active changes on {inbox.ref}</p>
        ) : (
          <ul className="card-list">
            {inbox.entries.map((entry) => (
              <ChangeCard
                key={entry.name}
                entry={entry}
                repo={repo}
                refName={inbox.ref}
              />
            ))}
          </ul>
        )}
      </main>
    </>
  );
}

function InboxHeader({
  refName,
  repo,
  repos,
}: {
  refName: string;
  repo: string;
  repos: readonly string[];
}) {
  return (
    <header className="inbox-header">
      <h1 className="page-title">Checkpoint</h1>
      {repos.length > 1 ? (
        <p className="ref-line">
          <span className="label">Repository</span>
          <span>{repo}</span>
        </p>
      ) : null}
      <p className="ref-line">
        <span className="label">Ref</span>
        <span>{refName}</span>
      </p>
      <InboxControls repo={repo} repos={repos} />
    </header>
  );
}
