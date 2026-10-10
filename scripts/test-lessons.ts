// Tests the lesson validator and the stage splitter. Usage: npm run test:lessons
import { validateLesson } from "../src/lib/lesson-validate";
import { hasAllStagesInOrder, splitSections, STAGES } from "../src/lib/lesson-stages";

let failures = 0;
const check = (name: string, ok: boolean, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  " + detail : ""}`);
  if (!ok) failures++;
};

const everything = (_publicPath: string) => { void _publicPath; return true; };
const HEADINGS = STAGES.map((s) => `## ${s}\n\nText for ${s}.`).join("\n\n");
const FRONT = `title: "A lesson"
order: 1
minutes: 20
stage: worked
colabUrl: "https://colab.research.google.com/"
datasetPath: "/datasets/x/a.csv"
newConcepts: ["read a CSV", "filter rows"]
predict:
  question: "What prints?"
expected:
  description: "A table."
  sampleOutputPath: "/datasets/x/expected.txt"
recall:
  question: "Which line decides?"
  answer: "The filter line."
errors:
  - message: "FileNotFoundError"
    cause: "No file."
    fix: "Upload it."`;
const lesson = (front = FRONT, body = HEADINGS) => `---\n${front}\n---\n\n${body}\n`;
const errorsOf = (raw: string, exists: (publicPath: string) => boolean = everything) => validateLesson(raw, exists).errors;
const mentions = (errs: string[], text: string) => errs.some((e) => e.includes(text));

// ---- a good lesson
check("a complete lesson passes", errorsOf(lesson()).length === 0, JSON.stringify(errorsOf(lesson())));

// ---- every required frontmatter field, removed one at a time
const without = (line: RegExp) => FRONT.replace(line, "");
const cases: [string, RegExp, string][] = [
  ["title", /^title:.*\n/m, "title"],
  ["order", /^order:.*\n/m, "order"],
  ["minutes", /^minutes:.*\n/m, "minutes"],
  ["stage", /^stage:.*\n/m, "stage"],
  ["colabUrl", /^colabUrl:.*\n/m, "colabUrl"],
  ["datasetPath", /^datasetPath:.*\n/m, "datasetPath"],
  ["newConcepts", /^newConcepts:.*\n/m, "newConcepts"],
  ["predict.question", /predict:\n {2}question:.*\n/, "predict.question"],
  ["expected.description", /^ {2}description:.*\n/m, "expected.description"],
  ["expected.sampleOutputPath", /^ {2}sampleOutputPath:.*\n/m, "expected.sampleOutputPath"],
  ["recall.question", /^ {2}question: "Which.*\n/m, "recall.question"],
  ["recall.answer", /^ {2}answer:.*\n/m, "recall.answer"],
  ["errors", /errors:[\s\S]*$/, "errors"],
];
for (const [name, re, expect] of cases) {
  check(`fails when frontmatter is missing ${name}`, mentions(errorsOf(lesson(without(re))), expect));
}

// ---- values
check("fails with 3 newConcepts", mentions(errorsOf(lesson(FRONT.replace('["read a CSV", "filter rows"]', '["a", "b", "c"]'))), "at most 2"));
check("2 newConcepts is allowed", errorsOf(lesson()).length === 0);
check("fails with a stage outside worked|faded|scaffolded", mentions(errorsOf(lesson(FRONT.replace("stage: worked", "stage: expert"))), "Invalid stage"));
for (const s of ["worked", "faded", "scaffolded"]) {
  check(`stage "${s}" is accepted`, errorsOf(lesson(FRONT.replace("stage: worked", `stage: ${s}`))).length === 0);
}
check("fails when colabUrl is not https", mentions(errorsOf(lesson(FRONT.replace("https://colab", "http://colab"))), "colabUrl"));
check("fails when an errors entry lacks a fix", mentions(errorsOf(lesson(FRONT.replace('    fix: "Upload it."', ""))), "fix"));
check("fails when the dataset file does not exist", mentions(errorsOf(lesson(), (p) => !p.endsWith("a.csv")), "datasetPath"));
check("fails when the sample output file does not exist", mentions(errorsOf(lesson(), (p) => !p.endsWith("expected.txt")), "sampleOutputPath"));

// ---- the eight body headings
for (const name of STAGES) {
  const body = HEADINGS.replace(new RegExp(`## ${name}\\n\\nText for ${name}\\.\\n*`), "");
  check(`fails when the body is missing "## ${name}"`, mentions(errorsOf(lesson(FRONT, body)), `Missing body heading: ## ${name}`));
}
const swapped = STAGES.slice();
[swapped[2], swapped[3]] = [swapped[3], swapped[2]];
check("fails when headings are out of order", mentions(errorsOf(lesson(FRONT, swapped.map((s) => `## ${s}\n\nText.`).join("\n\n"))), "out of order"));
check("fails on a duplicated heading", mentions(errorsOf(lesson(FRONT, HEADINGS + "\n\n## Run\n\nAgain.")), "appears 2 times"));
check("fails on an unexpected extra heading", mentions(errorsOf(lesson(FRONT, HEADINGS + "\n\n## Bonus\n\nExtra.")), "Unexpected body heading"));
check("fails when a section is empty", mentions(errorsOf(lesson(FRONT, HEADINGS.replace("Text for Make.", ""))), "Section is empty: ## Make"));
check("a section holding only a comment counts as empty", mentions(errorsOf(lesson(FRONT, HEADINGS.replace("Text for Make.", "{/* PRACTITIONER_TO_CONFIRM */}"))), "Section is empty: ## Make"));

// ---- code fences: a "## " line inside Python is a comment, not a heading
const withFence = HEADINGS.replace("Text for Run.", "Text.\n\n```python\n## not a heading\nprint(1)\n```");
check("a '## ' line inside a code fence is not a heading", errorsOf(lesson(FRONT, withFence)).length === 0, JSON.stringify(errorsOf(lesson(FRONT, withFence))));
const parsed = splitSections(withFence);
check("splitSections finds exactly the eight headings, in order", hasAllStagesInOrder(parsed.sections));
check("the code fence stays inside its section", parsed.sections[2].body.includes("## not a heading"));

// ---- markers and advice
check("counts open PRACTITIONER_TO_CONFIRM markers", validateLesson(lesson(FRONT, HEADINGS + "\n\n{/* PRACTITIONER_TO_CONFIRM: a */}\n{/* PRACTITIONER_TO_CONFIRM: b */}"), everything).markers === 2);
check("warns (does not fail) when lesson 1 is not 'worked'", validateLesson(lesson(FRONT.replace("stage: worked", "stage: faded")), everything).warnings.length === 1 && errorsOf(lesson(FRONT.replace("stage: worked", "stage: faded"))).length === 0);
check("unreadable frontmatter is reported, not thrown", validateLesson("---\ntitle: [oops\n---\nbody", everything).errors.length > 0);

if (failures > 0) {
  console.error(`\n${failures} check(s) failed`);
  process.exit(1);
}
console.log("\nAll lesson validator checks passed");
