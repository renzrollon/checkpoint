import { Chrome } from "@/components/Chrome";

/** "Checkpoint is not configured" plus the variable names at fault; never a value. */
export async function ConfigError({ missing }: { missing: readonly string[] }) {
  return (
    <>
      {await Chrome({})}
      <div className="host-error" role="alert">
        <p className="reason">Checkpoint is not configured</p>
        <ul>
          {missing.map((name) => (
            <li key={name}>
              <code>{name}</code>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
