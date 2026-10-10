"use client";

import { useFormState, useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import type { ActionResult } from "@/app/admin/actions";

function Submit({ label, variant }: { label: string; variant: "default" | "outline" }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant={variant} disabled={pending} className="w-full">
      {pending ? "Saving…" : label}
    </Button>
  );
}

/** A small form for one admin action. Shows the action's message under the button. */
export function ActionForm({
  action,
  label,
  variant = "outline",
  children,
}: {
  action: (prev: ActionResult, formData: FormData) => Promise<ActionResult>;
  label: string;
  variant?: "default" | "outline";
  children?: React.ReactNode;
}) {
  const [state, formAction] = useFormState(action, null);
  return (
    <form action={formAction} className="space-y-u1">
      {children}
      <Submit label={label} variant={variant} />
      {state && (
        <p role={state.ok ? "status" : "alert"} className={`text-sm ${state.ok ? "text-ink" : "text-danger"}`}>
          {state.message}
        </p>
      )}
    </form>
  );
}
