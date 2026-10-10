import { ReviewTable } from "@/components/admin/review-table";
import { requireAdmin } from "@/lib/admin";
import { listPendingReviews } from "@/lib/admin-data";
import { HOURS_LABEL } from "@/lib/extraction";

export const dynamic = "force-dynamic";

export default async function ExtractionsPage() {
  await requireAdmin();
  const rows = await listPendingReviews();

  return (
    <div>
      <h1 className="text-3xl font-bold">Extractions to review</h1>
      <p className="mt-u1 max-w-[720px] text-muted">
        Held rows do not count toward any total until you approve or correct them. Hours are{" "}
        {HOURS_LABEL}. Oldest first.
      </p>
      <div className="mt-u3">
        {rows.length === 0 ? (
          <p className="rounded-lg border border-border bg-surface p-u3">Nothing is waiting for review.</p>
        ) : (
          <div className="rounded-lg border border-border bg-surface">
            <ReviewTable rows={rows} mode="review" />
          </div>
        )}
      </div>
    </div>
  );
}
