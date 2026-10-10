import "server-only";
import { sql } from "@/lib/db";
import { getCourse, type CourseWithInsider } from "@/lib/courses";
import { getOrLinkStudent } from "@/lib/students";
import type { Student } from "@/lib/types";

/**
 * The single gate for lesson content (PRD 5.3). Returns the student and course
 * only if the signed-in user has an ACTIVE enrollment in that course; null in
 * every other case (signed out, no purchase, refunded, unknown course). Both the
 * lesson page and the mark-complete action call this, never the client.
 */
export async function getLessonAccess(
  courseSlug: string
): Promise<{ student: Student; course: CourseWithInsider } | null> {
  const student = await getOrLinkStudent();
  if (!student) return null;
  const course = await getCourse(courseSlug);
  if (!course) return null;
  const rows = await sql`
    select 1 from enrollments
    where student_id = ${student.id} and course_id = ${course.id} and status = 'active'`;
  return rows.length > 0 ? { student, course } : null;
}

/** Lesson slugs this student has completed in one course. */
export async function completedLessonSlugs(
  studentId: string,
  courseId: string
): Promise<Set<string>> {
  const rows = await sql`
    select lesson_slug from lesson_progress
    where student_id = ${studentId} and course_id = ${courseId}`;
  return new Set(rows.map((r) => r.lesson_slug as string));
}
