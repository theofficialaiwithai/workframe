import { readFileSync } from "node:fs";
import { join } from "node:path";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Markdown } from "@/components/markdown";
import { requireAdmin } from "@/lib/admin";

export const dynamic = "force-dynamic";

// Only these two documents can be opened. The name comes from the URL, so it is
// checked against this list and never used as a path on its own.
const DOCS: Record<string, string> = {
  "strategic-intent": "strategic-intent.md",
  "decision-rights": "decision-rights.md",
};

export default async function DocPage({ params }: { params: { name: string } }) {
  await requireAdmin();
  const file = Object.prototype.hasOwnProperty.call(DOCS, params.name) ? DOCS[params.name] : null;
  if (!file) notFound();
  const text = readFileSync(join(process.cwd(), "docs", file), "utf8");

  return (
    <div className="max-w-[860px]">
      <Link href="/admin/system" className="inline-flex min-h-tap items-center text-sm font-medium hover:underline">
        ← System
      </Link>
      <div className="mt-u2 rounded-lg border border-border bg-surface p-u3">
        <Markdown>{text}</Markdown>
      </div>
    </div>
  );
}
