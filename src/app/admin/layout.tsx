import Link from "next/link";
import type { Metadata } from "next";
import { requireAdmin } from "@/lib/admin";

export const metadata: Metadata = {
  title: "Admin | Workframe",
  robots: { index: false, follow: false },
};

const links = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/extractions", label: "Extractions" },
  { href: "/admin/sampling", label: "Sampling" },
  { href: "/admin/emails", label: "Emails" },
  { href: "/admin/system", label: "System" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Pages and actions each call requireAdmin() too: a layout alone is not a gate.
  await requireAdmin();
  return (
    <div className="py-u3">
      <nav aria-label="Admin" className="-mx-u1 flex gap-u1 overflow-x-auto border-b border-border pb-u1">
        {links.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="inline-flex min-h-tap shrink-0 items-center rounded-md px-u2 text-sm font-medium hover:bg-surface-alt"
          >
            {l.label}
          </Link>
        ))}
      </nav>
      <div className="mt-u3">{children}</div>
    </div>
  );
}
