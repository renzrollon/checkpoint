import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { SESSION_COOKIE, configuredKey, verifySession } from "@/lib/auth/session";
import { SignOut } from "@/components/SignOut";
import "./globals.css";

export const metadata: Metadata = {
  title: "Checkpoint",
  description: "Read one change, answer the one decision, approve or send back.",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/icons/icon-192.png",
    apple: "/icons/icon-192.png",
  },
  appleWebApp: {
    capable: true,
    title: "Checkpoint",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f3f5fe" },
    { media: "(prefers-color-scheme: dark)", color: "#161826" },
  ],
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const store = await cookies();
  const authenticated = verifySession(configuredKey(), store.get(SESSION_COOKIE)?.value) === "valid";
  return (
    <html lang="en">
      <body>
        {authenticated ? (
          <header className="chrome">
            <Link href="/" className="chrome-home">
              Checkpoint
            </Link>
            <SignOut />
          </header>
        ) : null}
        {children}
      </body>
    </html>
  );
}
