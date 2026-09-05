"use client";

import { useState } from "react";
import type { ChangeView } from "@/lib/change/load";
import type { DecisionView } from "@/lib/checkpoint/checkpoint";
import { answerRowAction, decideAction } from "@/app/changes/[name]/actions";
import { ArtifactTabs } from "./ArtifactTabs";
import { ChangeHeader } from "./ChangeHeader";
import { DecisionBar } from "./DecisionBar";
import { LedgerPanel, type LedgerState } from "./LedgerPanel";

/**
 * The change page below the chrome: header, tabs, the ledger panel and the
 * decision bar share one view of the ledger and the head, so answering the
 * last `needs_human` row re-offers Approve without a reload.
 */
export function ChangeWorkspace({ change }: { change: ChangeView }) {
  const [ledger, setLedger] = useState<LedgerState>({
    status: change.ledger.status,
    statusText: change.ledger.statusText,
    rows: change.ledger.rows,
    summary: change.ledger.summary,
    blockingReason: change.ledger.blockingReason,
    sha: change.ledger.sha,
  });
  const [headSha, setHeadSha] = useState(change.headSha);
  const [decision, setDecision] = useState<DecisionView>(change.decision);
  const [checkpointSha, setCheckpointSha] = useState(change.checkpoint.sha);

  return (
    <main className="change-page">
      <ChangeHeader
        name={change.name}
        refName={change.ref}
        headSha={headSha}
        tasks={change.tasks}
        ledger={{ status: ledger.status, summary: ledger.summary }}
        risk={change.risk}
        decision={decision}
      />
      <ArtifactTabs
        refName={change.ref}
        artifacts={change.artifacts}
        specs={change.specs}
        ledger={
          <LedgerPanel
            refName={change.ref}
            change={change.name}
            ledger={ledger}
            submit={answerRowAction}
            onLedgerChange={(next, head) => {
              setLedger(next);
              if (head) setHeadSha(head);
            }}
          />
        }
      />
      <DecisionBar
        refName={change.ref}
        change={change.name}
        headSha={headSha}
        decision={decision}
        blockingReason={ledger.blockingReason}
        baseSha={checkpointSha}
        submit={decideAction}
        onDecided={(next, head, sha) => {
          setDecision(next);
          setHeadSha(head);
          setCheckpointSha(sha);
        }}
      />
    </main>
  );
}
