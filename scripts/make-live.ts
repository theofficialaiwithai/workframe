// Sets a course to 'live' so purchases can be tested.
// Usage: npm run course:live <slug>
import { sql } from "../src/lib/db";

async function main() {
  const slug = process.argv[2];
  if (!slug) {
    console.error("Usage: npm run course:live <slug>");
    process.exit(1);
  }
  const rows = await sql`
    update courses set status = 'live' where slug = ${slug} returning slug, status`;
  if (rows.length === 0) {
    const all = await sql`select slug from courses order by slug`;
    console.error(`No course with slug "${slug}". Available: ${all.map((r) => r.slug).join(", ")}`);
    process.exit(1);
  }
  console.log(`${rows[0].slug} is now ${rows[0].status}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
