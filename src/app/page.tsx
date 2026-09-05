import { getHost, isHostError } from "@/lib/githost";
import { listChanges, type Inbox } from "@/lib/change/load";
import { ChangeCard } from "@/components/ChangeCard";
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
 * The inbox (change-inbox spec): every active change on the ref, blocking
 * first. A failed read is named with a retry control and never renders as
 * an empty inbox.
 */
export default async function InboxPage({ searchParams }: { searchParams: Promise<Search> }) {
  const requestedRef = refParam(await searchParams);
  const host = getHost();
  let inbox: Inbox;
  try {
    inbox = await listChanges(host, requestedRef);
  } catch (e) {
    if (!isHostError(e)) throw e;
    return (
      <main className="inbox">
        <InboxHeader refName={requestedRef ?? e.ref ?? "the default branch"} />
        <HostError error={e.toJSON()} refName={requestedRef} hostName={hostLabel(host.name)} placement="inbox" />
      </main>
    );
  }

  return (
    <main className="inbox">
      <InboxHeader refName={inbox.ref} />
      {inbox.entries.length === 0 ? (
        <p className="empty">No active changes on {inbox.ref}</p>
      ) : (
        <ul className="card-list">
          {inbox.entries.map((entry) => (
            <ChangeCard key={entry.name} entry={entry} refName={inbox.ref} />
          ))}
        </ul>
      )}
    </main>
  );
}

function InboxHeader({ refName }: { refName: string }) {
  return (
    <header className="inbox-header">
      <h1 className="page-title">Checkpoint</h1>
      <p className="ref-line">
        <span className="label">Ref</span>
        <span>{refName}</span>
      </p>
    </header>
  );
}
