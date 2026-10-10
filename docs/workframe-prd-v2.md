# Workframe — Product Requirements Document, v2

*Version 2.0 · 2026-10-09 · Built with Claude Code · Owner: Adamma Ihemeson*
*Builds on `workframe-prd.md` (v1). Read v1 first. This document only describes what changes.*

**How v2 relates to v1**
- v1 (Steps 1–12) is the shipped beta: checkout, lessons, check-ins, hours-saved extraction, admin console, insider digests, and the governance controls.
- v2 is additive. Nothing in v1 is removed, and every v1 governance requirement still holds.
- Start v2 only after v1 Step 12 passes its end-to-end test. v2 steps are numbered 13–20 so they continue v1's numbering.
- v2 does two things:
  1. Rebuilds how lessons teach, using learning-science methods (Section 2).
  2. Adds a domain harness per profession: the rules, checks, memory and approval step that make a general model and a student's scripts behave correctly in that industry (Section 3).

**Assumptions to confirm (I filled these in; change any that are wrong):**
- The harness ships to students as a downloadable starter kit (Python package + notebooks + rules + checks). It runs on the student's machine or in Colab. Nothing in the kit sends data to Workframe.
- The kit has no AI calls of its own. Students may use their own AI assistant to adapt notebooks, and the kit tells them how to do that safely.
- Each insider reviews and signs off the rules for their profession. Until they do, every rule is marked `PRACTITIONER_TO_CONFIRM`.
- No new cron job is added. The recall prompt runs inside the existing daily check-in route, so v1's three cron entries stay at three. If your Vercel plan limits cron jobs, check that v1's three already fit.
- Transfer tasks and recall answers are reviewed by a person, not scored by AI.

---

## Section 1: What v2 Adds, and Where Workframe Sits

**Fit check (against three AI business models):**
- *AI-native service firm* (agents deliver the work, you sell the finished job): not Workframe. Students do the delivery.
- *Domain-specific harness* (model + industry tools + workflow rules + memory + checks + human approval): **closest fit, and the direction v2 takes.**
- *Vertical agent* (an agent owns one recurring job): a later stage. The five tasks per profession are the candidate jobs.
- *As written in v1:* a training business with an AI operations layer. Verdict: not yet any of the three.

**Why v2 exists:** "Learn Python" is the part AI makes cheap. What lasts is (a) the practitioner's choice of tasks and rules, (b) industry datasets and checks, (c) measured outcomes, and (d) teaching people to specify, verify and modify automations instead of memorizing syntax. v2 builds (a), (b) and (d) into the product and extends (c).

**Positioning line (proposed):** "The automation toolkit for [profession], built and checked by someone who does your job, plus the training to make it yours."

---

## Section 2: Learning Design Spec

### 2.1 Principles, and what each changes in the product

| Method | Requirement in v2 |
|---|---|
| Worked examples, then fading | Each course's lessons move from a full worked example (lesson 1) to a partly blanked one (lesson 2) to a scaffolded blank (lesson 3 onward). Set by `stage` in lesson frontmatter. |
| Predict, Run, Investigate, Modify, Make (a programming teaching sequence) | Every lesson follows these stages in order, then Check. The student saves a prediction before running. |
| Retrieval practice and spacing | Each lesson defines a recall question. A day-5 email asks it; the answer is revealed on a page after the student tries. A "run it again next Monday" prompt closes week one. |
| Feedback | Every task has an expected-output self-check, a "when it breaks" list built from the practitioner's failure modes, and golden test cases in the kit (Section 3). |
| Varied practice | Each task pattern is applied to a second dataset in the Modify stage. |
| Low cognitive load | Each lesson introduces at most two new Python ideas, and only ones the five tasks need. A concept map per course lists them. |
| Separating learning from copy-running | A 1–5 confidence rating at day 3 and day 7, and an optional transfer task at day 7. |
| Verifying AI-written code | Every lesson ends with Check: compare against known output, then run the golden cases. The student is taught to specify, run, verify and modify. |

Evidence note: the general findings (retrieval practice, spacing, worked examples, feedback) are well established in education research. Evidence for programming-specific sequences like Predict-Run-Investigate-Modify-Make is promising but smaller. Treat the sequence as a well-founded design, not a proven result, and use the new metrics (Section 6) to learn whether it works for these learners.

### 2.2 Lesson file template (replaces the v1 placeholder lessons)

Each lesson is `content/<course-slug>/NN-<slug>.mdx`. Frontmatter:

```yaml
---
title: "Build your weekly follow-up list"
order: 1
minutes: 20
stage: worked            # worked | faded | scaffolded
colabUrl: "https://colab.research.google.com/..."
datasetPath: "/datasets/real-estate-automation/leads.csv"
newConcepts: ["read a CSV", "filter rows"]     # at most 2
predict:
  question: "What will the last line print for the sample file?"
expected:
  description: "A table of 3 leads, each at least 7 days since last contact."
  sampleOutputPath: "/datasets/real-estate-automation/expected-01.txt"
recall:
  question: "Without looking: which line decides who is on the follow-up list?"
  answer: "The line that filters rows where days_since_contact is greater than 7."
errors:
  - message: "FileNotFoundError: sample.csv"
    cause: "The notebook can't see the file."
    fix: "Upload sample.csv in Colab's file panel, then rerun the first cell."
---
```

Body headings, in this order: `## Goal`, `## Predict`, `## Run`, `## Investigate`, `## Modify`, `## Make`, `## Check`, `## When it breaks`.
- **Goal:** one sentence tied to the student's real week.
- **Predict:** the question from frontmatter plus a text box. The student saves a prediction before the Run section opens. A "skip for now" link keeps this from becoming a wall.
- **Run:** open the notebook, run it, compare with the prediction.
- **Investigate:** change one thing and see what happens (one guided question).
- **Modify:** make it work on the student's own data or the second dataset.
- **Make:** the faded or scaffolded part. Lesson 1 has none; later lessons have blanks, then an empty cell with a goal.
- **Check:** a checklist: output matches the expected description, then golden cases pass (Section 3.6).
- **When it breaks:** the `errors` entries as an accordion.

### 2.3 Check-in and recall changes

- **Day 3 and day 7 form:** add a required 1–5 scale: "How confident are you that you could automate a similar task on your own?"
- **Day 7 form only:** add an optional transfer task: "Pick one small task from your week that this course didn't cover. In a few sentences: what goes in, what should come out, and how would you check the result?"
- **Day-5 recall email:** a fixed template with the lesson's recall question and a link to `/recall/[token]`. The page has a text box ("Try to answer from memory"), then a "Show the answer" button that reveals the answer from frontmatter. The answer is stored. No AI is involved anywhere in this flow.
- **"Run it again next Monday":** a closing line on the day-7 thank-you page and in the day-7 email.
- **Digest stats (small change):** add median confidence change (day 3 to day 7) and transfer-task attempt rate. They are numbers only, with no student text.

### 2.4 Governance impact of the learning changes
- Recall emails, confidence ratings and transfer prompts are fixed templates. No model writes anything students see.
- The kill switch pauses recall sends because they run inside the check-in route.
- Transfer answers and recall answers are stored and reviewed by a person. They are never sent to Claude in v2.
- Add the new emails to the send log (types `recall`, trigger `cron_checkins`).

---

## Section 3: Domain Harness Spec

### 3.1 What it is, and what it isn't
A harness turns a general model, or a student's script, into something that behaves correctly in one profession. Its parts are: model, industry tools and data, workflow rules, memory, checks, and human approval. In Workframe the harness ships as a **starter kit per profession**: a small Python package, notebooks for the five tasks, a rules file written by the practitioner, deterministic checks, golden test cases, a memory file, and an approval step.

What it is not (v2):
- Not a hosted agent. Nothing runs on Workframe's servers for students.
- Not a data collector. The kit sends nothing to Workframe. Hours saved still arrives only through the check-in.
- Not an AI that edits its own rules. Rules change only when a person (you and the insider) changes them.

### 3.2 The six components: have, gap, build item

| Component | Have (v1) | Gap | v2 build item |
|---|---|---|---|
| Model | Claude extracts hours saved and drafts digests | Nothing helps a student's own AI assistant behave correctly in their industry | `PROMPT_adapt.md` in each kit: rules and checks the student pastes into their own assistant |
| Industry tools and data | Static sample CSVs | No profession-specific data shapes or connectors | Per-task sample datasets with realistic columns; connector notes (what to export from the student's own tools); licensing items listed in 3.11 |
| Workflow rules | Insider's tasks live in lesson prose | Not reusable or checkable | `rules.md` (plain language) and `rules.yaml` (checkable subset) per profession, plus `task.md` per task |
| Memory | None | Nothing remembers a student's setup or corrections | `profile.json` (preferences and corrections) read and written by the kit library |
| Checks | None on student automations | Students can't tell whether output is right | `checks` library, `checks.yaml` per task, and golden cases with a runner |
| Human approval | Governance on Workframe's own AI | Not built into what students build | `approve()` gate: dry-run by default, nothing is exported or sent until a person confirms |

### 3.3 Repository layout (added to the Workframe repo)

```
harness/
  README.md
  shared/
    pyproject.toml
    workframe_harness/
      __init__.py
      checks.py        # deterministic checks (3.5)
      approval.py      # approval gate (3.7)
      memory.py        # profile.json helpers (3.6)
      runlog.py        # local run log (no row contents)
      rules.py         # loads rules.yaml, exposes hard rules
      golden.py        # golden-case runner (3.8)
    tests/
  real-estate/
    rules.md
    rules.yaml
    PROMPT_adapt.md
    profile.example.json
    tasks/
      01-<task-slug>/
        task.md
        starter.ipynb
        checks.yaml
        data/
        golden/
          cases/
          G-RE-1.json
  legal/        (same shape)
  fitness/      (same shape)
kits/            # build output (git-ignored): <profession>-v<version>.zip
```

### 3.4 File formats

**`task.md`** (the practitioner's task spec; one per task):
1. Name and the weekly time it takes today (the practitioner's estimate).
2. Inputs: columns, sources, where the student exports them from.
3. Steps: what the practitioner actually does, in order.
4. Output: what it looks like and who sees it.
5. Hard rules: things that must never happen.
6. Soft rules: things that are usually true; flag, don't block.
7. Failure modes: what goes wrong, and what a junior always gets wrong.
8. Approval: what a human must confirm before output is used or sent.
9. Compliance notes: items to verify (3.11). Never stated as settled.
10. Golden case ids.

**`rules.yaml`** (the checkable subset; example shape only, values come from the practitioner):

```yaml
profession: real-estate
version: 0.1.0
status: PRACTITIONER_TO_CONFIRM
hard_rules:
  - id: HR-1
    text: "A lead marked do-not-contact is never in any outreach list."
    check: forbid_rows
    params: { column: status, equals: do_not_contact }
soft_rules:
  - id: SR-1
    text: "Leads not contacted for more than N days belong on the follow-up list."
    check: flag_rows
    params: { column: days_since_contact, greater_than: "{{ follow_up_days }}" }
parameters:
  follow_up_days: 7          # PRACTITIONER_TO_CONFIRM
```

**`checks.yaml`** (per task): ordered list of checks from the library with their parameters and a `severity` of `block` (stop and show the problem) or `warn` (show, continue).

**`profile.json`** (student's memory, stored in the student's own folder or Drive):

```json
{
  "preferences": { "follow_up_days": 7 },
  "corrections": [
    { "date": "2026-10-12", "task": "01-lead-follow-up", "note": "Exclude leads tagged 'past client'." }
  ],
  "last_run": { "task": "01-lead-follow-up", "date": "2026-10-12", "approved": true }
}
```

### 3.5 Checks library (`workframe_harness.checks`)
All checks are deterministic Python (pandas). No AI. Each returns a `CheckResult(name, passed, severity, details)`.
- `require_columns(df, columns)`
- `no_blank_required(df, columns)`
- `values_in_range(df, column, minimum, maximum)` (ranges set by the practitioner)
- `no_duplicates(df, key)`
- `dates_parse(df, column)`
- `forbid_rows(df, column, equals)` (hard exclusions)
- `no_silent_fill(before, after, columns)`: missing values must stay visibly missing, never become zero
- `every_item_has_source(items, field)`: every extracted item carries a source reference
- `run_checks(config_path, data)`: runs a task's `checks.yaml` in order, returns a report; any failed `block` check stops the run before output is written

### 3.6 Memory (`workframe_harness.memory`)
`load_profile(path)`, `save_profile(path, profile)`, `add_correction(path, task, note)`. At the start of each run the notebook prints the student's saved corrections, and `PROMPT_adapt.md` includes them. The profile never leaves the student's machine.

### 3.7 Approval gate (`workframe_harness.approval`)
- `approve(summary, action_label)` shows a plain-language table of what is about to happen (for example, "12 follow-up messages will be written to drafts.csv") and requires an explicit yes.
- Default is dry-run. Export functions refuse to write or send without a recorded approval.
- Starter notebooks produce files and drafts only. They contain no code that sends email or messages.
- Every run appends one line to a local `runs.jsonl`: time, task, input file hash, row counts, check results, approval decision, output path. It never stores row contents.

### 3.8 Golden cases and the runner
Golden case = an input, the date it assumes, and the output the practitioner would accept.

```json
{
  "id": "G-RE-3",
  "description": "A do-not-contact lead is excluded even when 30 days have passed.",
  "input": "cases/G-RE-3.csv",
  "today": "2026-10-12",
  "expect": { "excluded_ids": ["L-104"], "included_ids": [] },
  "source": "PLACEHOLDER_PRACTITIONER_TO_REPLACE"
}
```

Runner: `python -m workframe_harness.golden harness/<profession>/tasks/<task>`. It runs the task's `run()` function on each case and prints pass or fail with the reason. Students run it after any change, including changes their AI assistant made. These are the first illustrative cases, which each practitioner must replace with real, anonymized examples:

| Id | Profession and task | Case | Expected |
|---|---|---|---|
| G-RE-1 | Real estate, lead follow-up list | Lead last contacted 10 days ago, active | On the list |
| G-RE-2 | Real estate, lead follow-up list | Lead contacted 3 days ago | Not on the list |
| G-RE-3 | Real estate, lead follow-up list | Lead marked do-not-contact, 30 days since contact | Never on the list (hard rule) |
| G-LG-1 | Legal, contract clause list | Contract has a heading for the clause being searched | Clause extracted verbatim with its section reference |
| G-LG-2 | Legal, contract clause list | Contract has no such clause | Output says "not found"; nothing is invented |
| G-LG-3 | Legal, contract clause list | An extracted clause with no section reference | Check blocks the output (every item needs a source) |
| G-FT-1 | Fitness, client progress tracker | Four sessions of numbers | Trend computed correctly |
| G-FT-2 | Fitness, client progress tracker | A missing session | Shown as missing; never filled with zero |
| G-FT-3 | Fitness, client progress tracker | A value far outside the plausible range (range set by the practitioner) | Flagged for review |

### 3.9 Using a student's own AI assistant safely (`PROMPT_adapt.md`)
Each kit includes a prompt template with these parts:
1. Role: "You are helping a [profession] adapt an existing script. Follow the rules below."
2. Paste `rules.md`, the task's `task.md`, the student's `profile.json` corrections, and the current notebook cell.
3. Instructions: make only the change I ask for; never remove or weaken a hard rule or a check; don't invent column names; list which rule each change touches; say what you could not verify.
4. Close: "After you write the code, I will run the checks and golden cases myself."
The lesson text tells students: **the assistant writes, the harness checks, you approve.**
Also tell students not to paste client-identifying data into any AI assistant unless their employer or professional rules allow it (3.11).

### 3.10 Delivery in the app
- `scripts/build-kits.ts` zips `harness/shared` plus one profession folder into `kits/<profession>-v<version>.zip` (not in `public/`).
- `GET /api/kit/[course]`: requires sign-in and an active enrollment; streams the latest signed-off kit zip; records a row in `kit_downloads`.
- `/kit/[course]` 🔒: a page that explains the kit, shows the version and a changelog, and has the download button. Linked from the dashboard and from lessons.
- A course cannot be set to `live` while its kit exists but has no recorded practitioner sign-off (3.11).

### 3.11 Practitioner process (instructions to follow for each insider)

Do these in order for each of the three insiders before their course goes live.
1. **Interview (60 minutes).** Ask:
   - What are the five tasks that cost the most time in your week? Rank them.
   - For each: what are the exact steps, what data goes in, and what comes out?
   - What usually goes wrong? What does a junior always get wrong?
   - What must never be automated? What must a human always check before it goes out?
   - What rules or regulations apply to this work? Which of your tools hold the data, and how do you export it?
   - What would an acceptable result look like, with a real example you can anonymize?
2. **Task specs (90 minutes per task).** Fill in `task.md` with the insider. Write hard rules and soft rules separately.
3. **Golden cases.** The insider supplies 3–5 anonymized examples per task with the output they would accept. These replace the illustrative cases in 3.8.
4. **Sign-off.** The insider reads `rules.md`, `rules.yaml` and the golden outputs, removes every `PRACTITIONER_TO_CONFIRM` marker, and approves in writing (email is fine). Record who and when in `harness_kits` (`signed_off_by`, `signed_off_at`).
5. **Clean-room test.** You run every task in a fresh Colab with only the kit and confirm all golden cases pass.
6. **Version.** Stamp the kit (for example 1.0.0). Any later change to a rule needs the insider's approval and a new version.

**Items to verify before launch (none of these are confirmed here):**
- *Real estate:* the terms of use for MLS data and any scraping; fair-housing rules for outreach lists; the rules for texts and emails to leads.
- *Legal:* client confidentiality and privilege; the bar and firm rules on putting client material into AI tools; whether any document may leave the student's machine.
- *Fitness:* how client health data must be handled; where program generation stops and medical advice starts.
- *All:* licensing terms of any dataset you ship; whether students' employers restrict AI tools.
Ask each insider, and a lawyer where the stakes are high. Record answers in `task.md` under Compliance notes.

---

## Section 4: Data Schema Changes

Additive only. Save as `db/migrations/002_learning_and_harness.sql` and run `npm run db:migrate`. Existing v1 rows are untouched; `checkins.confidence` is null for check-ins submitted before v2.

```sql
alter table checkins
  add column if not exists confidence smallint check (confidence between 1 and 5),   -- 'How confident are you that you could automate a similar task on your own?'
  add column if not exists transfer_answer text,                                      -- day 7 only, optional; reviewed by a person, never sent to Claude
  add column if not exists transfer_attempted boolean not null default false;

create table if not exists lesson_responses (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id),
  course_id uuid not null references courses(id),
  lesson_slug text not null,
  stage text not null check (stage in ('predict')),
  response text not null,
  created_at timestamptz not null default now(),
  unique (student_id, course_id, lesson_slug, stage)
);

create table if not exists recall_prompts (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references enrollments(id),
  lesson_slug text not null,
  token text unique not null,
  sent_at timestamptz,
  opened_at timestamptz,
  response text,                     -- the student's attempt from memory; reviewed by a person
  revealed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (enrollment_id, lesson_slug)  -- the cron can never send the same prompt twice
);

create table if not exists harness_kits (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references courses(id),
  version text not null,             -- e.g. '1.0.0'
  file_name text not null,           -- kits/<profession>-v<version>.zip
  changelog text,
  open_markers int not null default 0,   -- count of PRACTITIONER_TO_CONFIRM / PLACEHOLDER markers left in the kit
  signed_off_by text,                -- the practitioner who approved the rules and golden cases
  signed_off_at timestamptz,
  released_at timestamptz,
  created_at timestamptz not null default now(),
  unique (course_id, version)
);

create table if not exists kit_downloads (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id),
  kit_id uuid not null references harness_kits(id),
  downloaded_at timestamptz not null default now()
);

create index if not exists idx_recall_prompts_sent_at on recall_prompts (sent_at);
create index if not exists idx_kit_downloads_downloaded_at on kit_downloads (downloaded_at);
```

---

## Section 5: Routes and Jobs Changed or Added

| Route | Page | Description |
|---|---|---|
| `/learn/[course]/[lesson]` 🔒 | Lesson page (changed) | Stage cards in order: Goal, Predict, Run, Investigate, Modify, Make, Check, When it breaks. Saves the prediction. |
| `/checkin/[token]` | Check-in form (changed) | Adds the 1–5 confidence question (both days) and the optional transfer task (day 7). |
| `/recall/[token]` | Recall page (new, public) | Question, text box, then "Show the answer". Token is the only credential. |
| `/kit/[course]` 🔒 | Kit page (new) | What is in the kit, version, changelog, download button. |
| `/api/kit/[course]` 🔒 | Kit download (new) | Requires an active enrollment; streams the signed-off kit; logs the download. |
| `/admin/learning` 🔒 | Learning review (new) | Day-7 transfer answers, recall answers, prediction-save rate, confidence change. Read-only. |
| `/admin/kits` 🔒 | Kit sign-off (new) | Kit versions, open marker counts, practitioner sign-off form. |

**Jobs:** no new cron entry. The daily `/api/cron/checkins` route also sends recall prompts (day 5). The kill switch already covers it.

---

## Section 6: Success Metrics (added to v1's)

Targets are proposals for the beta.

| Metric | Goal |
|---|---|
| Lessons where a prediction is saved before Run | 60% or higher |
| Day-5 recall response rate | 40% or higher |
| Median confidence change from day 3 to day 7 | Positive; track the share who rise by at least 1 |
| Day-7 transfer task attempted | 30% or higher |
| Kit downloaded within 48 hours of purchase | 60% or higher |
| Insider sign-off complete before a course goes live | 3 of 3 |
| Hours saved: kit downloaders vs. non-downloaders | Compare descriptively. The numbers are small, so don't draw causal claims |

The v1 headline metric, hours saved by the end of week one, is unchanged.

---

## Section 7: Governance Changes

v2 adds no new AI behavior, so the v1 governance controls are unchanged. These additions keep the decision rights explicit.

**Add to `docs/decision-rights.md`:**
- *Human-only:* editing `rules.md`, `rules.yaml`, `task.md` hard rules or golden cases; releasing a kit version; setting a course live when it has a kit. The practitioner must sign off on each.
- *Needs your sign-off:* any change to a kit after release (new version).
- *Claude decides alone:* unchanged (extracting hours saved, drafting digest text). Claude never edits harness files or sees students' predictions, recall answers or transfer answers.

**Add to `docs/strategic-intent.md`:**
- The harness exists so that automations behave the way a practitioner would accept. AI never writes or edits the rules it is checked against.
- The kit collects nothing from students and contains no code that sends email or messages.

**Boundaries:**
- Recall, confidence and transfer prompts are fixed templates with no model-written text.
- Student-written learning content stays in the database and the admin screen, and is never sent to a model in v2.

**Not covered (still a choice you made in v1):** there is no scheduled review of overall AI behavior. Each kit version's practitioner sign-off is the nearest thing to a recurring human review of the rules. Revisit this in Phase 3.


---

## Section 8: Build Order (Steps 13–20)

**How to use this section.** Start only after v1 Step 12 passes. Copy `workframe-prd-v2.md` into the project as `docs/workframe-prd-v2.md`. Run one step at a time in Claude Code. Each step starts with the same line: *"Read docs/workframe-prd.md (v1) and docs/workframe-prd-v2.md. Do only the step below. Do not change anything outside it."* Do not move on until the "After this step, verify" list passes. Commit after each step.

### Step 13: Migration 002 and types
**Prompt:**
Read the two PRD files. Create `db/migrations/002_learning_and_harness.sql` exactly as written in v2 Section 4. Apply it to the Neon dev branch using the Neon MCP (run it on a branch first, never directly on main data). Add matching TypeScript types for the new and changed tables in the existing types file. Do not change any route or page.
**After this step, verify:**
- The migration runs twice without error (use `if not exists` / guarded alters where needed).
- `checkins` has `confidence`, `transfer_answer`, `transfer_attempted`; the four new tables exist with the constraints in Section 4.
- `npm run build` still passes and no existing page changed.

### Step 14: Lesson template and staged lesson page
**Prompt:**
Implement the lesson MDX template from v2 Section 2.2. Add a script `npm run lessons:validate` that fails when a lesson is missing a required frontmatter field, has more than 2 `newConcepts`, has a `stage` outside worked|faded|scaffolded, or lacks any of the eight body headings. Update `/learn/[course]/[lesson]` so Predict is shown first and the student's prediction is saved to `lesson_responses` (stage 'predict') before the Run section opens, with a "skip for now" link that still opens Run. Add two real-estate exemplar lessons that pass validation (one worked, one faded) using placeholder practitioner copy marked `PRACTITIONER_TO_CONFIRM`. Student text is never sent to Claude.
**After this step, verify:**
- `lessons:validate` passes on the exemplars and fails when you delete a heading.
- Saving a prediction, reloading and returning shows it kept; "skip for now" opens Run without saving.
- The page still meets the v1 design tokens and tap-target rules.

### Step 15: Confidence, transfer task and learning admin
**Prompt:**
Update `/checkin/[token]` per v2 Section 2.3: add a 1–5 confidence question to day 3 and day 7; add the optional day-7 transfer question and store it in `transfer_answer` / `transfer_attempted`; add the line asking the student to run it again next Monday. Extend the digest stats with median confidence change and transfer attempt rate (numbers only, no student text). Create `/admin/learning` (admin only) showing the Section 6 metrics and a list of transfer answers for a person to read. All email text stays in fixed templates.
**After this step, verify:**
- A day-3 and day-7 check-in with confidence saves; skipping transfer saves `transfer_attempted = false`.
- The digest draft shows the two new numbers and no student-written text.
- Hours-saved extraction and holds behave exactly as in v1 (confidence is never sent to Claude).

### Step 16: Day-5 recall prompt
**Prompt:**
Inside the existing daily `/api/cron/checkins` route (do not add a new cron), find enrollments on day 5 with no `recall_prompts` row for their most recent completed lesson. Create a row with a random token, send the fixed-template recall email through the existing send path (so the send log, kill switch and email_log apply), and add `/recall/[token]` (public, single use, expires after 14 days) where the student answers the lesson's `recall` question. Answers are stored in `recall_prompts` and are not sent to a model. Add `recall` to the email types.
**After this step, verify:**
- With the kill switch on, no recall email is created or sent.
- Running the cron twice the same day sends one recall email per enrollment.
- An expired or reused token shows a plain message, not an error page.
- No new entry was added to `vercel.json` crons.

### Step 17: Harness shared package
**Prompt:**
Create `harness/shared/workframe_harness/` as specified in v2 Section 3.3–3.8: `checks.py`, `approval.py`, `memory.py`, `runlog.py`, `rules.py`, `golden.py`, with `pytest` tests in `harness/shared/tests/`. `approve()` must default to dry-run and contain no code that sends email or messages. `runlog` must never write row contents. Add the golden runner command from Section 3.8 and a `harness/README.md` that explains the six components in plain language.
**After this step, verify:**
- `pytest harness/shared` passes.
- A grep for `smtp`, `requests`, `httpx` and `send` in `harness/shared` finds nothing that sends.
- The golden runner exits non-zero when a case fails.

### Step 18: Profession scaffolds
**Prompt:**
Under `harness/real-estate`, `harness/legal` and `harness/fitness`, create the structure in Section 3.3: `rules.md`, `rules.yaml`, `PROMPT_adapt.md` (from Section 3.9), `profile.example.json`, and tasks `01` to `05` each with `task.md`, `starter.ipynb`, `checks.yaml`, synthetic `data/`, and `golden/`. Use only synthetic data. Every rule or golden case that needs a practitioner decision carries a `PRACTITIONER_TO_CONFIRM` marker; do not invent professional rules. Add `npm run harness:markers` that prints the open-marker count per profession.
**After this step, verify:**
- Golden cases for each profession run against their task checks and the illustrative G-RE/G-LG/G-FT cases pass.
- Marker count is listed per profession and nonzero where decisions are open.
- No file contains real names, emails, addresses or health details.

### Step 19: Kit build, gated download and sign-off
**Prompt:**
Add `scripts/build-kits.ts` per Section 3.10 to zip each profession into `kits/`, write a `harness_kits` row with `open_markers`, and refuse to build when `open_markers > 0` unless run with `--draft`. Add `GET /api/kit/[course]` (enrolled students only, logs `kit_downloads`), `/kit/[course]` (download page with the version and changelog), and `/admin/kits` where an admin records the practitioner sign-off. Setting a course live must refuse when its latest kit has no sign-off or open markers.
**After this step, verify:**
- A non-enrolled user gets a 403 from `/api/kit/[course]`.
- A draft kit cannot be set live; after sign-off with zero markers it can.
- Downloads appear in `kit_downloads` and the admin page.

### Step 20: Governance docs, remaining lessons and end-to-end check
**Prompt:**
Update `docs/decision-rights.md` and `docs/strategic-intent.md` with the Section 7 text. Convert the remaining lessons to the new template and make `lessons:validate` part of `npm run build`. Update the README with the v2 commands. Then run lint, typecheck, build, `lessons:validate`, `pytest harness/shared`, and write an end-to-end checklist to `docs/e2e-v2.md` covering: enroll → lesson with prediction → day-3 check-in with confidence → day-5 recall → day-7 check-in with transfer → kit download → digest with new numbers, with the kill switch tested at each send.
**After this step, verify:**
- All commands above pass.
- The e2e checklist passes on a test enrollment using Stripe test mode.
- Then run the security phase (ai-security-specialist) on the whole app before real students are enrolled.

---

## Section 9: Out of Scope for v2

- AI-written rules, tasks or golden cases (people write these).
- Claude reading or scoring students' predictions, recall answers or transfer answers.
- Running the harness as a hosted service; the kit runs on the student's own machine or Colab.
- Any messaging or email sending from inside a kit.
- New scheduled jobs.
- A scheduled review of overall AI behavior (see Section 7).
- Corporate-tier features, library subscription, and additional professions beyond the first three.
- Legal, compliance or licensing sign-off; the Section 3.11 items need a qualified person.

## Section 10: Phase 3 Roadmap (not for building now)

1. Use the first cohort's data to compare kit vs non-kit hours saved, then decide whether the kit is worth making a core selling point.
2. Add a monthly review cadence for AI behavior and for rule changes.
3. Let insiders propose rule changes through an admin screen, with the sign-off recorded.
4. Offer a "run it for me" vertical-agent version of the best-performing task, only after the kit proves the rules hold up.
5. Corporate tier: team kits with company-specific rules and shared run logs.

## Open Items Before Real Students

- Practitioner sign-off per profession (3 of 3).
- Compliance and licensing checks in Section 3.11.
- Confirm the five v2 assumptions at the top of this document.
- Security phase on the full app.
