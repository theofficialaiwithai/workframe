"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin";
import * as review from "@/lib/admin-review";
import { setCronsPaused } from "@/lib/flags";

// Every action starts with requireAdmin(): a server action is a public POST
// endpoint, so hiding the buttons is not protection. The rules themselves live
// in lib/admin-review.ts.

export type ActionResult = { ok: boolean; message: string } | null;

const text = (fd: FormData, k: string) => String(fd.get(k) ?? "");
const num = (fd: FormData, k: string) => Number(text(fd, k).trim());

function finish(result: review.ReviewResult): ActionResult {
  if (result.ok) revalidatePath("/admin", "layout");
  return result;
}

export async function approveExtraction(id: string, _prev: ActionResult, fd: FormData): Promise<ActionResult> {
  await requireAdmin();
  return finish(await review.approve(id, text(fd, "note")));
}

export async function rejectExtraction(id: string, _prev: ActionResult, fd: FormData): Promise<ActionResult> {
  await requireAdmin();
  return finish(await review.reject(id, text(fd, "note")));
}

export async function correctExtraction(
  id: string,
  mode: "review" | "sample",
  _prev: ActionResult,
  fd: FormData
): Promise<ActionResult> {
  await requireAdmin();
  return finish(
    await review.correct(id, mode === "sample" ? "sample" : "review", {
      before: num(fd, "minutes_before"),
      after: num(fd, "minutes_after"),
      runs: num(fd, "runs_in_week"),
      note: text(fd, "note"),
    })
  );
}

export async function confirmSample(id: string, _prev: ActionResult, fd: FormData): Promise<ActionResult> {
  await requireAdmin();
  return finish(await review.confirm(id, text(fd, "note")));
}

/** Veto button on /admin/digests. The form passes (previous state, form data); neither is needed. */
export async function vetoDigest(id: string, _prev: ActionResult, _fd: FormData): Promise<ActionResult> {
  void _prev;
  void _fd;
  await requireAdmin();
  return finish(await review.vetoDigest(id));
}

/** The kill switch. Stores who flipped it and when. */
export async function setKillSwitch(paused: boolean): Promise<void> {
  const email = await requireAdmin();
  await setCronsPaused(paused === true, email);
  revalidatePath("/admin", "layout");
}
