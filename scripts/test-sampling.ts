// Tests the weekly sampling rule against the real database with throwaway
// fixtures. Usage: npm run test:sampling
import { randomBytes, randomUUID } from "node:crypto";
import { sql } from "../src/lib/db";
import { pickWeeklySample } from "../src/lib/sampling";

let failures = 0;
const check = (name: string, ok: boolean, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  " + detail : ""}`);
  if (!ok) failures++;
};
const expected = (pool: number) => Math.min(pool, Math.max(5, Math.ceil(0.2 * pool)));

let n = 0;
let courseId = "";
let insiderId = "";
async function fixture(opts: { status?: string; ageDays?: number; sampled?: boolean }) {
  const i = ++n;
  const s = await sql`insert into students (email) values (${`sampling-test-${i}@example.com`}) returning id`;
  const e = await sql`insert into enrollments (student_id, course_id, insider_id, stripe_session_id, amount_cents, purchased_at)
                      values (${s[0].id}::uuid, ${courseId}::uuid, ${insiderId}::uuid, ${"cs_test_sampling_" + i + randomUUID()}, 19900, now() + interval '365 days') returning id`;
  const c = await sql`insert into checkins (enrollment_id, checkpoint, token, raw_answer, submitted_at)
                      values (${e[0].id}::uuid, 3, ${randomBytes(32).toString("hex")}, 'TEST sampling fixture', now()) returning id`;
  const x = await sql`insert into extractions (checkin_id, task, minutes_before, minutes_after, runs_in_week, hours_saved, confidence, status, sampled_at, model, prompt_version, created_at)
                      values (${c[0].id}::uuid, 'TEST sampling fixture', 30, 10, 1, 0.33, 0.9, ${opts.status ?? "auto_accepted"},
                              ${opts.sampled ? new Date().toISOString() : null}, 'claude-sonnet-5-5', 'extract-v1',
                              now() - make_interval(days => ${opts.ageDays ?? 0}::int)) returning id`;
  return x[0].id as string;
}
const poolSize = async () =>
  (await sql`select count(*)::int n from extractions where status='auto_accepted' and sampled_at is null and created_at > now() - interval '7 days'`)[0].n as number;
const sampledIds = async () => new Set((await sql`select id from extractions where sampled_at is not null`).map((r) => r.id as string));

async function cleanup() {
  const ids = (await sql`select id from students where email like 'sampling-test-%@example.com'`).map((r) => r.id as string);
  if (ids.length === 0) return;
  await sql`delete from extractions where checkin_id in (select c.id from checkins c join enrollments e on e.id=c.enrollment_id where e.student_id = any(${ids}::uuid[]))`;
  await sql`delete from checkins where enrollment_id in (select id from enrollments where student_id = any(${ids}::uuid[]))`;
  await sql`delete from enrollments where student_id = any(${ids}::uuid[])`;
  await sql`delete from students where id = any(${ids}::uuid[])`;
}

(async () => {
  await cleanup();
  const c = (await sql`select id, insider_id from courses where slug = 'real-estate-automation'`)[0];
  courseId = c.id as string;
  insiderId = c.insider_id as string;

  // Real rows that are in the pool right now: their sampled_at is put back at the end.
  const realEligible = (
    await sql`select id from extractions where status='auto_accepted' and sampled_at is null and created_at > now() - interval '7 days'`
  ).map((r) => r.id as string);

  try {
    const keep = new Set<string>();
    for (let i = 0; i < 30; i++) keep.add(await fixture({}));
    const old = await fixture({ ageDays: 8 });
    const pending = await fixture({ status: "pending_review" });
    const approved = await fixture({ status: "approved" });
    const already = await fixture({ sampled: true });
    const alreadyStamp = (await sql`select sampled_at from extractions where id = ${already}::uuid`)[0].sampled_at;

    // 1. A big pool: 20%, rounded up
    let pool = await poolSize();
    let picked = await pickWeeklySample();
    check(`pool of ${pool}: picks max(5, ceil(20%)) = ${expected(pool)}`, picked === expected(pool), `got ${picked}`);
    check("picked rows are stamped with sampled_at", (await sampledIds()).size >= picked);

    // 2. Rows that must never be picked
    const stamped = await sampledIds();
    check("a row older than 7 days is never picked", !stamped.has(old));
    check("a pending_review row is never picked", !stamped.has(pending));
    check("an approved row is never picked", !stamped.has(approved));
    const after = (await sql`select sampled_at from extractions where id = ${already}::uuid`)[0].sampled_at;
    check("an already sampled row keeps its original stamp", new Date(after).getTime() === new Date(alreadyStamp).getTime());

    // 3. Calling again only draws from what is left
    pool = await poolSize();
    const before = (await sampledIds()).size;
    picked = await pickWeeklySample();
    check(`second run, pool of ${pool}: picks ${expected(pool)}`, picked === expected(pool), `got ${picked}`);
    check("second run never re-picks earlier rows", (await sampledIds()).size === before + picked);

    // 4. Drain down to a small pool: fewer than 5 means "all of them"
    for (let guard = 0; guard < 20 && (await poolSize()) > 5; guard++) await pickWeeklySample();
    pool = await poolSize();
    if (pool > 0 && pool <= 5) {
      picked = await pickWeeklySample();
      check(`small pool of ${pool}: picks all ${pool}`, picked === pool, `got ${picked}`);
    } else {
      check("could reach a small pool", pool === 0, `pool=${pool}`);
    }

    // 5. Empty pool
    check("an empty pool picks nothing and does not fail", (await pickWeeklySample()) === 0);
    void keep;
  } finally {
    await cleanup();
    // put the real rows back exactly as they were
    if (realEligible.length > 0) {
      await sql`update extractions set sampled_at = null where id = any(${realEligible}::uuid[])`;
    }
    const left = (await sql`select count(*)::int n from students where email like 'sampling-test-%@example.com'`)[0].n;
    console.log(`fixtures removed (${left} left); real rows restored: ${realEligible.length}`);
  }

  if (failures > 0) {
    console.error(`\n${failures} check(s) failed`);
    process.exit(1);
  }
  console.log("\nAll sampling checks passed");
})();
