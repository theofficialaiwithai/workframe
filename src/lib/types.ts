// Row types for every table in db/migrations/001_init.sql (PRD Section 9).
// Column names match the database exactly. Postgres `numeric` columns come
// back from the driver as strings; timestamps and dates as Date objects.

export type Profession = "real-estate" | "legal" | "fitness";

export interface Insider {
  id: string;
  slug: string;
  name: string;
  email: string;
  profession: Profession | string;
  bio: string | null;
  created_at: Date;
}

export type CourseStatus = "draft" | "live";

export interface Course {
  id: string;
  slug: string;
  insider_id: string;
  title: string;
  summary: string | null;
  price_cents: number;
  stripe_price_id: string | null;
  status: CourseStatus;
  created_at: Date;
}

export interface Student {
  id: string;
  email: string;
  name: string | null;
  clerk_user_id: string | null;
  created_at: Date;
}

export type EnrollmentStatus = "active" | "refunded";

export interface Enrollment {
  id: string;
  student_id: string;
  course_id: string;
  insider_id: string;
  stripe_session_id: string;
  stripe_payment_intent: string | null;
  amount_cents: number;
  status: EnrollmentStatus;
  purchased_at: Date;
}

export interface LessonProgress {
  student_id: string;
  course_id: string;
  lesson_slug: string;
  completed_at: Date;
}

export interface StripeEvent {
  event_id: string;
  type: string;
  processed_at: Date;
}

export type CheckpointDay = 3 | 7;

export interface Checkin {
  id: string;
  enrollment_id: string;
  checkpoint: CheckpointDay;
  token: string;
  sent_at: Date | null;
  submitted_at: Date | null;
  raw_answer: string | null;
  blockers: string | null;
  /** v2: "How confident are you that you could automate a similar task on your own?" 1-5. Null for check-ins submitted before v2. */
  confidence: number | null;
  /** v2, day 7 only, optional. Read by a person; never sent to Claude. */
  transfer_answer: string | null;
  transfer_attempted: boolean;
  created_at: Date;
}

export type ExtractionStatus =
  | "auto_accepted"
  | "pending_review"
  | "approved"
  | "corrected"
  | "rejected"
  | "failed";

export type SampleResult = "confirmed" | "corrected";

export interface Extraction {
  id: string;
  checkin_id: string;
  task: string | null;
  minutes_before: number | null;
  minutes_after: number | null;
  runs_in_week: number | null;
  hours_saved: string | null; // numeric(8,2)
  confidence: string | null; // numeric(3,2)
  evidence_phrases: string[] | null;
  status: ExtractionStatus;
  hold_reason: string | null;
  sampled_at: Date | null;
  sample_result: SampleResult | null;
  reviewed_at: Date | null;
  review_note: string | null;
  model: string;
  prompt_version: string;
  raw_response: unknown | null; // jsonb
  created_at: Date;
}

export type DigestStatus = "drafted" | "vetoed" | "sent" | "failed";

export interface Digest {
  id: string;
  course_id: string;
  week_start: Date; // date
  body_md: string | null;
  stats: unknown; // jsonb, the exact numbers given to Claude
  status: DigestStatus;
  failure_reason: string | null;
  model: string | null;
  prompt_version: string | null;
  drafted_at: Date;
  vetoed_at: Date | null;
  sent_at: Date | null;
}

export type EmailType =
  | "welcome"
  | "checkin"
  | "digest_admin"
  | "digest_insider";

export type EmailTrigger =
  | "stripe_webhook"
  | "cron_checkins"
  | "cron_digest_draft"
  | "cron_digest_release";

export interface EmailLog {
  id: string;
  type: EmailType | string;
  to_email: string;
  enrollment_id: string | null;
  digest_id: string | null;
  trigger_source: EmailTrigger | string;
  input_snapshot: unknown | null; // jsonb
  resend_id: string | null;
  status: "sent" | "failed";
  error: string | null;
  created_at: Date;
}

export interface SystemFlag {
  key: string; // 'crons_paused'
  value: boolean;
  updated_at: Date;
  updated_by: string | null;
}

export interface ErrorLog {
  id: string;
  source: string;
  message: string;
  detail: unknown | null; // jsonb
  created_at: Date;
}

export interface SchemaMigration {
  name: string;
  ran_at: Date;
}

// ---- v2: learning design and the domain harness (migration 002) ----

/** What a student saved in a lesson stage. Only 'predict' exists in v2. */
export interface LessonResponse {
  id: string;
  student_id: string;
  course_id: string;
  lesson_slug: string;
  stage: "predict";
  response: string;
  created_at: Date;
}

/** The day-5 recall prompt. The answer is read by a person; never sent to Claude. */
export interface RecallPrompt {
  id: string;
  enrollment_id: string;
  lesson_slug: string;
  token: string;
  sent_at: Date | null;
  opened_at: Date | null;
  response: string | null;
  revealed_at: Date | null;
  created_at: Date;
}

/** One released version of a profession's starter kit. */
export interface HarnessKit {
  id: string;
  course_id: string;
  version: string;
  file_name: string;
  changelog: string | null;
  /** PRACTITIONER_TO_CONFIRM / PLACEHOLDER markers still in the kit. */
  open_markers: number;
  signed_off_by: string | null;
  signed_off_at: Date | null;
  released_at: Date | null;
  created_at: Date;
}

export interface KitDownload {
  id: string;
  student_id: string;
  kit_id: string;
  downloaded_at: Date;
}
