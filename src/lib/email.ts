import { Resend } from "resend";
import { sql } from "@/lib/db";
import { logError } from "@/lib/errors";
import type { EmailTrigger, EmailType } from "@/lib/types";

export interface SendEmailInput {
  type: EmailType;
  to: string;
  subject: string;
  html: string;
  /** Plain-text version. Required on every email. */
  text: string;
  enrollmentId?: string;
  digestId?: string;
  trigger: EmailTrigger;
  /** What the email was built from, kept for audit. Never put secrets here. */
  inputSnapshot?: unknown;
}

export interface SendEmailResult {
  ok: boolean;
  id?: string;
}

/**
 * Send one email through Resend and ALWAYS write an email_log row (status
 * 'sent' with the Resend id, or 'failed' with the error). Never throws.
 */
export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  let resendId: string | null = null;
  let errorMessage: string | null = null;

  try {
    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.RESEND_FROM;
    if (!apiKey) throw new Error("RESEND_API_KEY is not set");
    if (!from) throw new Error("RESEND_FROM is not set");

    const { data, error } = await new Resend(apiKey).emails.send({
      from,
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text,
    });
    if (error) throw new Error(`${error.name}: ${error.message}`);
    resendId = data?.id ?? null;
  } catch (err) {
    errorMessage = (err as Error).message;
  }

  const status = errorMessage === null ? "sent" : "failed";
  try {
    const snapshot =
      input.inputSnapshot === undefined ? null : JSON.stringify(input.inputSnapshot);
    await sql`
      insert into email_log
        (type, to_email, enrollment_id, digest_id, trigger_source,
         input_snapshot, resend_id, status, error)
      values
        (${input.type}, ${input.to}, ${input.enrollmentId ?? null},
         ${input.digestId ?? null}, ${input.trigger}, ${snapshot}::jsonb,
         ${resendId}, ${status}, ${errorMessage})
    `;
  } catch (err) {
    await logError("email", "could not write email_log row", {
      error: (err as Error).message,
      type: input.type,
      status,
    });
  }

  if (errorMessage !== null) {
    await logError("email", `send failed (${input.type}): ${errorMessage}`);
    return { ok: false };
  }
  return { ok: true, id: resendId ?? undefined };
}
