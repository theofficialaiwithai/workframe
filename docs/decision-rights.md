# Decision rights

Who decides what. The code enforces the boundaries below; this page explains them. Owner: Adamma Ihemeson. Version 1.0.

| Claude may decide alone | Needs Adamma's sign-off | Human only |
|---|---|---|
| Extract figures from a student's check-in note | Counting a low-confidence figure (approving a held extraction) | Publicizing results |
| Draft the weekly digest text for an insider | Using any hours-saved number in marketing | Any judgment about a student's performance |
| | Using any hours-saved number in corporate sales | |

## Boundaries the code enforces

- **Hours over 20 a week are held.** An extraction above 20 hours is held for review and counts nowhere until Adamma approves or corrects it. So are low-confidence figures, no time saved, and answers with no quoted evidence.
- **Held and failed rows never count.** Only auto-accepted, approved and corrected rows add to any hours-saved total, and every total is labeled "student-reported, AI-estimated".
- **No student is identified in a digest.** A digest that contains a student's name or email is stored as failed and is never sent.
- **Student emails are fixed templates.** Claude writes nothing a student receives.
- **A human can stop everything.** The kill switch on the System page pauses every scheduled job, and the digest veto window lets Adamma stop a digest before it is sent.
