import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireAdmin } from "@/lib/admin";
import { EMAIL_PAGE_SIZE, EMAIL_TYPES, formatTime, listEmails } from "@/lib/admin-data";

export const dynamic = "force-dynamic";

type Props = { searchParams: { type?: string; page?: string } };

export default async function EmailsPage({ searchParams }: Props) {
  await requireAdmin();
  const type = EMAIL_TYPES.find((t) => t === searchParams.type) ?? null;
  const page = Math.max(1, Math.floor(Number(searchParams.page)) || 1);
  const { total, rows } = await listEmails(type, page);
  const pages = Math.max(1, Math.ceil(total / EMAIL_PAGE_SIZE));

  const href = (t: string | null, p: number) => {
    const q = new URLSearchParams();
    if (t) q.set("type", t);
    if (p > 1) q.set("page", String(p));
    const s = q.toString();
    return `/admin/emails${s ? `?${s}` : ""}`;
  };
  const chip = "inline-flex min-h-tap items-center rounded-md px-u2 text-sm font-medium";

  return (
    <div>
      <h1 className="text-3xl font-bold">Email send log</h1>
      <p className="mt-u1 text-muted">Every automated email, newest first. {total} total.</p>

      <div className="mt-u2 flex flex-wrap gap-u1" aria-label="Filter by type">
        <Link href={href(null, 1)} className={`${chip} ${type === null ? "bg-ink text-surface" : "bg-surface-alt"}`}>
          All
        </Link>
        {EMAIL_TYPES.map((t) => (
          <Link key={t} href={href(t, 1)} className={`${chip} ${type === t ? "bg-ink text-surface" : "bg-surface-alt"}`}>
            {t}
          </Link>
        ))}
      </div>

      <div className="mt-u2 rounded-lg border border-border bg-surface">
        <Table className="min-w-[900px]">
          <TableHeader>
            <TableRow>
              <TableHead>Time (Central)</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Recipient</TableHead>
              <TableHead>Trigger</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="min-w-[260px]">Error</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-muted">
                  No emails yet.
                </TableCell>
              </TableRow>
            )}
            {rows.map((r) => (
              <TableRow key={r.id as string} className="align-top">
                <TableCell className="whitespace-nowrap text-sm">{formatTime(r.created_at as Date)}</TableCell>
                <TableCell className="text-sm">{r.type as string}</TableCell>
                <TableCell className="text-sm">{r.to_email as string}</TableCell>
                <TableCell className="text-sm">{r.trigger_source as string}</TableCell>
                <TableCell>
                  <Badge variant={r.status === "sent" ? "live" : "draft"}>{r.status as string}</Badge>
                </TableCell>
                <TableCell className="text-sm text-muted">{(r.error as string | null) ?? ""}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="mt-u2 flex items-center justify-between">
        {page > 1 ? (
          <Link href={href(type, page - 1)} className={`${chip} bg-surface-alt`}>
            ← Newer
          </Link>
        ) : (
          <span />
        )}
        <span className="text-sm text-muted">
          Page {page} of {pages}
        </span>
        {page < pages ? (
          <Link href={href(type, page + 1)} className={`${chip} bg-surface-alt`}>
            Older →
          </Link>
        ) : (
          <span />
        )}
      </div>
    </div>
  );
}
