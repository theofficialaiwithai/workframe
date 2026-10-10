import { getAnthropic, MODEL } from "@/lib/anthropic";
import { sql } from "@/lib/db";
import { logError } from "@/lib/errors";
import {
  applyRules,
  COUNTED_STATUSES,
  EXTRACT_PROMPT_VERSION,
  EXTRACT_SYSTEM_PROMPT,
  parseExtraction,
} from "@/lib/extraction-rules";

export { EXTRACT_PROMPT_VERSION } from "@/lib/extraction-rules";

/** Anywhere hours saved is shown, it carries this label (PRD 5.4, amplifier framing). */
export const HOURS_LABEL = "student-reported, AI-estimated";

/**
 * Turn one submitted check-in into a structured hours-saved estimate (PRD 11.3).
 *
 * Only the student's own words go to Claude: no name, no email. Every run
 * writes exactly one extractions row with the full audit trail, and anything
 * doubtful is held as pending_review so it counts nowhere until a person
 * approves it. NEVER throws: the student's thank-you must not depend on this.
 */
export async function runExtraction(checkinId: string): Promise<void> {
  let rawText: string | null = null;
  try {
    const rows = await sql`
      select raw_answer from checkins
      where id = ${checkinId}::uuid and raw_answer is not null`;
    if (rows.length === 0) return;
    const rawAnswer = rows[0].raw_answer as string;

    // One extraction per check-in, even if this is somehow called twice.
    const existing = await sql`select 1 from extractions where checkin_id = ${checkinId}::uuid`;
    if (existing.length > 0) return;

    try {
      const response = await getAnthropic().messages.create({
        model: MODEL,
        max_tokens: 600,
        system: EXTRACT_SYSTEM_PROMPT,
        messages: [{ role: "user", content: rawAnswer }],
      });
      rawText = response.content
        .map((block) => (block.type === "text" ? block.text : ""))
        .join("");

      const parsed = parseExtraction(rawText);
      const outcome = applyRules(parsed, rawAnswer);

      await sql`
        insert into extractions
          (checkin_id, task, minutes_before, minutes_after, runs_in_week, hours_saved,
           confidence, evidence_phrases, status, hold_reason, model, prompt_version, raw_response)
        values
          (${checkinId}::uuid, ${outcome.task}, ${outcome.minutes_before}::int,
           ${outcome.minutes_after}::int, ${outcome.runs_in_week}::int,
           ${outcome.hours_saved}::numeric, ${outcome.confidence}::numeric,
           ${outcome.evidence_phrases}::text[], ${outcome.status}, ${outcome.hold_reason},
           ${MODEL}, ${EXTRACT_PROMPT_VERSION},
           ${JSON.stringify({ parsed, raw_text: rawText })}::jsonb)`;
    } catch (err) {
      // API failure or an invalid reply: a failed row, and it counts nowhere.
      const message = (err as Error).message;
      await logError("extraction", "extraction failed", { checkin: checkinId, error: message });
      await sql`
        insert into extractions
          (checkin_id, status, hold_reason, model, prompt_version, raw_response)
        values
          (${checkinId}::uuid, 'failed', ${message.slice(0, 200)}, ${MODEL},
           ${EXTRACT_PROMPT_VERSION},
           ${JSON.stringify({ error: message, raw_text: rawText })}::jsonb)`;
    }
  } catch (err) {
    await logError("extraction", "runExtraction could not record its result", {
      checkin: checkinId,
      error: (err as Error).message,
    });
  }
}

/**
 * Total hours saved across counted extractions only (PRD Section 9). Pass a
 * course id to total just that course; omit it for everything.
 */
export async function countedHours(courseId?: string): Promise<number> {
  const statuses = [...COUNTED_STATUSES];
  const rows = await sql`
    select coalesce(sum(x.hours_saved), 0) as total
    from extractions x
    join checkins c on c.id = x.checkin_id
    join enrollments e on e.id = c.enrollment_id
    where x.status = any(${statuses}::text[])
      and (${courseId ?? null}::uuid is null or e.course_id = ${courseId ?? null}::uuid)`;
  return Number(rows[0].total);
}
