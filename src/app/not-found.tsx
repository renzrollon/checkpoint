import { Chrome } from "@/components/Chrome";

/** An unknown URL keeps the header bar (Sign out, bare home link). */
export default async function NotFound() {
  return (
    <>
      {await Chrome({})}
      <main className="inbox">
        <p className="missing">Not found</p>
      </main>
    </>
  );
}
