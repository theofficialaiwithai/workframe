"use server";

import { revalidatePath } from "next/cache";
import { sql } from "@/lib/db";
import { getLesson } from "@/lib/lessons";
import { getLessonAccess } from "@/lib/learn";

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
