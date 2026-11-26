import { locationHref } from "@/lib/repo";

/**
 * Inbox navigation controls (repo-selection spec): a GET "Branch" form that
 * keeps the repository, and with several repositories a picker of links that
 * drops `ref` so a chosen repository opens on its default branch.
 */
export function InboxControls({ repo, repos }: { repo: string; repos: readonly string[] }) {
  return (
    <div className="inbox-controls">
      <form method="get" action="/">
        <input type="hidden" name="repo" value={repo} />
        <label>
          <span className="label">Branch</span>
          <input type="text" className="field" name="ref" autoCapitalize="none" autoCorrect="off" spellCheck={false} />
        </label>
        <button type="submit" className="btn">Open</button>
      </form>
      {repos.length > 1 ? (
        <nav aria-label="Repository">
          <ul>
            {repos.map((r) => (
              <li key={r}>
                <a href={locationHref("/", { repo: r })} aria-current={r === repo ? "page" : undefined}>
                  {r}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}
    </div>
  );
}
