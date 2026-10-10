import { neon } from "@neondatabase/serverless";

const url = process.env.DATABASE_URL;

if (!url) {
  throw new Error(
    "DATABASE_URL is missing. Add it to .env.local (see .env.example) or to the Vercel project's environment variables."
  );
}

/**
 * Tagged-template Postgres client. Values are sent as bind parameters, never
 * string-concatenated:
 *
 *   const rows = await sql`select * from students where email = ${email}`;
 *
 * For a transaction use sql.transaction([sql`...`, sql`...`]).
 */
export const sql = neon(url, {
  // The driver talks to Neon over fetch(), and Next.js caches fetch() results
  // by default. Database reads must always be fresh (a course going live, a new
  // enrollment), so opt out of the cache for every query.
  fetchOptions: { cache: "no-store" },
});
