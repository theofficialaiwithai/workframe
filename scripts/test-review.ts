// Tests the admin review rules (approve / correct / reject / confirm, counted
// hours, the review and sampling queues) against the real database, using
// throwaway fixtures that are removed at the end. Usage: npm run test:review
import { randomBytes, randomUUID } from "node:crypto";
import { sql } from "../src/lib/db";
import * as review from "../src/lib/admin-review";
import { listPendingReviews, listSampledForReview, sampleAgreement } from "../src/lib/admin-data";
import { computeHours } from "../src/lib/extraction-rules";
import { countedHours } from "../src/lib/extraction";

let failures = 0;
const check = (name: string, ok: boolean, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  " + detail : ""}`);
  if (!ok) failures++;
};

const EMAIL = (n: number) => `review-test-${n}@example.com`;
let counter = 0;
let courseId = "";
let insiderId = "";

async function fixture(opts: {
  status: string;
  hours: number;
  before?: number;
  after?: number;
  runs?: number;
  sampled?: boolean;
  answer?: string;
}): Promise<string> {
  const n = ++counter;
  const s = await sql`insert into students (email) values (${EMAIL(n)}) returning id`;
  const e = await sql`
    insert into enrollments (student_id, course_id, insider_id, stripe_session_id, amount_cents)
    values (${s[0].id}::uuid, ${courseId}::uuid, ${insiderId}::uuid, ${"cs_test_reviewtest_" + n + "_" + randomUUID()}, 19900)
    returning id`;
  const c = await sql`
    insert into checkins (enrollment_id, checkpoint, token, raw_answer, submitted_at)
    values (${e[0].id}::uuid, 3, ${randomBytes(32).toString("hex")}, ${opts.answer ?? "TEST: it took 40 minutes, now 10, 2 times"}, now())
    returning id`;
  const x = await sql`
    insert into extractions
      (checkin_id, task, minutes_before, minutes_after, runs_in_week, hours_saved, confidence,
       evidence_phrases, status, hold_reason, sampled_at, model, prompt_version, raw_response)
    values
      (${c[0].id}::uuid, 'TEST fixture', ${opts.before ?? 40}::int, ${opts.after ?? 10}::int, ${opts.runs ?? 2}::int,
       ${opts.hours}::numeric, 0.6, ${["took 40 minutes"]}::text[], ${opts.status},
       ${opts.status === "pending_review" ? "low confidence" : null}, ${opts.sampled ? new Date().toISOString() : null},
       'claude-sonnet-5-5', 'extract-v1', ${JSON.stringify({ original: true })}::jsonb)
    returning id`;
  return x[0].id as string;
}

async function row(id: string) {
  return (await sql`select status, hours_saved, minutes_before, minutes_after, runs_in_week, sample_result,
                           reviewed_at is not null as reviewed, review_note, raw_response from extractions where id = ${id}::uuid`)[0];
}

async function cleanup() {
  const ids = await sql`select s.id from students s where s.email like 'review-test-%@example.com'`;
  const sid = ids.map((r) => r.id as string);
  if (sid.length === 0) return;
  await sql`delete from extractions where checkin_id in (select c.id from checkins c join enrollments e on e.id=c.enrollment_id where e.student_id = any(${sid}::uuid[]))`;
  await sql`delete from checkins where enrollment_id in (select id from enrollments where student_id = any(${sid}::uuid[]))`;
  await sql`delete from enrollments where student_id = any(${sid}::uuid[])`;
  await sql`delete from students where id = any(${sid}::uuid[])`;
}

(async () => {
  await cleanup(); // in case an earlier run was interrupted
  const c = (await sql`select id, insider_id from courses where slug = 'real-estate-automation'`)[0];
  courseId = c.id as string;
  insiderId = c.insider_id as string;
  const base = await countedHours();

  try {
    // ---- the review queue
    const a = await fixture({ status: "pending_review", hours: 2 });
    const b = await fixture({ status: "pending_review", hours: -0.5, before: 10, after: 30, runs: 1 });
    const queue = await listPendingReviews();
    const mine = queue.filter((r) => r.task === "TEST fixture");
    check("queue lists pending_review rows with the course title", mine.length === 2 && mine[0].course_title.length > 0);
    check("queue is oldest first", queue.every((r, i) => i === 0 || new Date(queue[i - 1].created_at) <= new Date(r.created_at)));
    check("held rows are not counted yet", (await countedHours()) === base);

    // ---- approve
    const ok = await review.approve(a, "looks right");
    const ra = await row(a);
    check("approve works and sets status, reviewed_at and note", ok.ok && ra.status === "approved" && ra.reviewed && ra.review_note === "looks right");
    check("approved hours now count", Math.abs((await countedHours()) - (base + 2)) < 0.001);
    check("approving twice is refused", !(await review.approve(a, "")).ok);
    check("approved row left the queue", !(await listPendingReviews()).some((r) => r.id === a));

    // ---- approve is refused for non-positive hours
    check("cannot approve negative hours", !(await review.approve(b, "")).ok && (await row(b)).status === "pending_review");

    // ---- correct
    check("correct needs a note", !(await review.correct(b, "review", { before: 40, after: 10, runs: 2, note: "  " })).ok);
    check("correct rejects after >= before", !(await review.correct(b, "review", { before: 10, after: 10, runs: 1, note: "x" })).ok);
    check("correct rejects zero runs", !(await review.correct(b, "review", { before: 40, after: 10, runs: 0, note: "x" })).ok);
    check("correct rejects fractional minutes", !(await review.correct(b, "review", { before: 40.5, after: 10, runs: 1, note: "x" })).ok);
    check("a refused correction changed nothing", (await row(b)).status === "pending_review");
    const fixed = await review.correct(b, "review", { before: 60, after: 15, runs: 3, note: "student said an hour" });
    const rb = await row(b);
    check("correct recalculates hours in code and sets status 'corrected'", fixed.ok && rb.status === "corrected" && Number(rb.hours_saved) === computeHours(60, 15, 3), `hours=${rb.hours_saved}`);
    check("correct stores the note and reviewed_at", rb.review_note === "student said an hour" && rb.reviewed);
    check("Claude's original reply is kept for audit", (rb.raw_response as { original?: boolean }).original === true);
    check("corrected hours now count", Math.abs((await countedHours()) - (base + 2 + 2.25)) < 0.001);

    // ---- reject
    const r1 = await fixture({ status: "pending_review", hours: 5 });
    check("reject needs a note", !(await review.reject(r1, "")).ok && (await row(r1)).status === "pending_review");
    const rej = await review.reject(r1, "unclear");
    check("reject works and the row never counts", rej.ok && (await row(r1)).status === "rejected" && Math.abs((await countedHours()) - (base + 4.25)) < 0.001);
    check("a rejected row cannot be approved afterwards", !(await review.approve(r1, "")).ok);

    // ---- sampling
    const s1 = await fixture({ status: "auto_accepted", hours: 1, sampled: true });
    const s2 = await fixture({ status: "auto_accepted", hours: 3, sampled: true });
    const s3 = await fixture({ status: "auto_accepted", hours: 1, sampled: false });
    const sampled = (await listSampledForReview()).filter((r) => r.task === "TEST fixture");
    check("sampling queue shows only sampled, unreviewed rows", sampled.length === 2 && !sampled.some((r) => r.id === s3));
    const beforeAgree = await sampleAgreement();
    check("confirm works, status stays auto_accepted", (await review.confirm(s1, "")).ok && (await row(s1)).sample_result === "confirmed" && (await row(s1)).status === "auto_accepted");
    check("confirming twice is refused", !(await review.confirm(s1, "")).ok);
    const sc = await review.correct(s2, "sample", { before: 40, after: 10, runs: 1, note: "was 4 runs, not 6" });
    const rs2 = await row(s2);
    check("sample correction sets status 'corrected' and sample_result 'corrected'", sc.ok && rs2.status === "corrected" && rs2.sample_result === "corrected" && Number(rs2.hours_saved) === 0.5);
    check("an un-sampled row cannot be confirmed", !(await review.confirm(s3, "")).ok);
    const afterAgree = await sampleAgreement();
    check("agreement counts the confirmed and the corrected one", afterAgree.confirmed === beforeAgree.confirmed + 1 && afterAgree.corrected === beforeAgree.corrected + 1 && afterAgree.rate !== null);

    // ---- bad ids
    check("invalid ids are refused", !(await review.approve("not-a-uuid", "")).ok);
  } finally {
    await cleanup();
    const left = (await sql`select count(*)::int n from students where email like 'review-test-%@example.com'`)[0].n;
    console.log(`fixtures removed (${left} left), counted hours back to ${await countedHours()} (was ${base})`);
  }

  if (failures > 0) {
    console.error(`\n${failures} check(s) failed`);
    process.exit(1);
  }
  console.log("\nAll review checks passed");
})();
