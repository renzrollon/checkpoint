import Link from "next/link";
import type { InboxEntry } from "@/lib/change/load";

/**
 * One change on the inbox (change-inbox spec). Every state is a word on the
 * card; the 2 px leading rule on a blocking card is a redundant mark beside
 * the status that already says so.
 */
export function ChangeCard({ entry, refName }: { entry: InboxEntry; refName: string }) {
  const href = `/changes/${encodeURIComponent(entry.name)}?ref=${encodeURIComponent(refName)}`;
  return (
    <li>
      <Link href={href} className={`card${entry.blocking ? " card-blocking" : ""}`}>
        <div className="card-body">
          <h2 className="card-name">{entry.name}</h2>
          <p className="card-line">{entry.ledger.statusText}</p>
          <p className="card-line">
            {entry.tasks.done} of {entry.tasks.total} tasks · {entry.tasks.waves} {entry.tasks.waves === 1 ? "wave" : "waves"}
          </p>
          {entry.decision !== "none" ? <p className="card-line">{entry.decision}</p> : null}
        </div>
      </Link>
    </li>
  );
}
