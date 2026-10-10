"use server";

import { sql } from "@/lib/db";
import { runExtraction } from "@/lib/extraction";
import { logError } from "@/lib/errors";

export type CheckinState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "done"; alreadyAnswered?: boolean };

const TOKEN = /^[a-f0-9]{64}$/;

/**
 * Save a check-in answer. The token is the only credential. The update is a
 * single conditional statement (`submitted_at is null`), so double-clicks and
 * replays cannot overwrite an earlier answer.
 */
export async function submitCheckin(
  _prev: CheckinState,
  formData: FormData
): Promise<CheckinState> {
  const token = String(formData.get("token") ?? "");
  const answer = String(formData.get("answer") ?? "").trim();
  const blockers = String(formData.get("blockers") ?? "").trim();

  if (!TOKEN.test(token)) {
    return { status: "error", message: "This link isn't valid." };
  }
  if (answer.length < 10 || answer.length > 2000) {
    return {
      status: "error",
      message: "Please write between 10 and 2000 characters in the first box.",
    };
  }
  if (blockers.length > 1000) {
    return {
      status: "error",
      message: "Please keep what got in your way under 1000 characters.",
    };
  }

  const updated = await sql`
    update checkins
    set raw_answer = ${answer}, blockers = ${blockers || null}, submitted_at = now()
    where token = ${token} and submitted_at is null
    returning id`;

  if (updated.length === 0) {
    const exists = await sql`select 1 from checkins where token = ${token}`;
    return exists.length > 0
      ? { status: "done", alreadyAnswered: true }
      : { status: "error", message: "This link isn't valid." };
  }

  // A failure here must never block the student's thank-you.
  try {
    await runExtraction(updated[0].id as string);
  } catch (err) {
    await logError("extraction", "runExtraction threw", {
      checkin: updated[0].id,
      error: (err as Error).message,
    });
  }

  return { status: "done" };
}
