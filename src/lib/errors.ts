import { sql } from "@/lib/db";

/**
 * Record an error in error_log and in the console. NEVER throws: a failure to
 * log must not take down the request or cron job that is already failing.
 *
 * Do not pass secrets, raw webhook bodies or student text in `detail`.
 */
export async function logError(
  source: string,
  message: string,
  detail?: unknown
): Promise<void> {
  console.error(`[${source}] ${message}`);
  try {
    const json = detail === undefined ? null : JSON.stringify(detail);
    await sql`
      insert into error_log (source, message, detail)
      values (${source}, ${message}, ${json}::jsonb)
    `;
  } catch (err) {
    console.error(
      `[errors] could not write to error_log: ${(err as Error).message}`
    );
  }
}
