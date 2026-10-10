// Moves a student's enrollment purchase date back by N days so the day 3 / day 7
// check-ins can be tested without waiting. Usage: npm run dev:backdate <email> <days>
import { sql } from "../src/lib/db";

async function main() {
  const email = process.argv[2]?.trim().toLowerCase();
  const days = Number(process.argv[3]);
  if (!email || !Number.isInteger(days) || days < 1) {
    console.error("Usage: npm run dev:backdate <email> <days>   (days is a whole number, 1 or more)");
    process.exit(1);
  }
  const rows = await sql`
    update enrollments e
    set purchased_at = e.purchased_at - make_interval(days => ${days}::int)
    from students s
    where s.id = e.student_id and s.email = ${email}
    returning e.id, e.purchased_at`;
  if (rows.length === 0) {
    console.error(`No enrollment found for ${email}`);
    process.exit(1);
  }
  for (const r of rows) {
    console.log(`enrollment ${String(r.id).slice(0, 8)}… purchased_at is now ${new Date(r.purchased_at).toISOString()}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
