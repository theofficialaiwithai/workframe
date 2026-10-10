"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { sql } from "@/lib/db";
import { getLesson } from "@/lib/lessons";
import { getLessonAccess } from "@/lib/learn";
import { recordPrediction } from "@/lib/predictions";

/**
 * Mark one lesson complete for the signed-in student. Checks the enrollment
 * again on the server: a server action is a public POST endpoint, so the page
 * having been gated is not enough.
 */
export async function markLessonComplete(courseSlug: string, lessonSlug: string) {
  const access = await getLessonAccess(courseSlug);
  if (!access) throw new Error("Not enrolled in this course");
  if (!getLesson(courseSlug, lessonSlug)) throw new Error("Unknown lesson");

  await sql`
    insert into lesson_progress (student_id, course_id, lesson_slug)
    values (${access.student.id}, ${access.course.id}, ${lessonSlug})
    on conflict do nothing`;

  revalidatePath(`/learn/${courseSlug}/${lessonSlug}`);
  revalidatePath("/dashboard");
}

export type PredictState = { message: string } | null;

/**
 * Save the student's Predict answer, then open the Run section. Checked again
 * on the server: the enrollment, and that this lesson really has a Predict step.
 * The text goes to the database only; it is never sent to a model.
 */
export async function savePrediction(
  courseSlug: string,
  lessonSlug: string,
  _prev: PredictState,
  fd: FormData
): Promise<PredictState> {
  const access = await getLessonAccess(courseSlug);
  if (!access) throw new Error("Not enrolled in this course");
  const lesson = getLesson(courseSlug, lessonSlug);
  if (!lesson || !lesson.predict) throw new Error("This lesson has no Predict step");

  const result = await recordPrediction(
    access.student.id,
    access.course.id,
    lessonSlug,
    String(fd.get("prediction") ?? "")
  );
  if (!result.ok) return { message: result.message };

  revalidatePath(`/learn/${courseSlug}/${lessonSlug}`);
  redirect(`/learn/${courseSlug}/${lessonSlug}`);
}
