"use client";

import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import type { Artifact, SpecFile } from "@/lib/change/load";
import { Markdown } from "./Markdown";

/**
 * The five artifact tabs in reading order (change-reading spec): a
 * `role="tablist"` whose active tab lives in the URL hash, moves with the
 * arrow keys and wraps. Every panel is rendered and the inactive ones are
 * hidden, so switching never re-parses an artifact.
 */

export const TAB_IDS = ["proposal", "design", "tasks", "specs", "ledger"] as const;
export type TabId = (typeof TAB_IDS)[number];
const LABELS: Record<TabId, string> = { proposal: "Proposal", design: "Design", tasks: "Tasks", specs: "Specs", ledger: "Ledger" };

export interface ArtifactTabsProps {
  refName: string;
  artifacts: { proposal: Artifact; design: Artifact; tasks: Artifact };
  specs: SpecFile[];
  /** The ledger panel (task 3.3), rendered under the Ledger tab. */
  ledger: ReactNode;
  /** Tab to open when the URL carries no hash. */
  initial?: TabId;
}

function isTabId(value: string): value is TabId {
  return (TAB_IDS as readonly string[]).includes(value);
}

function tabFromHash(): TabId | null {
  if (typeof window === "undefined") return null;
  const id = window.location.hash.replace(/^#/, "");
  return isTabId(id) ? id : null;
}

function ArtifactPanel({ artifact, refName }: { artifact: Artifact; refName: string }) {
  if (artifact.missing || artifact.text === null) {
    return <p className="missing">{`${artifact.file} is missing on ${refName}`}</p>;
  }
  return <Markdown text={artifact.text} />;
}

function SpecsPanel({ specs, refName }: { specs: SpecFile[]; refName: string }) {
  if (specs.length === 0) return <p className="missing">{`specs/ is missing on ${refName}`}</p>;
  return (
    <>
      {specs.map((spec) => (
        <section key={spec.path}>
          <h2 className="spec-path">{spec.path}</h2>
          <Markdown text={spec.text} />
        </section>
      ))}
    </>
  );
}

export function ArtifactTabs({ refName, artifacts, specs, ledger, initial = "proposal" }: ArtifactTabsProps) {
  const [active, setActive] = useState<TabId>(initial);
  const tabs = useRef<Record<TabId, HTMLButtonElement | null>>({ proposal: null, design: null, tasks: null, specs: null, ledger: null });

  useEffect(() => {
    const sync = () => {
      const fromHash = tabFromHash();
      if (fromHash) setActive(fromHash);
    };
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);

  const select = useCallback((id: TabId, focus = false) => {
    setActive(id);
    if (typeof window !== "undefined" && window.location.hash !== `#${id}`) {
      window.history.replaceState(window.history.state, "", `#${id}`);
    }
    if (focus) tabs.current[id]?.focus();
  }, []);

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>, id: TabId) {
    const index = TAB_IDS.indexOf(id);
    let next: TabId | null = null;
    if (event.key === "ArrowRight") next = TAB_IDS[(index + 1) % TAB_IDS.length];
    else if (event.key === "ArrowLeft") next = TAB_IDS[(index - 1 + TAB_IDS.length) % TAB_IDS.length];
    else if (event.key === "Home") next = TAB_IDS[0];
    else if (event.key === "End") next = TAB_IDS[TAB_IDS.length - 1];
    if (next) {
      event.preventDefault();
      select(next, true);
    }
  }

  return (
    <>
      <div role="tablist" aria-label="Artifacts" className="tablist">
        {TAB_IDS.map((id) => (
          <button
            key={id}
            type="button"
            role="tab"
            id={`tab-${id}`}
            aria-selected={active === id}
            aria-controls={`panel-${id}`}
            tabIndex={active === id ? 0 : -1}
            className="tab"
            ref={(el) => {
              tabs.current[id] = el;
            }}
            onClick={() => select(id)}
            onKeyDown={(event) => onKeyDown(event, id)}
          >
            {LABELS[id]}
          </button>
        ))}
      </div>
      {TAB_IDS.map((id) => (
        <div
          key={id}
          role="tabpanel"
          id={`panel-${id}`}
          aria-labelledby={`tab-${id}`}
          hidden={active !== id}
          className="tabpanel"
          tabIndex={0}
        >
          {id === "proposal" ? <ArtifactPanel artifact={artifacts.proposal} refName={refName} /> : null}
          {id === "design" ? <ArtifactPanel artifact={artifacts.design} refName={refName} /> : null}
          {id === "tasks" ? <ArtifactPanel artifact={artifacts.tasks} refName={refName} /> : null}
          {id === "specs" ? <SpecsPanel specs={specs} refName={refName} /> : null}
          {id === "ledger" ? ledger : null}
        </div>
      ))}
    </>
  );
}
