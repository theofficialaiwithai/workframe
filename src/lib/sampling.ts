import { sql } from "@/lib/db";

/**
 * Weekly sampling (PRD 11.4). Picks a random 20% (minimum 5, or all of them if
 * fewer) of the auto-accepted extractions from the last 7 days that have not
 * been sampled yet, and stamps them with sampled_at so they show up in
 * /admin/sampling. One statement, so the pool and the pick cannot drift apart.
 * Returns how many were picked.
 */
export async function pickWeeklySample(): Promise<number> {
  const rows = await sql`
    with pool as (
      select id from extractions
      where status = 'auto_accepted'
        and sampled_at is null
        and created_at > now() - interval '7 days'
    ),
    pick as (
      select id from pool
      order by random()
      limit (select least(count(*), greatest(5, ceil(0.2 * count(*))))::int from pool)
    )
    update extractions set sampled_at = now()
    where id in (select id from pick)
    returning id`;
  return rows.length;
}
