// Tests the digest markdown that goes into emails. Usage: npm run test:markdown
import { markdownToEmailHtml, markdownToPlainText, parseBlocks } from "../src/lib/markdown-lite";
import { digestAdminEmail, digestInsiderEmail } from "../src/lib/email-templates";

let failures = 0;
const check = (name: string, ok: boolean, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  " + detail : ""}`);
  if (!ok) failures++;
};

// The exact shape of a real digest: headings with the next line directly below, no blank line.
const real = `# Weekly Summary: Real Estate Automation
**Week of 2026-10-12** (draft for instructor review)

## Key numbers
- **Total enrollments:** 1 (all new this week)
- **Check-ins sent:** 1
- **Hours saved:** 2.67 (student-reported, AI-estimated)

## Common obstacles
No obstacle themes were included in this week's data.

## Notes for interpretation
1. First point
2. Second point`;

const html = markdownToEmailHtml(real);
const text = markdownToPlainText(real);

check("headings are real headings, no '##' left in the HTML", !html.includes("##") && !html.includes("# Weekly"));
check("a heading directly followed by text is still a heading", parseBlocks(real).filter((b) => b.type === "h").length === 4);
check("a heading directly followed by a list: both are recognised", parseBlocks(real).some((b) => b.type === "ul" && b.items.length === 3));
check("bullets become a list", html.includes("<ul") && (html.match(/<li/g) ?? []).length === 5);
check("numbered items become an ordered list", html.includes("<ol"));
check("bold text is bold, no '**' left", html.includes("<strong>Total enrollments:</strong>") && !html.includes("**"));
check("the first heading is the biggest", html.indexOf("font-size:22px") !== -1);
check("plain-text version has no '#' or '**'", !/(^|\n)#/.test(text) && !text.includes("**"), JSON.stringify(text.split("\n")[0]));
check("plain-text version keeps bullets", text.includes("- Total enrollments: 1"));

// Safety: model text must never inject markup
const hostile = markdownToEmailHtml('## Hi <script>alert(1)</script>\n- <img src=x onerror=alert(1)> **<b>bold</b>**\n[click](javascript:alert(1))');
check("script tags are escaped", !hostile.includes("<script>") && hostile.includes("&lt;script&gt;"));
check("img tags are escaped", !hostile.includes("<img"));
check("links are not turned into anchors", !hostile.includes("<a "));

// The whole templates
const insider = digestInsiderEmail({ insiderName: "Sam", courseTitle: "Legal", bodyMd: real });
check("insider email: HTML has headings and no '##'", !insider.html.includes("##") && insider.html.includes("Key numbers"));
check("insider email: text has no '##'", !insider.text.includes("##"));
const admin = digestAdminEmail({ summaryLines: [`Legal, week of 2026-10-12:\n\n${real}`], adminUrl: "https://x.test/admin/digests" });
check("admin email: HTML has no '##' or '**'", !admin.html.includes("##") && !admin.html.includes("**"));
check("admin email: link to the digest queue kept", admin.html.includes("https://x.test/admin/digests") && admin.text.includes("https://x.test/admin/digests"));

if (failures > 0) {
  console.error(`\n${failures} check(s) failed`);
  process.exit(1);
}
console.log("\nAll markdown checks passed");
