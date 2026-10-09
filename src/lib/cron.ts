import { timingSafeEqual } from "node:crypto";
import { cronsPaused } from "@/lib/flags";
import { logError } from "@/lib/errors";

function validBearer(header: string | null): boolean {
  const secret = process.env.CRON_SECRET;
  // No secret configured means nothing can ever match: fail closed.
  if (!secret || !header) return false;
  const given = Buffer.from(header);
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/**
 * Gate for every /api/cron/* route. Call it first:
 *
 *   const blocked = await guardCron(request, "checkins");
 *   if (blocked) return blocked;
 *   // ...do the work
 *
 * Return contract:
 *   - Response 401 { error: "unauthorized" }   -> missing or wrong CRON_SECRET
 *   - Response 200 { skipped: "paused" }       -> kill switch is on (also logged
 *                                                 to error_log as "paused: <jobName>")
 *   - null                                     -> authorized and not paused: go ahead
 */
export async function guardCron(
  request: Request,
  jobName: string
): Promise<Response | null> {
  if (!validBearer(request.headers.get("authorization"))) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  if (await cronsPaused()) {
    await logError("cron", `paused: ${jobName}`);
    return Response.json({ skipped: "paused" }, { status: 200 });
  }
  return null;
}
