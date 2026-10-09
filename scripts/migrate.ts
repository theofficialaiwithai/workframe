// Runs every .sql file in db/migrations (filename order) that has not run yet,
// one transaction per file. Usage: npm run db:migrate
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Pool, neonConfig } from "@neondatabase/serverless";
import ws from "ws";

neonConfig.webSocketConstructor = ws;

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is missing. Add it to .env.local first.");
  process.exit(1);
}

async function main() {
  const pool = new Pool({ connectionString: url });
  const client = await pool.connect();
  try {
    await client.query(
      `create table if not exists schema_migrations (
         name text primary key,
         ran_at timestamptz default now()
       )`
    );

    const done = new Set(
      (await client.query("select name from schema_migrations")).rows.map(
        (r) => r.name as string
      )
    );

    const dir = join(process.cwd(), "db", "migrations");
    const files = readdirSync(dir)
      .filter((f) => f.endsWith(".sql"))
      .sort();

    let ran = 0;
    for (const file of files) {
      if (done.has(file)) {
        console.log(`skip   ${file} (already ran)`);
        continue;
      }
      const text = readFileSync(join(dir, file), "utf8");
      try {
        await client.query("begin");
        await client.query(text);
        await client.query("insert into schema_migrations (name) values ($1)", [
          file,
        ]);
        await client.query("commit");
        console.log(`ran    ${file}`);
        ran++;
      } catch (err) {
        await client.query("rollback");
        console.error(`FAILED ${file}: ${(err as Error).message}`);
        process.exitCode = 1;
        return;
      }
    }
    console.log(ran === 0 ? "Nothing to run. Database is up to date." : `Done. ${ran} migration(s) ran.`);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
