import { markdownToEmailHtml, markdownToPlainText } from "@/lib/markdown-lite";

// Fixed email templates (PRD 5.2, 5.4, 5.6). Student-facing emails are fixed
// text with values slotted in: no model-written text ever reaches a student.
// Inline styles only; web fonts are not reliable in email clients.

export interface EmailContent {
  subject: string;
  html: string;
  text: string;
}

const BG = "#F8F5F0";
const PRIMARY = "#FF6B35";
const INK = "#141412";
const MUTED = "#6B6B66";
const BORDER = "#E4DFD6";
const FONT = "-apple-system, 'Segoe UI', Helvetica, Arial, sans-serif";

function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function greeting(name: string | null | undefined): string {
  const n = name?.trim();
  return n ? `Hi ${n},` : "Hi there,";
}

function p(text: string): string {
  return `<p style="margin:0 0 20px;font-size:16px;line-height:1.5;color:${INK};">${esc(text)}</p>`;
}

function button(label: string, href: string): string {
  return `<p style="margin:30px 0;"><a href="${esc(href)}" style="display:inline-block;background:${PRIMARY};color:${INK};font-weight:700;font-size:16px;text-decoration:none;padding:12px 24px;border-radius:8px;">${esc(label)}</a></p>`;
}

function layout(innerHtml: string): string {
  return `<!doctype html>
<html><body style="margin:0;padding:0;background:${BG};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BG};padding:30px 10px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#FFFFFF;border:1px solid ${BORDER};border-radius:8px;font-family:${FONT};">
<tr><td style="padding:30px;">
<p style="margin:0 0 30px;font-size:20px;font-weight:700;color:${INK};">Workframe</p>
${innerHtml}
<p style="margin:30px 0 0;font-size:13px;line-height:1.5;color:${MUTED};">Workframe: Python courses that start with your job.</p>
</td></tr></table>
</td></tr></table>
</body></html>`;
}

export function welcomeEmail(args: {
  name: string | null;
  courseTitle: string;
  firstTask: string;
  signInUrl: string;
}): EmailContent {
  const { name, courseTitle, firstTask, signInUrl } = args;
  const subject = `You're in: ${courseTitle}`;
  const html = layout(
    p(greeting(name)) +
      p(`You're enrolled in ${courseTitle}. Here is your first task for week one:`) +
      `<div style="margin:0 0 20px;padding:20px;background:#F0EDE8;border-radius:8px;font-size:16px;line-height:1.5;color:${INK};white-space:pre-line;">${esc(firstTask)}</div>` +
      p("Sign in to open it.") +
      button("Open your first task", signInUrl)
  );
  const text = `${greeting(name)}

You're enrolled in ${courseTitle}. Here is your first task for week one:

${firstTask}

Sign in to open it: ${signInUrl}

Workframe: Python courses that start with your job.`;
  return { subject, html, text };
}

export function checkinEmail(args: {
  name: string | null;
  checkpoint: 3 | 7;
  url: string;
}): EmailContent {
  const { name, checkpoint, url } = args;
  const subject = `Day ${checkpoint} check-in: what did you automate?`;
  const html = layout(
    p(greeting(name)) +
      p(`It's day ${checkpoint}. Tell us what you automated, how long it took before and how long it takes now. Rough numbers are fine. It takes about two minutes.`) +
      button("Answer the check-in", url) +
      p("No sign-in needed. The link is just for you.")
  );
  const text = `${greeting(name)}

It's day ${checkpoint}. Tell us what you automated, how long it took before and how long it takes now. Rough numbers are fine. It takes about two minutes.

Answer the check-in: ${url}

No sign-in needed. The link is just for you.`;
  return { subject, html, text };
}

export function digestAdminEmail(args: {
  summaryLines: string[];
  adminUrl: string;
}): EmailContent {
  const { summaryLines, adminUrl } = args;
  const subject = "Workframe digest drafts ready: veto before Monday 8am";
  const html = layout(
    p("Digest drafts are ready. They send to insiders on Monday morning unless you veto them.") +
      summaryLines.map((l) => `<div style="margin:0 0 20px;padding-bottom:10px;border-bottom:1px solid ${BORDER};">${markdownToEmailHtml(l)}</div>`).join("") +
      button("Review and veto", adminUrl)
  );
  const text = `Digest drafts are ready. They send to insiders on Monday morning unless you veto them.

${summaryLines.map(markdownToPlainText).join("\n\n----------\n\n")}

Review and veto: ${adminUrl}`;
  return { subject, html, text };
}

export function digestInsiderEmail(args: {
  insiderName: string;
  courseTitle: string;
  bodyMd: string;
}): EmailContent {
  const { insiderName, courseTitle, bodyMd } = args;
  const subject = `Weekly summary: ${courseTitle}`;
  const html = layout(
    p(greeting(insiderName)) +
      p("Here is a draft summary of this week's cohort. It is a summary of student-reported data, not a finding.") +
      markdownToEmailHtml(bodyMd)
  );
  const text = `${greeting(insiderName)}

Here is a draft summary of this week's cohort. It is a summary of student-reported data, not a finding.

${markdownToPlainText(bodyMd)}`;
  return { subject, html, text };
}
