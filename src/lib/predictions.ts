import { sql } from "@/lib/db";

// A student's Predict-stage answer (v2 PRD Section 2.2). Stored in
// lesson_responses and read only by a person: it is never sent to Claude.
// No auth in this file: callers must have checked enrollment first.

export const PREDICTION_MAX = 1000;

export type SavePredictionResult =
  | { ok: true; alreadySaved: boolean }
  | { ok: false; message: string };

/** The student's saved prediction for a lesson, or null. */
export async function getPrediction(
  studentId: string,
  courseId: string,
  lessonSlug: string
): Promise<string | null> {
  const rows = await sql`
    select response from lesson_responses
    where student_id = ${studentId}::uuid and course_id = ${courseId}::uuid
      and lesson_slug = ${lessonSlug} and stage = 'predict'`;
  return rows.length > 0 ? (rows[0].response as string) : null;
}

/**
 * Save a prediction. The FIRST one is kept: a prediction that could be edited
 * after seeing the output would stop being a prediction.
 */
export async function recordPrediction(
  studentId: string,
  courseId: string,
  lessonSlug: string,
  text: string
): Promise<SavePredictionResult> {
  const response = text.trim();
  if (response.length === 0) return { ok: false, message: "Write a quick guess first, or choose Skip for now." };
  if (response.length > PREDICTION_MAX) {
    return { ok: false, message: `Please keep your prediction under ${PREDICTION_MAX} characters.` };
  }
  const rows = await sql`
    insert into lesson_responses (student_id, course_id, lesson_slug, stage, response)
    values (${studentId}::uuid, ${courseId}::uuid, ${lessonSlug}, 'predict', ${response})
    on conflict (student_id, course_id, lesson_slug, stage) do nothing
    returning id`;
  return { ok: true, alreadySaved: rows.length === 0 };
}
