// Tests saving a Predict-stage answer against the real database, with
// throwaway fixtures. Usage: npm run test:predictions
import { randomUUID } from "node:crypto";
import { sql } from "../src/lib/db";
import { getPrediction, PREDICTION_MAX, recordPrediction } from "../src/lib/predictions";

let failures = 0;
const check = (name: string, ok: boolean, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  " + detail : ""}`);
  if (!ok) failures++;
};
const count = async (studentId: string) =>
  (await sql`select count(*)::int n from lesson_responses where student_id = ${studentId}::uuid`)[0].n as number;

async function cleanup() {
  const ids = (await sql`select id from students where email like 'prediction-test-%@example.com'`).map((r) => r.id as string);
  if (ids.length === 0) return;
  await sql`delete from lesson_responses where student_id = any(${ids}::uuid[])`;
  await sql`delete from students where id = any(${ids}::uuid[])`;
}

(async () => {
  await cleanup();
  const courseId = (await sql`select id from courses where slug = 'real-estate-automation'`)[0].id as string;
  const mk = async (n: number) =>
    (await sql`insert into students (email) values (${`prediction-test-${n}-${randomUUID().slice(0, 6)}@example.com`}) returning id`)[0].id as string;
  const a = await mk(1);
  const b = await mk(2);
  const L = "01-week-one-first-task";

  try {
    check("nothing is saved to start with", (await getPrediction(a, courseId, L)) === null);

    // validation
    const empty = await recordPrediction(a, courseId, L, "");
    check("an empty prediction is refused", !empty.ok);
    check("a blank prediction (spaces only) is refused", !(await recordPrediction(a, courseId, L, "   \n  ")).ok);
    check(`a prediction over ${PREDICTION_MAX} characters is refused`, !(await recordPrediction(a, courseId, L, "x".repeat(PREDICTION_MAX + 1))).ok);
    check("a refused prediction saves nothing", (await count(a)) === 0);
    check(`exactly ${PREDICTION_MAX} characters is allowed`, (await recordPrediction(a, courseId, "02-clean-your-mls-export", "x".repeat(PREDICTION_MAX))).ok);

    // saving
    const first = await recordPrediction(a, courseId, L, "  A table of 3 leads, longest quiet first.  ");
    check("a prediction saves", first.ok && !first.alreadySaved);
    check("it is stored trimmed and can be read back", (await getPrediction(a, courseId, L)) === "A table of 3 leads, longest quiet first.");
    const row = (await sql`select stage from lesson_responses where student_id = ${a}::uuid and lesson_slug = ${L}`)[0];
    check("it is stored with stage 'predict'", row.stage === "predict");

    // the first one is kept
    const second = await recordPrediction(a, courseId, L, "Actually, 5 leads.");
    check("saving again does not overwrite", second.ok && second.alreadySaved);
    check("the original prediction is still there", (await getPrediction(a, courseId, L)) === "A table of 3 leads, longest quiet first.");
    check("still one row for that lesson", (await sql`select count(*)::int n from lesson_responses where student_id = ${a}::uuid and lesson_slug = ${L}`)[0].n === 1);

    // scoping
    check("another lesson has its own prediction", (await getPrediction(a, courseId, "03-other")) === null);
    check("another student cannot see it", (await getPrediction(b, courseId, L)) === null);
    check("another student can save their own", (await recordPrediction(b, courseId, L, "Two leads.")).ok && (await getPrediction(b, courseId, L)) === "Two leads.");
    check("the first student's is unchanged", (await getPrediction(a, courseId, L)) === "A table of 3 leads, longest quiet first.");

    // text is stored as plain text (no interpretation)
    const odd = `'; drop table students; -- <script>alert(1)</script>`;
    await recordPrediction(b, courseId, "02-clean-your-mls-export", odd);
    check("odd characters are stored as plain text and read back unchanged", (await getPrediction(b, courseId, "02-clean-your-mls-export")) === odd);
    check("the students table is still there", (await sql`select count(*)::int n from students`)[0].n >= 2);
  } finally {
    await cleanup();
    const left = (await sql`select count(*)::int n from students where email like 'prediction-test-%@example.com'`)[0].n;
    console.log(`fixtures removed (${left} left)`);
  }
  if (failures > 0) {
    console.error(`\n${failures} check(s) failed`);
    process.exit(1);
  }
  console.log("\nAll prediction checks passed");
})();
