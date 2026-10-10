"use client";

import Link from "next/link";
import { useFormState, useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { savePrediction, type PredictState } from "@/app/learn/actions";

function Save() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Saving…" : "Save prediction and open Run"}
    </Button>
  );
}

/** The Predict step: save a guess before Run opens, or skip (which opens Run without saving). */
export function PredictForm({
  courseSlug,
  lessonSlug,
  question,
}: {
  courseSlug: string;
  lessonSlug: string;
  question: string;
}) {
  const [state, action] = useFormState<PredictState, FormData>(
    savePrediction.bind(null, courseSlug, lessonSlug),
    null
  );

  return (
    <form action={action}>
      <Label htmlFor="prediction" className="text-base font-bold">
        {question}
      </Label>
      <Textarea
        id="prediction"
        name="prediction"
        rows={4}
        maxLength={1000}
        required
        className="mt-u1 text-base"
        aria-describedby={state ? "prediction-error" : undefined}
      />
      {state && (
        <p id="prediction-error" role="alert" className="mt-u1 text-sm text-danger">
          {state.message}
        </p>
      )}
      <div className="mt-u2 flex flex-wrap items-center gap-u2">
        <Save />
        <Link
          href={`/learn/${courseSlug}/${lessonSlug}?run=1`}
          className="inline-flex min-h-tap items-center text-sm font-medium underline"
        >
          Skip for now
        </Link>
      </div>
    </form>
  );
}
