"use client";

import { useState, useTransition } from "react";
import { Switch } from "@/components/ui/switch";
import { setKillSwitch } from "@/app/admin/actions";

export function KillSwitch({ initialPaused }: { initialPaused: boolean }) {
  const [paused, setPaused] = useState(initialPaused);
  const [pending, startTransition] = useTransition();

  function change(next: boolean) {
    setPaused(next); // optimistic
    startTransition(async () => {
      try {
        await setKillSwitch(next);
      } catch {
        setPaused(!next); // the server refused: show the real state
      }
    });
  }

  return (
    <label className="flex min-h-tap cursor-pointer items-center gap-u2">
      <Switch checked={paused} onCheckedChange={change} disabled={pending} aria-label="Pause all automated jobs" />
      <span className="text-lg font-medium">Pause all automated jobs</span>
    </label>
  );
}
