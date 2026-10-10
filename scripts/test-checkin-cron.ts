// Tests the check-in job (new sends, retries, who is skipped) against the real
// database with a FAKE sender: no email is sent. Usage: npm run test:checkin-cron
import { randomBytes, randomUUID } from "node:crypto";
import { sql } from "../src/lib/db";
import { sendDueCheckins } from "../src/lib/checkin-cron";
import type { SendEmailInput } from "../src/lib/email";

let failures = 0;
const check = (name: string, ok: boolean, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  " + detail : ""}`);
  if (!ok) failures++;
};

const mail = (n: number) => `checkin-cron-test-${n}@example.com`;
let courseId = "";
let insiderId = "";
const tokens = new Map<string, string>();

async function enrollment(n: number, daysAgo: number, status = "active"): Promise<string> {
  const s = await sql`insert into students (email) values (${mail(n)}) returning id`;
  const e = await sql`
    insert into enrollments (student_id, course_id, insider_id, stripe_session_id, amount_cents, status, purchased_at)
    values (${s[0].id}::uuid, ${courseId}::uuid, ${insiderId}::uuid, ${"cs_test_cc_" + n + randomUUID()}, 19900, ${status},
            now() - make_interval(days => ${daysAgo}::int, hours => 1))
    returning id`;
  return e[0].id as string;
}
async function existingCheckin(enrollmentId: string, opts: { ageHours: number; submitted?: boolean }) {
  const token = randomBytes(32).toString("hex");
  await sql`
    insert into checkins (enrollment_id, checkpoint, token, created_at, submitted_at, raw_answer)
    values (${enrollmentId}::uuid, 3, ${token}, now() - make_interval(hours => ${opts.ageHours}::int),
            ${opts.submitted ? new Date().toISOString() : null}, ${opts.submitted ? "TEST answer" : null})`;
  return token;
}
const rowFor = async (enrollmentId: string, cp: number) =>
  (await sql`select token, sent_at is not null as sent from checkins where enrollment_id = ${enrollmentId}::uuid and checkpoint = ${cp}::smallint`)[0] as
    | { token: string; sent: boolean }
    | undefined;

async function cleanup() {
  const ids = (await sql`select id from students where email like 'checkin-cron-test-%@example.com'`).map((r) => r.id as string);
  if (ids.length === 0) return;
  await sql`delete from email_log where to_email like 'checkin-cron-test-%@example.com'`;
  await sql`delete from checkins where enrollment_id in (select id from enrollments where student_id = any(${ids}::uuid[]))`;
  await sql`delete from enrollments where student_id = any(${ids}::uuid[])`;
  await sql`delete from students where id = any(${ids}::uuid[])`;
}

(async () => {
  await cleanup();
  const c = (await sql`select id, insider_id from courses where slug = 'real-estate-automation'`)[0];
  courseId = c.id as string;
  insiderId = c.insider_id as string;

  // Refuse to run if a real student has check-in work pending: it would be touched too.
  const realDue = (await sql`
    select count(*)::int n from enrollments e join students s on s.id = e.student_id
    where e.status = 'active' and s.email not like 'checkin-cron-test-%'
      and e.purchased_at + interval '3 days' <= now()
      and not exists (select 1 from checkins c where c.enrollment_id = e.id and c.checkpoint = 3 and (c.sent_at is not null or c.submitted_at is not null))`)[0].n as number;
  if (realDue > 0) {
    console.error(`Aborting: ${realDue} real enrollment(s) have check-ins due. Run this after they are handled.`);
    process.exit(1);
  }

  const calls: { to: string; token: string; retry: boolean }[] = [];
  const failFor = new Set<string>();
  const fake = async (input: SendEmailInput) => {
    const token = /checkin\/([a-f0-9]{64})/.exec(input.text)?.[1] ?? "";
    calls.push({ to: input.to, token, retry: (input.inputSnapshot as { retry?: boolean })?.retry === true });
    return failFor.has(input.to) ? { ok: false } : { ok: true, id: "fake" };
  };
  const to = (n: number) => calls.filter((x) => x.to === mail(n));

  try {
    const e1 = await enrollment(1, 4); // due day 3, sends fine
    const e2 = await enrollment(2, 4); // due day 3, the send FAILS
    const e3 = await enrollment(3, 1); // not due yet
    const e4 = await enrollment(4, 4, "refunded"); // refunded: never
    const e5 = await enrollment(5, 8); // due day 3 and day 7
    const e6 = await enrollment(6, 4); // earlier failed attempt, 3 hours old: retry
    const e7 = await enrollment(7, 25); // earlier failed attempt, 20 days old: give up
    const e8 = await enrollment(8, 4); // attempt only 5 minutes old: probably still sending
    const e9 = await enrollment(9, 4); // already answered
    tokens.set("e6", await existingCheckin(e6, { ageHours: 3 }));
    await existingCheckin(e7, { ageHours: 24 * 20 }); // day 3: failed 20 days ago
    await sql`insert into checkins (enrollment_id, checkpoint, token, submitted_at, raw_answer)
              values (${e7}::uuid, 7, ${randomBytes(32).toString("hex")}, now(), 'TEST answer')`; // day 7: already answered
    const t8 = randomBytes(32).toString("hex");
    await sql`insert into checkins (enrollment_id, checkpoint, token, created_at) values (${e8}::uuid, 3, ${t8}, now() - interval '5 minutes')`;
    await existingCheckin(e9, { ageHours: 3, submitted: true });
    failFor.add(mail(2));

    // ---- run 1
    const r1 = await sendDueCheckins("http://test.local", fake);
    check("new student at day 3 gets one email", to(1).length === 1 && !to(1)[0].retry);
    check("a failed send leaves the row unsent", to(2).length === 1 && (await rowFor(e2, 3))?.sent === false);
    check("a successful send marks the row sent", (await rowFor(e1, 3))?.sent === true);
    check("not-yet-due student is untouched", to(3).length === 0 && (await rowFor(e3, 3)) === undefined);
    check("a refunded enrollment is never emailed", to(4).length === 0 && (await rowFor(e4, 3)) === undefined);
    check("an 8-day-old enrollment gets BOTH day 3 and day 7", to(5).length === 2 && (await rowFor(e5, 3)) && (await rowFor(e5, 7)) ? true : false);
    check("a failed earlier attempt is retried", to(6).length === 1 && to(6)[0].retry === true);
    check("a retry uses the SAME link", to(6)[0].token === tokens.get("e6"));
    check("a successful retry marks it sent", (await rowFor(e6, 3))?.sent === true);
    check("an attempt older than 14 days is not retried", to(7).length === 0);
    check("an attempt under an hour old is not retried (may still be sending)", to(8).length === 0);
    check("an answered check-in is never emailed again", to(9).length === 0);
    check("summary counts: 4 sent (1, 5 twice, 6) + 1 failed (2), 1 retried", r1.sent === 4 && r1.failed === 1 && r1.retried === 1, JSON.stringify(r1));

    // ---- run 2: the next day, with the failure fixed
    calls.length = 0;
    failFor.clear();
    await sql`update checkins set created_at = now() - interval '2 hours' where enrollment_id = ${e2}::uuid`;
    const t2 = (await rowFor(e2, 3))!.token;
    const r2 = await sendDueCheckins("http://test.local", fake);
    check("run 2: the earlier failure is retried and now succeeds", to(2).length === 1 && to(2)[0].retry && (await rowFor(e2, 3))?.sent === true);
    check("run 2: still the same link", to(2)[0].token === t2);
    check("run 2: students already emailed are not emailed again", to(1).length === 0 && to(5).length === 0 && to(6).length === 0);
    check("run 2: summary", r2.sent === 1 && r2.failed === 0 && r2.retried === 1, JSON.stringify(r2));

    // ---- run 3: nothing left
    calls.length = 0;
    const r3 = await sendDueCheckins("http://test.local", fake);
    check("run 3: nothing to send", calls.length === 0 && r3.sent === 0 && r3.failed === 0);

    // ---- one row per enrollment and checkpoint, always
    const dup = (await sql`select count(*)::int n from (select enrollment_id, checkpoint from checkins group by 1,2 having count(*) > 1) d`)[0].n;
    check("never more than one check-in per enrollment and checkpoint", dup === 0);
  } finally {
    await cleanup();
    const left = (await sql`select count(*)::int n from students where email like 'checkin-cron-test-%@example.com'`)[0].n;
    console.log(`fixtures removed (${left} left)`);
  }

  if (failures > 0) {
    console.error(`\n${failures} check(s) failed`);
    process.exit(1);
  }
  console.log("\nAll check-in cron checks passed");
})();
