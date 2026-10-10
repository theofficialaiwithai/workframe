import { ActionForm } from "@/components/admin/action-form";
import { Markdown } from "@/components/markdown";
import { Badge } from "@/components/ui/badge";
import { vetoDigest } from "@/app/admin/actions";
import { requireAdmin } from "@/lib/admin";
import { formatTime, listDigests } from "@/lib/admin-data";
import { HOURS_LABEL } from "@/lib/extraction";

export const dynamic = "force-dynamic";

const STATUS_NOTE: Record<string, string> = {
  drafted: "Drafted: will be sent to the insider Monday morning unless you veto it.",
  vetoed: "Vetoed: will not be sent.",
  sent: "Sent to the insider.",
  failed: "Failed: held back and will never be sent.",
};

export default async function DigestsPage() {
  await requireAdmin();
  const digests = await listDigests();

  return (
    <div>
      <h1 className="text-3xl font-bold">Insider digests</h1>
      <p className="mt-u1 max-w-[720px] text-muted">
        A draft summary for each insider, written every Sunday evening and sent on Monday morning
        unless you veto it. Hours are {HOURS_LABEL}.
      </p>

      <div className="mt-u3 space-y-u2">
        {digests.length === 0 && (
          <p className="rounded-lg border border-border bg-surface p-u3">
            No digests yet. The first is drafted on Sunday evening.
          </p>
        )}
        {digests.map((d) => (
          <article key={d.id} className="rounded-lg border border-border bg-surface p-u3">
            <div className="flex flex-wrap items-center justify-between gap-u1">
              <div>
                <h2 className="text-xl font-bold">{d.course_title}</h2>
                <p className="text-sm text-muted">
                  Week of {d.week_start} · drafted {formatTime(d.drafted_at)} (Central)
                </p>
              </div>
              <Badge variant={d.status === "sent" ? "live" : "draft"}>{d.status}</Badge>
            </div>
            <p className="mt-u1 text-sm text-muted">{STATUS_NOTE[d.status] ?? d.status}</p>

            {d.status === "failed" && (
              <p className="mt-u2 rounded-md bg-surface-alt p-u2 text-sm">
                Failure reason: <strong>{d.failure_reason ?? "unknown"}</strong>
              </p>
            )}

            {d.body_md && (
              <div className="mt-u2">
                <p className="text-sm font-bold uppercase tracking-wide text-muted">Draft summary</p>
                <div className="mt-u1 rounded-md bg-surface-alt p-u2">
                  <Markdown>{d.body_md}</Markdown>
                </div>
              </div>
            )}

            {d.status === "drafted" && (
              <div className="mt-u2 max-w-[240px]">
                <ActionForm
                  action={vetoDigest.bind(null, d.id)}
                  label="Veto this digest"
                />
              </div>
            )}
          </article>
        ))}
      </div>
    </div>
  );
}
