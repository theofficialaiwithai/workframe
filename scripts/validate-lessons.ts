// Checks every lesson against the v2 template. Usage:
//   npm run lessons:validate                 (checks ./content)
//   npm run lessons:validate -- --dir <path> (checks another content folder)
//
// Lessons still in the v1 format are listed in <dir>/legacy-lessons.json and are
// skipped, so every OTHER lesson is held to the full template. The list is
// meant to shrink to empty as lessons are converted (v2 Step 20).
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { validateLesson } from "../src/lib/lesson-validate";

const argDir = process.argv.indexOf("--dir");
const dir = argDir > -1 ? process.argv[argDir + 1] : "content";
const publicDir = join(process.cwd(), "public");
const fileExists = (p: string) => existsSync(join(publicDir, p));

const legacyFile = join(dir, "legacy-lessons.json");
const legacy: string[] = existsSync(legacyFile) ? JSON.parse(readFileSync(legacyFile, "utf8")) : [];

let failed = 0;
let checked = 0;
let skipped = 0;
let markers = 0;
const seenLegacy: string[] = [];

for (const course of readdirSync(dir).sort()) {
  const courseDir = join(dir, course);
  if (!existsSync(join(courseDir)) || !readdirSync(dir, { withFileTypes: true }).some((e) => e.name === course && e.isDirectory())) continue;
  for (const file of readdirSync(courseDir).filter((f) => f.endsWith(".mdx")).sort()) {
    const id = `${course}/${file}`;
    const result = validateLesson(readFileSync(join(courseDir, file), "utf8"), fileExists);

    if (legacy.includes(id)) {
      seenLegacy.push(id);
      skipped++;
      if (result.errors.length === 0) {
        failed++;
        console.log(`FAIL  ${id}\n        - it passes the v2 template now: remove it from legacy-lessons.json`);
      } else {
        console.log(`skip  ${id}  (v1 format, listed in legacy-lessons.json)`);
      }
      continue;
    }

    checked++;
    markers += result.markers;
    if (result.errors.length > 0) {
      failed++;
      console.log(`FAIL  ${id}`);
      for (const e of result.errors) console.log(`        - ${e}`);
    } else {
      const note = result.markers > 0 ? `  [${result.markers} PRACTITIONER_TO_CONFIRM marker(s) open]` : "";
      console.log(`PASS  ${id}${note}`);
    }
    for (const w of result.warnings) console.log(`        note: ${w}`);
  }
}

for (const id of legacy) {
  if (!seenLegacy.includes(id)) {
    failed++;
    console.log(`FAIL  legacy-lessons.json lists ${id}, which does not exist: remove the entry`);
  }
}

console.log(`\n${checked} checked, ${skipped} skipped as v1 format, ${markers} practitioner marker(s) open`);
if (failed > 0) {
  console.error(`${failed} problem(s) found`);
  process.exit(1);
}
console.log("All lessons valid");
