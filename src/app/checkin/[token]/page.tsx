import type { Metadata } from "next";
import { CheckinForm } from "@/components/checkin-form";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

// The token is the only credential: keep these URLs out of search results and
// out of the Referer header.
export const metadata: Metadata = {
  title: "Check-in | Workframe",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default async function CheckinPage({ params }: { params: { token: string } }) {
  // Only the check-in row is read. No student or enrollment details are ever
  // fetched or shown on this page.
  const rows = /^[a-f0-9]{64}$/.test(params.token)
    ? await sql`select checkpoint, submitted_at from checkins where token = ${params.token}`
    : [];

  return (
    <div className="mx-auto max-w-[640px] py-u4 md:py-u5">
      {rows.length === 0 ? (
        <>
          <h1 className="text-3xl font-bold">Check-in</h1>
          <p className="mt-u2 text-lg text-muted">This link isn&apos;t valid.</p>
        </>
      ) : rows[0].submitted_at ? (
        <>
          <h1 className="text-3xl font-bold">Check-in</h1>
          <p className="mt-u2 text-lg">Thanks, you&apos;ve already answered.</p>
        </>
      ) : (
        <>
          <h1 className="text-3xl font-bold">Day {rows[0].checkpoint} check-in</h1>
          <div className="mt-u3">
            <CheckinForm token={params.token} />
          </div>
        </>
      )}
    </div>
  );
}
