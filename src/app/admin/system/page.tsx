import { KillSwitch } from "@/components/admin/kill-switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireAdmin } from "@/lib/admin";
import { formatTime, killSwitchInfo, recentErrors } from "@/lib/admin-data";

export const dynamic = "force-dynamic";

export default async function SystemPage() {
  await requireAdmin();
  const [kill, errors] = await Promise.all([killSwitchInfo(), recentErrors(20)]);

  return (
    <div>
      <h1 className="text-3xl font-bold">System</h1>

      <section className="mt-u3 rounded-lg border border-border bg-surface p-u3">
        <h2 className="text-xl font-bold">Kill switch</h2>
        <p className="mt-u1 max-w-[640px] text-muted">
          When on, every scheduled job returns immediately: no emails are sent and Claude is not
          called. Each skipped run is logged.
        </p>
        <div className="mt-u2">
          <KillSwitch initialPaused={kill.paused} />
        </div>
        <p className="mt-u1 text-sm text-muted">
          {kill.known
            ? kill.updatedBy
              ? `Last changed by ${kill.updatedBy} on ${formatTime(kill.updatedAt)} (Central).`
              : `Never changed by an admin. Last updated ${formatTime(kill.updatedAt)} (Central).`
            : "The switch could not be read, so jobs are treated as paused."}
        </p>
      </section>

      <section className="mt-u4">
        <h2 className="text-xl font-bold">Recent errors</h2>
        <p className="mt-u1 text-muted">The 20 most recent rows from the error log.</p>
        <div className="mt-u2 rounded-lg border border-border bg-surface">
          <Table className="min-w-[860px]">
            <TableHeader>
              <TableRow>
                <TableHead>Time (Central)</TableHead>
                <TableHead>Source</TableHead>
                <TableHead className="min-w-[360px]">Message</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {errors.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="text-muted">
                    No errors logged.
                  </TableCell>
                </TableRow>
              )}
              {errors.map((e) => (
                <TableRow key={e.id as string} className="align-top">
                  <TableCell className="whitespace-nowrap text-sm">{formatTime(e.created_at as Date)}</TableCell>
                  <TableCell className="text-sm">{e.source as string}</TableCell>
                  <TableCell className="text-sm">
                    {e.message as string}
                    {e.detail ? (
                      <span className="mt-[5px] block break-all font-mono text-xs text-muted">{e.detail as string}</span>
                    ) : null}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>
    </div>
  );
}
