import "server-only";
import { sql } from "@/lib/db";

export interface ReviewRow {
  id: string;
  course_title: string;
  task: string | null;
  minutes_before: number | null;
  minutes_after: number | null;
  runs_in_week: number | null;
  hours_saved: string | null;
  confidence: string | null;
  hold_reason: string | null;
  evidence_phrases: string[] | null;
  status: string;
  created_at: Date;
  sampled_at: Date | null;
  raw_answer: string;
}

/** Extractions held for a person: pending_review, oldest first. */
export async function listPendingReviews(): Promise<ReviewRow[]> {
  const rows = await sql`
    select x.id, co.title as course_title, x.task, x.minutes_before, x.minutes_after,
           x.runs_in_week, x.hours_saved, x.confidence, x.hold_reason, x.evidence_phrases,
           x.status, x.created_at, x.sampled_at, c.raw_answer
    from extractions x
    join checkins c on c.id = x.checkin_id
    join enrollments e on e.id = c.enrollment_id
    join courses co on co.id = e.course_id
    where x.status = 'pending_review'
    order by x.created_at asc`;
  return rows as unknown as ReviewRow[];
}

/** Auto-accepted extractions picked for the weekly sample and not yet reviewed. */
export async function listSampledForReview(): Promise<ReviewRow[]> {
  const rows = await sql`
    select x.id, co.title as course_title, x.task, x.minutes_before, x.minutes_after,
           x.runs_in_week, x.hours_saved, x.confidence, x.hold_reason, x.evidence_phrases,
           x.status, x.created_at, x.sampled_at, c.raw_answer
    from extractions x
    join checkins c on c.id = x.checkin_id
    join enrollments e on e.id = c.enrollment_id
    join courses co on co.id = e.course_id
    where x.sampled_at is not null and x.sample_result is null
    order by x.sampled_at asc`;
  return rows as unknown as ReviewRow[];
}

/** confirmed / reviewed over the last 4 weeks, or null when nothing was reviewed. */
export async function sampleAgreement(): Promise<{
  confirmed: number;
  corrected: number;
  rate: number | null;
}> {
  const r = await sql`
    select count(*) filter (where sample_result = 'confirmed')::int as confirmed,
           count(*) filter (where sample_result = 'corrected')::int as corrected
    from extractions
    where sample_result is not null and reviewed_at > now() - interval '28 days'`;
  const confirmed = r[0].confirmed as number;
  const corrected = r[0].corrected as number;
  const total = confirmed + corrected;
  return { confirmed, corrected, rate: total === 0 ? null : confirmed / total };
}

export async function adminCounts() {
  const r = await sql`
    select
      (select count(*)::int from extractions where status = 'pending_review') as pending,
      (select count(*)::int from extractions where sampled_at is not null and sample_result is null) as sampled,
      (select count(*)::int from digests where status = 'drafted') as digests`;
  return r[0] as { pending: number; sampled: number; digests: number };
}

export const EMAIL_PAGE_SIZE = 50;
export const EMAIL_TYPES = ["welcome", "checkin", "digest_admin", "digest_insider"] as const;

export async function listEmails(type: string | null, page: number) {
  const offset = (page - 1) * EMAIL_PAGE_SIZE;
  const total = (
    await sql`select count(*)::int as n from email_log where (${type}::text is null or type = ${type})`
  )[0].n as number;
  const rows = await sql`
    select id, type, to_email, trigger_source, status, error, created_at
    from email_log
    where (${type}::text is null or type = ${type})
    order by created_at desc
    limit ${EMAIL_PAGE_SIZE} offset ${offset}`;
  return { total, rows };
}

export async function recentErrors(limit = 20) {
  return await sql`
    select id, source, message, left(detail::text, 300) as detail, created_at
    from error_log order by created_at desc limit ${limit}`;
}

export async function killSwitchInfo(): Promise<{
  paused: boolean;
  known: boolean;
  updatedBy: string | null;
  updatedAt: Date | null;
}> {
  try {
    const r = await sql`select value, updated_by, updated_at from system_flags where key = 'crons_paused'`;
    if (r.length === 0) throw new Error("missing");
    return { paused: r[0].value === true, known: true, updatedBy: r[0].updated_by, updatedAt: r[0].updated_at };
  } catch {
    // Same rule as the cron guard: if it cannot be read, it counts as paused.
    return { paused: true, known: false, updatedBy: null, updatedAt: null };
  }
}

export function formatTime(d: Date | string | null): string {
  if (!d) return "-";
  return new Date(d).toLocaleString("en-US", {
    timeZone: "America/Chicago",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export interface DigestRow {
  id: string;
  course_title: string;
  week_start: string;
  status: string;
  body_md: string | null;
  failure_reason: string | null;
  stats: Record<string, unknown> | null;
  drafted_at: Date;
  vetoed_at: Date | null;
  sent_at: Date | null;
}

export async function listDigests(): Promise<DigestRow[]> {
  const rows = await sql`
    select d.id, c.title as course_title, to_char(d.week_start, 'YYYY-MM-DD') as week_start,
           d.status, d.body_md, d.failure_reason, d.stats, d.drafted_at, d.vetoed_at, d.sent_at
    from digests d join courses c on c.id = d.course_id
    order by d.drafted_at desc`;
  return rows as unknown as DigestRow[];
}
