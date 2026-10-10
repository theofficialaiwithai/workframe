// Tests the digest's identifying-text guard and its pure helpers. No API call
// and no email. Usage: npm run test:digest
import { comingMonday, containsIdentifyingText, scrub } from "../src/lib/digest";

let failures = 0;
const check = (name: string, ok: boolean, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  " + detail : ""}`);
  if (!ok) failures++;
};

// The students of one course.
const students = ["Jordan Rivera", "priya.shah@example.com", "Sam O'Neil", null];

// --- the guard (PRD 5.6)
check("a name is caught", containsIdentifyingText("Jordan Rivera said the setup was slow.", students));
check("an email is caught", containsIdentifyingText("Contact priya.shah@example.com about it.", students));
check("a mixed-case name is caught", containsIdentifyingText("JoRdAn rIvErA struggled with Colab.", students));
check("a mixed-case email is caught", containsIdentifyingText("PRIYA.SHAH@EXAMPLE.COM wrote in.", students));
check("a name with an apostrophe is caught", containsIdentifyingText("sam o'neil asked for help.", students));
check("a name inside a longer sentence is caught", containsIdentifyingText("Thanks to jordan rivera's team.", students));
check(
  "clean text passes",
  !containsIdentifyingText(
    "Eleven students enrolled this week. Hours saved are student-reported, AI-estimated. Common obstacles: setting up Colab and finding time.",
    students
  )
);
check("empty text passes", !containsIdentifyingText("", students));
check("null and blank identifiers are ignored", !containsIdentifyingText("Any text at all", [null, undefined, "", "  "]));
check("very short names are ignored (they would match inside ordinary words)", !containsIdentifyingText("Setting up Colab was hard.", ["Al"]));

// --- scrub: free-text notes are cleaned before Claude sees them
const noted = scrub("Jordan Rivera could not install it; email me at someone@corp.io", students);
check("scrub removes a known name", !noted.toLowerCase().includes("jordan"));
check("scrub removes any email address", !noted.includes("someone@corp.io") && noted.includes("[email removed]"));
check("scrub keeps the rest of the note", noted.includes("could not install it"));
check("scrub caps a note at 500 characters", scrub("x".repeat(900), students).length === 500);

// --- comingMonday (Chicago calendar, PRD 11.5)
const at = (iso: string) => comingMonday(new Date(iso));
check("Sunday 6pm Central -> the next day (Mon Oct 12 2026)", at("2026-10-11T23:00:00Z") === "2026-10-12", at("2026-10-11T23:00:00Z"));
check("Monday -> the Monday a week later", at("2026-10-12T15:00:00Z") === "2026-10-19");
check("Wednesday -> the following Monday", at("2026-10-14T15:00:00Z") === "2026-10-19");
check("Saturday -> two days later", at("2026-10-17T15:00:00Z") === "2026-10-19");
check("late Sunday night in Chicago is still Sunday (06:30 UTC Monday)", at("2026-10-12T04:30:00Z") === "2026-10-12", at("2026-10-12T04:30:00Z"));
check("works across a daylight-saving change (Sun Nov 1 2026)", at("2026-11-01T18:00:00Z") === "2026-11-02");
check("works across the new year", at("2026-12-31T15:00:00Z") === "2027-01-04");

if (failures > 0) {
  console.error(`\n${failures} check(s) failed`);
  process.exit(1);
}
console.log("\nAll digest guard checks passed");
