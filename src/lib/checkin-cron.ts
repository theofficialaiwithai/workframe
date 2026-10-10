import { randomBytes } from "node:crypto";
import { sql } from "@/lib/db";
import { sendEmail, type SendEmailInput, type SendEmailResult } from "@/lib/email";
import { checkinEmail } from "@/lib/email-templates";
import { logError } from "@/lib/errors";

export type SendFn = (input: SendEmailInput) => Promise<SendEmailResult>;

export interface CheckinSummary {
  sent: number;
  failed: number;
  retried: number;
}

const CHECKPOINTS = [3, 7] as const;

/**
 * The daily check-in job (PRD 5.4 / 11.2) for day 3 and day 7.
 *
 * New: an active enrollment that has reached the checkpoint and has no
 * check-in row gets one. The row is inserted FIRST (unique on enrollment +
 * checkpoint), then the email is sent, then sent_at is set.
 *
 * Retry: a check-in whose email failed (sent_at still empty, never answered)
 * is tried again on the next run, with the SAME link. To stay clear of a run
 * that is still sending, only rows older than an hour are retried; to stop
 * hopeless addresses being retried forever, only rows from the last 14 days.
 * A retry first claims the row (sets sent_at) so two runs cannot both send it,
 * and releases the claim if the send fails.
 *
 * `send` is injectable so tests can run this without sending real email.
 */
export async function sendDueCheckins(
  appUrl: string,
  send: SendFn = sendEmail
): Promise<CheckinSummary> {
  const summary: CheckinSummary = { sent: 0, failed: 0, retried: 0 };

  for (const checkpoint of CHECKPOINTS) {
    let due: {
      enrollment_id: string;
      email: string;
      name: string | null;
      checkin_id: string | null;
      token: string | null;
    }[];
    try {
      due = (await sql`
        select e.id as enrollment_id, s.email, s.name, c.id as checkin_id, c.token
        from enrollments e
        join students s on s.id = e.student_id
        left join checkins c on c.enrollment_id = e.id and c.checkpoint = ${checkpoint}::smallint
        where e.status = 'active'
          and e.purchased_at + make_interval(days => ${checkpoint}::int) <= now()
          and (
            c.id is null
            or (c.sent_at is null and c.submitted_at is null
                and c.created_at < now() - interval '1 hour'
                and c.created_at > now() - interval '14 days')
          )`) as unknown as typeof due;
    } catch (err) {
      await logError("cron_checkins", "could not find due enrollments", {
        checkpoint,
        error: (err as Error).message,
      });
      summary.failed++;
      continue;
    }

    for (const row of due) {
      let checkinId = row.checkin_id;
      let token = row.token;
      const isRetry = checkinId !== null;
      try {
        if (!isRetry) {
          token = randomBytes(32).toString("hex");
          const inserted = await sql`
            insert into checkins (enrollment_id, checkpoint, token)
            values (${row.enrollment_id}::uuid, ${checkpoint}::smallint, ${token})
            on conflict (enrollment_id, checkpoint) do nothing
            returning id`;
          if (inserted.length === 0) continue; // another run got there first
          checkinId = inserted[0].id as string;
        } else {
          const claimed = await sql`
            update checkins set sent_at = now()
            where id = ${checkinId}::uuid and sent_at is null and submitted_at is null
            returning id`;
          if (claimed.length === 0) continue; // another run took it
          summary.retried++;
        }

        const result = await send({
          type: "checkin",
          to: row.email,
          ...checkinEmail({ name: row.name, checkpoint, url: `${appUrl}/checkin/${token}` }),
          enrollmentId: row.enrollment_id,
          trigger: "cron_checkins",
          // The token is a credential: it is never written to the log.
          inputSnapshot: { checkpoint, retry: isRetry },
        });

        if (result.ok) {
          if (!isRetry) await sql`update checkins set sent_at = now() where id = ${checkinId}::uuid`;
          summary.sent++;
        } else {
          if (isRetry) await sql`update checkins set sent_at = null where id = ${checkinId}::uuid`;
          summary.failed++;
          await logError("cron_checkins", "check-in email failed", {
            enrollment: row.enrollment_id,
            checkpoint,
            retry: isRetry,
          });
        }
      } catch (err) {
        summary.failed++;
        if (isRetry && checkinId) {
          await sql`update checkins set sent_at = null where id = ${checkinId}::uuid and submitted_at is null`;
        }
        await logError("cron_checkins", "could not process enrollment", {
          enrollment: row.enrollment_id,
          checkpoint,
          error: (err as Error).message,
        });
      }
    }
  }
  return summary;
}
