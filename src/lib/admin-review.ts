// The database side of the admin review actions (PRD 5.4). No auth lives here:
// every caller MUST be a server action that has already called requireAdmin().
// Kept separate from the actions so the rules can be tested on their own.
import { sql } from "@/lib/db";
import { computeHours } from "@/lib/extraction-rules";

export type ReviewResult = { ok: boolean; message: string };
const fail = (message: string): ReviewResult => ({ ok: false, message });
const done = (message: string): ReviewResult => ({ ok: true, message });

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function checkNote(raw: string, required: boolean): { note: string } | { error: string } {
  const note = raw.trim();
  if (required && note.length === 0) return { error: "Please add a note." };
  if (note.length > 500) return { error: "Keep the note under 500 characters." };
  return { note };
}

export function checkFigures(
  before: number,
  after: number,
  runs: number
): { before: number; after: number; runs: number } | { error: string } {
  if (![before, after].every((n) => Number.isInteger(n) && n >= 0 && n <= 100000)) {
    return { error: "Minutes must be whole numbers from 0 to 100000." };
  }
  if (!Number.isInteger(runs) || runs < 1 || runs > 1000) {
    return { error: "Runs must be a whole number from 1 to 1000." };
  }
  if (after >= before) {
    return { error: "Minutes after must be less than minutes before. If nothing was saved, reject it." };
  }
  return { before, after, runs };
}

/** Approve a held extraction as Claude read it. Only positive hours can be approved. */
export async function approve(id: string, note: string): Promise<ReviewResult> {
  if (!UUID.test(id)) return fail("Invalid item.");
  const n = checkNote(note, false);
  if ("error" in n) return fail(n.error);
  const rows = await sql`
    update extractions
    set status = 'approved', reviewed_at = now(), review_note = ${n.note || null}
    where id = ${id}::uuid and status = 'pending_review' and hours_saved > 0
    returning id`;
  return rows.length === 0
    ? fail("Cannot approve: it was already reviewed, or its hours are not positive. Correct or reject it instead.")
    : done("Approved. It now counts.");
}

/** Reject a held extraction. A note is required. It never counts. */
export async function reject(id: string, note: string): Promise<ReviewResult> {
  if (!UUID.test(id)) return fail("Invalid item.");
  const n = checkNote(note, true);
  if ("error" in n) return fail(n.error);
  const rows = await sql`
    update extractions
    set status = 'rejected', reviewed_at = now(), review_note = ${n.note}
    where id = ${id}::uuid and status = 'pending_review'
    returning id`;
  return rows.length === 0 ? fail("It was already reviewed.") : done("Rejected. It will not count.");
}

/**
 * Correct the numbers on a held extraction ("review") or a sampled one
 * ("sample"). Hours are recalculated here in code; a note is required. Claude's
 * original reply stays in raw_response for the audit trail.
 */
export async function correct(
  id: string,
  mode: "review" | "sample",
  input: { before: number; after: number; runs: number; note: string }
): Promise<ReviewResult> {
  if (!UUID.test(id)) return fail("Invalid item.");
  const n = checkNote(input.note, true);
  if ("error" in n) return fail(n.error);
  const f = checkFigures(input.before, input.after, input.runs);
  if ("error" in f) return fail(f.error);
  const hours = computeHours(f.before, f.after, f.runs);

  const rows =
    mode === "review"
      ? await sql`
          update extractions
          set minutes_before = ${f.before}::int, minutes_after = ${f.after}::int,
              runs_in_week = ${f.runs}::int, hours_saved = ${hours}::numeric,
              status = 'corrected', reviewed_at = now(), review_note = ${n.note}
          where id = ${id}::uuid and status = 'pending_review'
          returning id`
      : await sql`
          update extractions
          set minutes_before = ${f.before}::int, minutes_after = ${f.after}::int,
              runs_in_week = ${f.runs}::int, hours_saved = ${hours}::numeric,
              status = 'corrected', sample_result = 'corrected', reviewed_at = now(),
              review_note = ${n.note}
          where id = ${id}::uuid and sampled_at is not null and sample_result is null
          returning id`;
  return rows.length === 0 ? fail("It was already reviewed.") : done(`Corrected to ${hours} hours.`);
}

/** Confirm a sampled extraction was right. Its status stays auto_accepted. */
export async function confirm(id: string, note: string): Promise<ReviewResult> {
  if (!UUID.test(id)) return fail("Invalid item.");
  const n = checkNote(note, false);
  if ("error" in n) return fail(n.error);
  const rows = await sql`
    update extractions
    set sample_result = 'confirmed', reviewed_at = now(), review_note = ${n.note || null}
    where id = ${id}::uuid and sampled_at is not null and sample_result is null
    returning id`;
  return rows.length === 0 ? fail("It was already reviewed.") : done("Confirmed.");
}

/** Veto a drafted digest. Only a 'drafted' digest can be vetoed; the release cron never touches it. */
export async function vetoDigest(id: string): Promise<ReviewResult> {
  if (!UUID.test(id)) return fail("Invalid item.");
  const rows = await sql`
    update digests set status = 'vetoed', vetoed_at = now()
    where id = ${id}::uuid and status = 'drafted'
    returning id`;
  return rows.length === 0
    ? fail("Only a drafted digest can be vetoed. It may already have been sent or vetoed.")
    : done("Vetoed. It will not be sent.");
}
