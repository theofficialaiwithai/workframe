// Tests the kill switch and the cron guard against the real database.
// Usage: npm run test:guards   (restores the flag exactly as it found it)
import { sql } from "../src/lib/db";
import { guardCron } from "../src/lib/cron";
import { cronsPaused, setCronsPaused } from "../src/lib/flags";

let failures = 0;
function check(name: string, ok: boolean, extra = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? "  " + extra : ""}`);
  if (!ok) failures++;
}

const url = "http://localhost/api/cron/test";
const secret = process.env.CRON_SECRET;
const withAuth = (value?: string) =>
  new Request(url, { headers: value ? { authorization: value } : {} });

async function main() {
  if (!secret) throw new Error("CRON_SECRET is missing from .env.local");

  const before = (
    await sql`select value, updated_at, updated_by from system_flags where key = 'crons_paused'`
  )[0];
  const errorsBefore = (
    await sql`select count(*)::int as n from error_log where message = 'paused: test-guards'`
  )[0].n as number;

  try {
    // 1. Auth
    await setCronsPaused(false, "test:guards");
    const noHeader = await guardCron(withAuth(), "test-guards");
    check("401 without the secret", noHeader?.status === 401);

    const wrong = await guardCron(withAuth("Bearer not-the-secret"), "test-guards");
    check("401 with a wrong secret", wrong?.status === 401);

    // 2. Paused: right secret, flag on
    await setCronsPaused(true, "test:guards");
    const paused = await guardCron(withAuth(`Bearer ${secret}`), "test-guards");
    const body = paused ? await paused.json() : null;
    check(
      "paused response when the flag is true",
      paused?.status === 200 && body?.skipped === "paused",
      JSON.stringify(body)
    );
    const errorsAfter = (
      await sql`select count(*)::int as n from error_log where message = 'paused: test-guards'`
    )[0].n as number;
    check("paused case wrote a row to error_log", errorsAfter === errorsBefore + 1);

    // 3. Go ahead: right secret, flag off
    await setCronsPaused(false, "test:guards");
    const go = await guardCron(withAuth(`Bearer ${secret}`), "test-guards");
    check("null (go ahead) when the flag is false and the secret is right", go === null);

    // 4. Fail closed: a flag that cannot be read counts as paused
    const closed = await cronsPaused(async () => {
      throw new Error("simulated read failure");
    });
    check("fails closed (paused) when the flag cannot be read", closed === true);
  } finally {
    // Restore the flag exactly as found.
    await sql`
      update system_flags
      set value = ${before.value}, updated_at = ${before.updated_at}, updated_by = ${before.updated_by}
      where key = 'crons_paused'`;
    const now = (await sql`select value from system_flags where key = 'crons_paused'`)[0];
    console.log(`flag restored: crons_paused = ${now.value}`);
  }

  if (failures > 0) {
    console.error(`\n${failures} check(s) failed`);
    process.exit(1);
  }
  console.log("\nAll guard checks passed");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
