import { NextResponse } from "next/server";
import { guardCron } from "@/lib/cron";
import { draftAllDigests } from "@/lib/digest";
import { pickWeeklySample } from "@/lib/sampling";

// Sunday 6pm Central (PRD 5.6 / 11.5). Samples last week's extractions for
// review, drafts a digest per live course, and emails the draft to the admin.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  const blocked = await guardCron(request, "digest-draft");
  if (blocked) return blocked;

  const sampled = await pickWeeklySample();
  const digests = await draftAllDigests();
  return NextResponse.json({ sampled, ...digests });
}
