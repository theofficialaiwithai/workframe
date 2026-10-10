import { ActionForm } from "@/components/admin/action-form";
import { HighlightedAnswer } from "@/components/admin/highlighted-answer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  approveExtraction,
  confirmSample,
  correctExtraction,
  rejectExtraction,
} from "@/app/admin/actions";
import { formatTime, type ReviewRow } from "@/lib/admin-data";
import { HOURS_LABEL } from "@/lib/extraction-rules";

function NoteField({ id, required }: { id: string; required: boolean }) {
  return (
    <div>
      <Label htmlFor={id} className="text-xs text-muted">
        Note{required ? " (required)" : " (optional)"}
      </Label>
      <Input id={id} name="note" maxLength={500} required={required} className="mt-[5px]" />
    </div>
  );
}

function CorrectForm({ row, mode }: { row: ReviewRow; mode: "review" | "sample" }) {
  const field = (name: string, label: string, value: number | null) => (
    <div>
      <Label htmlFor={`${name}-${row.id}`} className="text-xs text-muted">
        {label}
      </Label>
      <Input
        id={`${name}-${row.id}`}
        name={name}
        type="number"
        inputMode="numeric"
        min={name === "runs_in_week" ? 1 : 0}
        step={1}
        required
        defaultValue={value ?? ""}
        className="mt-[5px]"
      />
    </div>
  );
  return (
    <details className="rounded-md border border-border p-u1">
      <summary className="flex min-h-tap cursor-pointer items-center text-sm font-bold">Correct</summary>
      <div className="mt-u1">
        <ActionForm action={correctExtraction.bind(null, row.id, mode)} label="Save correction">
          {field("minutes_before", "Minutes before", row.minutes_before)}
          {field("minutes_after", "Minutes after", row.minutes_after)}
          {field("runs_in_week", "Runs this week", row.runs_in_week)}
          <NoteField id={`note-c-${row.id}`} required />
        </ActionForm>
      </div>
    </details>
  );
}

/** Review queue and sampling queue share one layout; only the actions differ. */
export function ReviewTable({ rows, mode }: { rows: ReviewRow[]; mode: "review" | "sample" }) {
  return (
    <>
    <Table className="min-w-[1180px] lg:min-w-0 lg:table-fixed">
      <TableHeader>
        <TableRow>
          <TableHead className="lg:w-[110px]">Course</TableHead>
          <TableHead className="lg:w-[150px]">Extracted</TableHead>
          <TableHead className="lg:w-[70px]">Hours</TableHead>
          <TableHead className="lg:w-[100px]">Confidence</TableHead>
          <TableHead className="lg:w-[110px]">{mode === "review" ? "Held because" : "Status"}</TableHead>
          <TableHead>Evidence quoted, and the student&apos;s full answer</TableHead>
          <TableHead className="lg:w-[220px]">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r) => (
          <TableRow key={r.id} className="align-top">
            <TableCell>
              <p className="font-medium">{r.course_title}</p>
              <p className="text-xs text-muted">{formatTime(mode === "review" ? r.created_at : r.sampled_at)}</p>
            </TableCell>
            <TableCell>
              <p className="font-medium">{r.task ?? "-"}</p>
              <p className="text-sm">
                {r.minutes_before} min → {r.minutes_after} min
              </p>
              <p className="text-sm text-muted">{r.runs_in_week} run(s) this week</p>
            </TableCell>
            <TableCell className="font-mono">{r.hours_saved ?? "-"}</TableCell>
            <TableCell className="font-mono">{r.confidence ?? "-"}</TableCell>
            <TableCell className="text-sm">{mode === "review" ? r.hold_reason : r.status}</TableCell>
            <TableCell>
              {r.evidence_phrases && r.evidence_phrases.length > 0 ? (
                <ul className="mb-u1 list-disc space-y-[5px] pl-u2 text-sm">
                  {r.evidence_phrases.map((p) => (
                    <li key={p}>&ldquo;{p}&rdquo;</li>
                  ))}
                </ul>
              ) : (
                <p className="mb-u1 text-sm text-muted">No evidence quoted.</p>
              )}
              <div className="rounded-md bg-surface-alt p-u1">
                <HighlightedAnswer text={r.raw_answer} phrases={r.evidence_phrases} />
              </div>
            </TableCell>
            <TableCell>
              <div className="space-y-u1">
                {mode === "review" ? (
                  <>
                    <ActionForm action={approveExtraction.bind(null, r.id)} label="Approve" variant="default">
                      <NoteField id={`note-a-${r.id}`} required={false} />
                    </ActionForm>
                    <CorrectForm row={r} mode="review" />
                    <details className="rounded-md border border-border p-u1">
                      <summary className="flex min-h-tap cursor-pointer items-center text-sm font-bold">Reject</summary>
                      <div className="mt-u1">
                        <ActionForm action={rejectExtraction.bind(null, r.id)} label="Reject">
                          <NoteField id={`note-r-${r.id}`} required />
                        </ActionForm>
                      </div>
                    </details>
                  </>
                ) : (
                  <>
                    <ActionForm action={confirmSample.bind(null, r.id)} label="Confirm" variant="default">
                      <NoteField id={`note-s-${r.id}`} required={false} />
                    </ActionForm>
                    <CorrectForm row={r} mode="sample" />
                  </>
                )}
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
    <p className="border-t border-border p-u1 text-xs text-muted">Hours: {HOURS_LABEL}.</p>
    </>
  );
}
