import { Chrome } from "@/components/Chrome";
import { locationHref } from "@/lib/repo";

/** A requested repository outside the allowlist, with links to the configured ones. */
export async function UnknownRepo({
  requested,
  repos,
}: {
  requested: string;
  repos: readonly string[];
}) {
  return (
    <>
      {await Chrome({})}
      <div className="host-error" role="alert">
        <p className="reason">Checkpoint is not configured for {requested}</p>
        <ul>
          {repos.map((repo) => (
            <li key={repo}>
              <a href={locationHref("/", { repo })}>{repo}</a>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
