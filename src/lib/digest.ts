// The insider weekly digest (PRD 5.6 / 11.5): stats, the Claude draft, the
// identifying-text guard, and the Monday release. The cron routes are thin
// wrappers around these functions so the rules can be tested on their own.
import { getAnthropic, MODEL } from "@/lib/anthropic";
import { sql } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { digestAdminEmail, digestInsiderEmail } from "@/lib/email-templates";
import { logError } from "@/lib/errors";
import { countedHours, HOURS_LABEL } from "@/lib/extraction";

export const DIGEST_PROMPT_VERSION = "digest-v1";

export const DIGEST_SYSTEM_PROMPT =
  "You write a short weekly summary for the instructor of an online course. Use only the numbers and notes provided. Under 250 words, plain markdown. Always describe hours saved as 'student-reported, AI-estimated'. Summarize the common obstacles students mention in themes; never quote a student, and never include a name or email. This is a draft summary for the instructor, not a finding; do not claim causes you cannot see in the data.";

// ---------------------------------------------------------------- pure helpers

/** The Monday after `now`, as YYYY-MM-DD, by the calendar in Chicago (PRD 11.5). */
export function comingMonday(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)!.value;
  const dow = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(get("weekday"));
  const add = (1 - dow + 7) % 7 || 7; // a Monday gets the Monday a week later
  const d = new Date(Date.UTC(Number(get("year")), Number(get("month")) - 1, Number(get("day")) + add));
  return d.toISOString().slice(0, 10);
}

/** Names shorter than this would match inside ordinary words, so they are not used. */
const MIN_IDENTIFIER_LENGTH = 3;

function usable(identifiers: (string | null | undefined)[]): string[] {
  return identifiers
    .map((i) => (i ?? "").trim())
    .filter((i) => i.length >= MIN_IDENTIFIER_LENGTH);
}

/**
 * The guard (PRD 5.6): true if the text contains any student's name or email
 * from the course, case-insensitive substring match.
 */
export function containsIdentifyingText(
  text: string,
  identifiers: (string | null | undefined)[]
): boolean {
  const haystack = text.toLowerCase();
  return usable(identifiers).some((i) => haystack.includes(i.toLowerCase()));
}

const EMAIL_PATTERN = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;

/** Remove emails and known student names/emails from free text before Claude sees it. */
export function scrub(text: string, identifiers: (string | null | undefined)[]): string {
  let out = text.replace(EMAIL_PATTERN, "[email removed]");
  for (const id of usable(identifiers)) {
    const escaped = id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    out = out.replace(new RegExp(escaped, "gi"), "[student]");
  }
  return out.trim().slice(0, 500);
}

// ---------------------------------------------------------------------- stats

export interface DigestStats {
  course: string;
  week_start: string;
  enrollments_total: number;
  new_this_week: number;
  checkins_sent: number;
  checkins_submitted: number;
  response_rate: number | null;
  hours_saved_counted: number;
  hours_saved_label: string;
  extractions_pending: number;
  blockers_themes_input: string[];
}

async function studentIdentifiers(courseId: string): Promise<string[]> {
  const rows = await sql`
    select s.name, s.email from enrollments e
    join students s on s.id = e.student_id
    where e.course_id = ${courseId}::uuid`;
  return rows.flatMap((r) => [r.name as string | null, r.email as string | null]).filter(Boolean) as string[];
}

/** The exact numbers (and scrubbed notes) that are given to Claude. */
export async function buildStats(
  course: { id: string; title: string },
  weekStart: string,
  identifiers?: string[]
): Promise<DigestStats> {
  const ids = identifiers ?? (await studentIdentifiers(course.id));
  const r = (
    await sql`
      select
        (select count(*)::int from enrollments where course_id = ${course.id}::uuid) as enrollments_total,
        (select count(*)::int from enrollments where course_id = ${course.id}::uuid
           and purchased_at > now() - interval '7 days') as new_this_week,
        (select count(*)::int from checkins c join enrollments e on e.id = c.enrollment_id
           where e.course_id = ${course.id}::uuid and c.sent_at is not null) as checkins_sent,
        (select count(*)::int from checkins c join enrollments e on e.id = c.enrollment_id
           where e.course_id = ${course.id}::uuid and c.submitted_at is not null) as checkins_submitted,
        (select count(*)::int from extractions x join checkins c on c.id = x.checkin_id
           join enrollments e on e.id = c.enrollment_id
           where e.course_id = ${course.id}::uuid and x.status = 'pending_review') as extractions_pending`
  )[0];

  const blockers = await sql`
    select c.blockers from checkins c join enrollments e on e.id = c.enrollment_id
    where e.course_id = ${course.id}::uuid
      and c.submitted_at > now() - interval '7 days'
      and c.blockers is not null and btrim(c.blockers) <> ''
    order by c.submitted_at limit 100`;

  const sent = r.checkins_sent as number;
  const submitted = r.checkins_submitted as number;
  return {
    course: course.title,
    week_start: weekStart,
    enrollments_total: r.enrollments_total as number,
    new_this_week: r.new_this_week as number,
    checkins_sent: sent,
    checkins_submitted: submitted,
    response_rate: sent === 0 ? null : Math.round((submitted / sent) * 100) / 100,
    hours_saved_counted: await countedHours(course.id),
    hours_saved_label: HOURS_LABEL,
    extractions_pending: r.extractions_pending as number,
    blockers_themes_input: blockers.map((b) => scrub(b.blockers as string, ids)),
  };
}

// --------------------------------------------------------------------- drafting

export type DraftResult =
  | { status: "drafted"; digestId: string; body: string }
  | { status: "failed"; digestId: string; reason: string }
  | { status: "exists" }
  | { status: "error" };

/**
 * Draft one course's digest for one week. At most one digest per course and
 * week: an existing one is left alone. If the text names or emails any student
 * of the course it is stored as 'failed' and never sent. If Claude cannot be
 * reached nothing is stored, so the next run can try again.
 */
export async function draftDigest(
  course: { id: string; title: string },
  weekStart: string
): Promise<DraftResult> {
  try {
    const exists = await sql`
      select 1 from digests where course_id = ${course.id}::uuid and week_start = ${weekStart}::date`;
    if (exists.length > 0) return { status: "exists" };

    const identifiers = await studentIdentifiers(course.id);
    const stats = await buildStats(course, weekStart, identifiers);

    const response = await getAnthropic().messages.create({
      model: MODEL,
      max_tokens: 700,
      system: DIGEST_SYSTEM_PROMPT,
      messages: [{ role: "user", content: JSON.stringify(stats, null, 2) }],
    });
    const body = response.content
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("")
      .trim();
    if (!body) throw new Error("Claude returned an empty digest");

    const identifying = containsIdentifyingText(body, identifiers);
    const status = identifying ? "failed" : "drafted";
    const rows = await sql`
      insert into digests (course_id, week_start, body_md, stats, status, failure_reason, model, prompt_version)
      values (${course.id}::uuid, ${weekStart}::date, ${identifying ? null : body},
              ${JSON.stringify(stats)}::jsonb, ${status},
              ${identifying ? "identifying text" : null}, ${MODEL}, ${DIGEST_PROMPT_VERSION})
      on conflict (course_id, week_start) do nothing
      returning id`;
    if (rows.length === 0) return { status: "exists" };

    if (identifying) {
      await logError("digest", "digest held back: identifying text", { course: course.title, week: weekStart });
      return { status: "failed", digestId: rows[0].id as string, reason: "identifying text" };
    }
    return { status: "drafted", digestId: rows[0].id as string, body };
  } catch (err) {
    await logError("digest", "could not draft digest", {
      course: course.title,
      week: weekStart,
      error: (err as Error).message,
    });
    return { status: "error" };
  }
}

export interface DraftSummary {
  week_start: string;
  drafted: number;
  failed: number;
  skipped: number;
  errors: number;
  emailed: boolean;
}

/** Draft a digest for every live course that has at least one enrollment, then email the admin. */
export async function draftAllDigests(now: Date = new Date()): Promise<DraftSummary> {
  const weekStart = comingMonday(now);
  const courses = (await sql`
    select c.id, c.title from courses c
    where c.status = 'live' and exists (select 1 from enrollments e where e.course_id = c.id)
    order by c.title`) as unknown as { id: string; title: string }[];

  const summary: DraftSummary = { week_start: weekStart, drafted: 0, failed: 0, skipped: 0, errors: 0, emailed: false };
  const lines: string[] = [];
  const firstDigestId: string[] = [];

  for (const course of courses) {
    const result = await draftDigest(course, weekStart);
    if (result.status === "drafted") {
      summary.drafted++;
      firstDigestId.push(result.digestId);
      lines.push(`${course.title}, week of ${weekStart}:\n\n${result.body}`);
    } else if (result.status === "failed") {
      summary.failed++;
      firstDigestId.push(result.digestId);
      lines.push(`${course.title}, week of ${weekStart}: held back (the text contained a student's name or email). It will not be sent.`);
    } else if (result.status === "exists") summary.skipped++;
    else summary.errors++;
  }

  const notify = process.env.ADMIN_NOTIFY_EMAIL;
  const appUrl = process.env.APP_URL;
  if (lines.length > 0) {
    if (!notify || !appUrl) {
      await logError("digest", "ADMIN_NOTIFY_EMAIL or APP_URL is not set; admin was not emailed");
    } else {
      const result = await sendEmail({
        type: "digest_admin",
        to: notify,
        ...digestAdminEmail({ summaryLines: lines, adminUrl: `${appUrl}/admin/digests` }),
        digestId: firstDigestId[0],
        trigger: "cron_digest_draft",
        inputSnapshot: { week_start: weekStart, drafted: summary.drafted, failed: summary.failed },
      });
      summary.emailed = result.ok;
    }
  }
  return summary;
}

// --------------------------------------------------------------------- release

export interface ReleaseSummary {
  sent: number;
  failed: number;
  skipped: number;
}

/**
 * Monday release. Sends every digest still 'drafted' to its insider. Vetoed and
 * failed digests are never touched. The status is re-read immediately before
 * each send, so a veto that lands during the run still wins.
 */
export async function releaseDrafted(): Promise<ReleaseSummary> {
  const rows = (await sql`
    select d.id, d.body_md, c.title as course_title, i.name as insider_name, i.email as insider_email
    from digests d
    join courses c on c.id = d.course_id
    join insiders i on i.id = c.insider_id
    where d.status = 'drafted'
    order by d.drafted_at`) as unknown as {
    id: string;
    body_md: string | null;
    course_title: string;
    insider_name: string;
    insider_email: string;
  }[];

  const summary: ReleaseSummary = { sent: 0, failed: 0, skipped: 0 };
  for (const d of rows) {
    try {
      const current = await sql`select status from digests where id = ${d.id}::uuid`;
      if (current.length === 0 || current[0].status !== "drafted" || !d.body_md) {
        summary.skipped++;
        continue;
      }
      const result = await sendEmail({
        type: "digest_insider",
        to: d.insider_email,
        ...digestInsiderEmail({ insiderName: d.insider_name, courseTitle: d.course_title, bodyMd: d.body_md }),
        digestId: d.id,
        trigger: "cron_digest_release",
        inputSnapshot: { course: d.course_title },
      });
      if (!result.ok) {
        summary.failed++;
        await logError("digest", "insider digest email failed", { digest: d.id });
        continue; // stays 'drafted'
      }
      const marked = await sql`
        update digests set status = 'sent', sent_at = now()
        where id = ${d.id}::uuid and status = 'drafted' returning id`;
      if (marked.length === 0) {
        await logError("digest", "digest was sent but its status had already changed", { digest: d.id });
      }
      summary.sent++;
    } catch (err) {
      summary.failed++;
      await logError("digest", "could not release digest", { digest: d.id, error: (err as Error).message });
    }
  }
  return summary;
}
