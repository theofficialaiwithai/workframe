import Link from "next/link";
import { SignedIn, SignedOut, UserButton } from "@clerk/nextjs";

const linkClass =
  "inline-flex min-h-tap items-center px-u1 text-sm font-medium text-ink hover:underline";

export function SiteHeader() {
  return (
    <header className="border-b border-border bg-surface">
      <div className="mx-auto flex min-h-[60px] w-full max-w-[1080px] items-center justify-between px-u2">
        <Link
          href="/"
          className="inline-flex min-h-tap items-center font-heading text-xl font-bold tracking-tight text-ink"
        >
          Workframe
        </Link>
        <nav className="flex items-center gap-u1">
          <SignedIn>
            <Link href="/dashboard" className={linkClass}>
              Dashboard
            </Link>
            <UserButton />
          </SignedIn>
          <SignedOut>
            <Link href="/sign-in" className={linkClass}>
              Sign in
            </Link>
          </SignedOut>
        </nav>
      </div>
    </header>
  );
}
