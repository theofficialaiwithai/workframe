// Prints the public tables and the crons_paused flag. Usage: npm run db:check
import { sql } from "../src/lib/db";

async function main() {
  const tables = await sql`
    select table_name from information_schema.tables
    where table_schema = 'public' and table_type = 'BASE TABLE'
    order by table_name`;
  console.log(`Public tables (${tables.length}):`);
  for (const t of tables) console.log(`  - ${t.table_name}`);

  const flag = await sql`select value from system_flags where key = 'crons_paused'`;
  console.log(
    `crons_paused = ${flag.length ? flag[0].value : "(row missing)"}`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
