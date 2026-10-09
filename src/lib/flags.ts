import { sql } from "@/lib/db";
import { logError } from "@/lib/errors";

const CRONS_PAUSED = "crons_paused";

/** Reads the raw flag. Throws if the row is missing or the query fails. */
async function readCronsPausedFlag(): Promise<boolean> {
  const rows = await sql`
    select value from system_flags where key = ${CRONS_PAUSED}
  `;
  if (rows.length === 0) throw new Error("system_flags row 'crons_paused' is missing");
  return rows[0].value === true;
}

/**
 * The kill switch (PRD 5.5, 11.6). True means every cron job must stop before
 * sending anything or calling Claude.
 *
 * FAILS CLOSED: if the flag cannot be read for any reason, the system is
 * treated as PAUSED and the failure is logged. `read` is injectable so tests
 * can prove this.
 */
export async function cronsPaused(
  read: () => Promise<boolean> = readCronsPausedFlag
): Promise<boolean> {
  try {
    return await read();
  } catch (err) {
    await logError("flags", "could not read crons_paused; treating as PAUSED", {
      error: (err as Error).message,
    });
    return true;
  }
}

/** Flip the kill switch and record who did it and when. */
export async function setCronsPaused(
  value: boolean,
  updatedBy: string
): Promise<void> {
  await sql`
    insert into system_flags (key, value, updated_at, updated_by)
    values (${CRONS_PAUSED}, ${value}, now(), ${updatedBy})
    on conflict (key) do update
      set value = excluded.value,
          updated_at = excluded.updated_at,
          updated_by = excluded.updated_by
  `;
}
