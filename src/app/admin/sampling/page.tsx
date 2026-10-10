import { ReviewTable } from "@/components/admin/review-table";
import { requireAdmin } from "@/lib/admin";
import { listSampledForReview, sampleAgreement } from "@/lib/admin-data";
import { HOURS_LABEL } from "@/lib/extraction";

export const dynamic = "force-dynamic";

export default async function SamplingPage() {
  await requireAdmin();
  const [rows, agreement] = await Promise.all([listSampledForReview(), sampleAgreement()]);

  return (
    <div>
      <h1 className="text-3xl font-bold">Weekly sampling review</h1>
      <p className="mt-u1 max-w-[720px] text-muted">
        A random sample of auto-accepted extractions. Confirm each one, or correct it. Hours are{" "}
        {HOURS_LABEL}.
      </p>
      <p className="mt-u2 text-lg">
        Agreement, last 4 weeks:{" "}
        <strong>{agreement.rate === null ? "-" : `${Math.round(agreement.rate * 100)}%`}</strong>{" "}
        <span className="text-sm text-muted">
          ({agreement.confirmed} confirmed, {agreement.corrected} corrected)
        </span>
      </p>
      <div className="mt-u3">
        {rows.length === 0 ? (
          <p className="rounded-lg border border-border bg-surface p-u3">
            Nothing sampled yet. Sampling runs each Sunday.
          </p>
        ) : (
          <div className="rounded-lg border border-border bg-surface">
            <ReviewTable rows={rows} mode="sample" />
          </div>
        )}
      </div>
    </div>
  );
}
