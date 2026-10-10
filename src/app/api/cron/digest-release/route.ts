import { NextResponse } from "next/server";
import { guardCron } from "@/lib/cron";
import { releaseDrafted } from "@/lib/digest";

// Monday 8am Central. Sends every digest still 'drafted' to its insider.
// A digest the admin vetoed in between is never sent.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const blocked = await guardCron(request, "digest-release");
  if (blocked) return blocked;

  return NextResponse.json(await releaseDrafted());
}
