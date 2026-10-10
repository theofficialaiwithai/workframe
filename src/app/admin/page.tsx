import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
import { adminCounts, killSwitchInfo } from "@/lib/admin-data";
import { countedHours, HOURS_LABEL } from "@/lib/extraction";

export const dynamic = "force-dynamic";

function Stat({ title, value, note, href }: { title: string; value: string; note?: string; href?: string }) {
  const body = (
    <Card className="h-full bg-surface">
      <CardHeader>
        <CardTitle className="text-sm font-medium text-muted">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-4xl font-bold">{value}</p>
        {note && <p className="mt-u1 text-sm text-muted">{note}</p>}
      </CardContent>
    </Card>
  );
  return href ? (
    <Link href={href} className="block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      {body}
    </Link>
  ) : (
    body
  );
}

export default async function AdminPage() {
  await requireAdmin();
  const [counts, hours, kill] = await Promise.all([adminCounts(), countedHours(), killSwitchInfo()]);

  return (
    <div>
      <h1 className="text-3xl font-bold">Admin</h1>
      <div className="mt-u3 grid grid-cols-1 gap-u2 sm:grid-cols-2 lg:grid-cols-3">
        <Stat title="Extractions pending review" value={String(counts.pending)} href="/admin/extractions" />
        <Stat title="Sampled, awaiting review" value={String(counts.sampled)} href="/admin/sampling" />
        <Stat title="Digests drafted" value={String(counts.digests)} />
        <Stat title="Hours saved (counted rows only)" value={hours.toFixed(2)} note={HOURS_LABEL} />
        <Stat
          title="Automated jobs"
          value={kill.paused ? "Paused" : "Running"}
          note={kill.known ? undefined : "Could not read the switch; treated as paused."}
          href="/admin/system"
        />
      </div>
    </div>
  );
}
