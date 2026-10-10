"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export function EnrollButton({
  courseSlug,
  label,
  disabled,
}: {
  courseSlug: string;
  label: string;
  disabled?: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function enroll() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courseSlug }),
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        throw new Error(data.error ?? "Checkout is unavailable");
      }
      window.location.href = data.url;
    } catch (err) {
      setError((err as Error).message);
      setLoading(false);
    }
  }

  return (
    <>
      <Button
        className="mt-u3 w-full"
        disabled={disabled || loading}
        onClick={enroll}
      >
        {loading ? "Redirecting to checkout…" : label}
      </Button>
      {error && (
        <p role="alert" className="mt-u1 text-sm text-danger">
          {error}. Please try again.
        </p>
      )}
    </>
  );
}
