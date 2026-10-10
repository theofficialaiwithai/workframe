import { NextResponse } from "next/server";
import { sendDueCheckins } from "@/lib/checkin-cron";
import { guardCron } from "@/lib/cron";
import { logError } from "@/lib/errors";

// Daily cron (PRD 5.4 / 11.2). Vercel Cron calls this with GET and sends
// "Authorization: Bearer $CRON_SECRET" automatically.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  // Auth and kill switch first. Nothing below runs if either blocks.
  const blocked = await guardCron(request, "checkins");
  if (blocked) return blocked;

  const appUrl = process.env.APP_URL;
  if (!appUrl) {
    await logError("cron_checkins", "APP_URL is not set");
    return NextResponse.json({ error: "not configured" }, { status: 500 });
  }

  return NextResponse.json(await sendDueCheckins(appUrl));
}
