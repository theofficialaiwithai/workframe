import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { guardCron } from "@/lib/cron";
import { sql } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { checkinEmail } from "@/lib/email-templates";
import { logError } from "@/lib/errors";

// Daily cron (PRD 5.4 / 11.2). Vercel Cron calls this with GET and sends
// "Authorization: Bearer $CRON_SECRET" automatically.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CHECKPOINTS = [3, 7] as const;

export async function GET(request: Request) {
  // Auth and kill switch first. Nothing below runs if either blocks.
  const blocked = await guardCron(request, "checkins");
  if (blocked) return blocked;

  const appUrl = process.env.APP_URL;
  if (!appUrl) {
    await logError("cron_checkins", "APP_URL is not set");
    return NextResponse.json({ error: "not configured" }, { status: 500 });
  }

  let sent = 0;
  let failed = 0;

  for (const checkpoint of CHECKPOINTS) {
    let due: { enrollment_id: string; email: string; name: string | null }[];
    try {
      due = (await sql`
        select e.id as enrollment_id, s.email, s.name
        from enrollments e
        join students s on s.id = e.student_id
        where e.status = 'active'
          and e.purchased_at + make_interval(days => ${checkpoint}::int) <= now()
          and not exists (
            select 1 from checkins c
            where c.enrollment_id = e.id and c.checkpoint = ${checkpoint}::smallint
          )`) as unknown as typeof due;
    } catch (err) {
      await logError("cron_checkins", "could not find due enrollments", {
        checkpoint,
        error: (err as Error).message,
      });
      failed++;
      continue;
    }

    for (const row of due) {
      try {
        // Insert FIRST. unique (enrollment_id, checkpoint) means two overlapping
        // runs can never both create (and so never both send) the same check-in.
        const token = randomBytes(32).toString("hex");
        const inserted = await sql`
          insert into checkins (enrollment_id, checkpoint, token)
          values (${row.enrollment_id}::uuid, ${checkpoint}::smallint, ${token})
          on conflict (enrollment_id, checkpoint) do nothing
          returning id`;
        if (inserted.length === 0) continue; // another run got there first

        const result = await sendEmail({
          type: "checkin",
          to: row.email,
          ...checkinEmail({
            name: row.name,
            checkpoint,
            url: `${appUrl}/checkin/${token}`,
          }),
          enrollmentId: row.enrollment_id,
          trigger: "cron_checkins",
          // The token is a credential: it is never written to the log.
          inputSnapshot: { checkpoint },
        });

        if (result.ok) {
          await sql`update checkins set sent_at = now() where id = ${inserted[0].id}::uuid`;
          sent++;
        } else {
          failed++;
          await logError("cron_checkins", "check-in email failed", {
            enrollment: row.enrollment_id,
            checkpoint,
          });
        }
      } catch (err) {
        failed++;
        await logError("cron_checkins", "could not process enrollment", {
          enrollment: row.enrollment_id,
          checkpoint,
          error: (err as Error).message,
        });
      }
    }
  }

  return NextResponse.json({ sent, failed });
}
