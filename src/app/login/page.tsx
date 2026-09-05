import { safeNextPath } from "@/lib/auth/session";
import { LoginForm } from "@/components/LoginForm";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const raw = params.next;
  const next = safeNextPath(Array.isArray(raw) ? raw[0] : raw);
  return (
    <main className="login-page">
      <h1 className="login-title">Checkpoint</h1>
      <p className="login-lead">Enter the access key to read the change waiting on you.</p>
      <LoginForm next={next} />
    </main>
  );
}
