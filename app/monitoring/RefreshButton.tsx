"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

/** Обновляет серверные данные страницы; с auto — каждые 10 секунд */
export function RefreshButton() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [auto, setAuto] = useState(false);

  useEffect(() => {
    if (!auto) return;
    const id = setInterval(() => start(() => router.refresh()), 10_000);
    return () => clearInterval(id);
  }, [auto, router]);

  return (
    <div className="flex items-center gap-4 text-sm">
      <label className="flex cursor-pointer items-center gap-2 text-muted">
        <input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} />
        Auto-refresh
      </label>
      <button
        type="button"
        onClick={() => start(() => router.refresh())}
        disabled={pending}
        className="rounded-md border border-line-2 bg-white px-3 py-1.5 font-medium text-ink hover:bg-hover focus-visible:shadow-focus focus-visible:outline-none disabled:opacity-60"
      >
        {pending ? "Refreshing…" : "Refresh"}
      </button>
    </div>
  );
}
