"use client";

import { useFormState, useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { submitCheckin, type CheckinState } from "@/app/checkin/actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="mt-u3 w-full sm:w-auto">
      {pending ? "Sending…" : "Submit"}
    </Button>
  );
}

export function CheckinForm({ token }: { token: string }) {
  const [state, action] = useFormState<CheckinState, FormData>(submitCheckin, {
    status: "idle",
  });

  if (state.status === "done") {
    return (
      <p className="text-lg" role="status">
        {state.alreadyAnswered
          ? "Thanks, you've already answered."
          : "Thanks. Your answer helps us measure what this course is worth."}
      </p>
    );
  }

  return (
    <form action={action}>
      <input type="hidden" name="token" value={token} />

      <Label htmlFor="answer" className="text-base font-medium">
        What did you automate this week, how long did it take before, and how long
        does it take now?
      </Label>
      <Textarea
        id="answer"
        name="answer"
        required
        minLength={10}
        maxLength={2000}
        rows={7}
        className="mt-u1 text-base"
      />
      <p className="mt-u1 text-sm text-muted">Rough numbers are fine.</p>

      <Label htmlFor="blockers" className="mt-u3 block text-base font-medium">
        What got in your way? <span className="font-normal text-muted">(optional)</span>
      </Label>
      <Textarea
        id="blockers"
        name="blockers"
        maxLength={1000}
        rows={3}
        className="mt-u1 text-base"
      />

      {state.status === "error" && (
        <p role="alert" className="mt-u2 text-sm text-danger">
          {state.message}
        </p>
      )}
      <SubmitButton />
    </form>
  );
}
