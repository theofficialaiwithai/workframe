// Seeds the three beta insiders and courses. Safe to run repeatedly.
// Re-running never changes a course's status, so a course you made live with
// `npm run course:live` stays live. Usage: npm run db:seed
import { sql } from "../src/lib/db";

const notifyEmail = process.env.ADMIN_NOTIFY_EMAIL;
if (!notifyEmail) {
  console.error("ADMIN_NOTIFY_EMAIL is missing from .env.local");
  process.exit(1);
}

const seed = [
  {
    insider: {
      slug: "real-estate-insider",
      name: "Real Estate Insider (placeholder)",
      profession: "real-estate",
      bio: "A working real estate agent who has spent years juggling the MLS, a spreadsheet and an inbox. Placeholder bio: the real insider will replace this.",
    },
    course: {
      slug: "real-estate-automation",
      title: "Real Estate Automation",
      summary: [
        "Build your Monday lead follow-up list from your pipeline",
        "Pull this week's new listings from an MLS export into one clean sheet",
        "Flag leads that have gone quiet for 14 days",
        "Put your weekly market snapshot numbers in one place",
        "Track open house sign-ins and who to call back",
      ].join("\n"),
    },
  },
  {
    insider: {
      slug: "legal-insider",
      name: "Legal Insider (placeholder)",
      profession: "legal",
      bio: "A practicing lawyer who has done contract review and case tracking by hand. Placeholder bio: the real insider will replace this.",
    },
    course: {
      slug: "legal-automation",
      title: "Legal Automation",
      summary: [
        "Build a watch list of contracts renewing in the next 60 days",
        "Pull parties, dates and amounts out of a folder of contracts",
        "Turn your case spreadsheet into a deadline list",
        "Create a one-page case status view",
        "Log billable time from a calendar export",
      ].join("\n"),
    },
  },
  {
    insider: {
      slug: "fitness-insider",
      name: "Fitness Insider (placeholder)",
      profession: "fitness",
      bio: "A personal trainer who has tracked client progress in notebooks and spreadsheets. Placeholder bio: the real insider will replace this.",
    },
    course: {
      slug: "fitness-automation",
      title: "Fitness Automation",
      summary: [
        "Check each client's weekly attendance and flag anyone who fell behind",
        "Build next week's program from a template",
        "Track progress from a weekly check-in sheet",
        "Roll four weeks of attendance into a monthly summary",
        "Spot clients who missed two sessions in a row",
      ].join("\n"),
    },
  },
];

async function main() {
  for (const { insider, course } of seed) {
    const [row] = await sql`
      insert into insiders (slug, name, email, profession, bio)
      values (${insider.slug}, ${insider.name}, ${notifyEmail}, ${insider.profession}, ${insider.bio})
      on conflict (slug) do update
        set name = excluded.name, email = excluded.email,
            profession = excluded.profession, bio = excluded.bio
      returning id`;

    // status is deliberately NOT updated on conflict.
    await sql`
      insert into courses (slug, insider_id, title, summary, price_cents, status)
      values (${course.slug}, ${row.id}, ${course.title}, ${course.summary}, 19900, 'draft')
      on conflict (slug) do update
        set insider_id = excluded.insider_id, title = excluded.title,
            summary = excluded.summary, price_cents = excluded.price_cents`;
    console.log(`seeded ${course.slug}`);
  }

  const counts = await sql`
    select (select count(*)::int from insiders) as insiders,
           (select count(*)::int from courses) as courses`;
  console.log(`insiders: ${counts[0].insiders}, courses: ${counts[0].courses}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
