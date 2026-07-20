"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { getVerdictLabel } from "@/lib/pipeline/verdict";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { useAgentFlowStore } from "@/store/useAgentFlowStore";
import { useHistoryStore } from "@/store/useHistoryStore";
import type { AppTab } from "@/types/navigation";
import type { ReviewRecord, Verdict } from "@/types/agent";

const verdictTextColor: Record<Verdict, string> = {
  approved: "text-green-700",
  rejected: "text-red-700",
  revision: "text-amber-700",
};

type VerdictFilter = "all" | Verdict;

interface ReviewHistoryPanelProps {
  onNavigate?: (tab: AppTab) => void;
}

export function ReviewHistoryPanel({ onNavigate }: ReviewHistoryPanelProps) {
  const items = useHistoryStore((s) => s.items);
  const hasHydrated = useHistoryStore((s) => s._hasHydrated);
  const removeReview = useHistoryStore((s) => s.removeReview);
  const clearAll = useHistoryStore((s) => s.clearAll);
  const loadFromHistory = useAgentFlowStore((s) => s.loadFromHistory);

  const [filter, setFilter] = useState<VerdictFilter>("all");

  if (!hasHydrated) {
    return (
      <div className="text-sm text-muted">Загрузка истории...</div>
    );
  }

  const filtered =
    filter === "all" ? items : items.filter((i) => i.verdict === filter);

  const handleLoad = (record: ReviewRecord) => {
    loadFromHistory(record);
    onNavigate?.("review");
  };

  const filters: { id: VerdictFilter; label: string }[] = [
    { id: "all", label: "Все" },
    { id: "approved", label: "Согласовано" },
    { id: "revision", label: "Доработка" },
    { id: "rejected", label: "Отклонено" },
  ];

  return (
    <section>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted">
          {items.length === 0
            ? "Пока нет сохранённых проверок"
            : `${filtered.length} из ${items.length} записей`}
        </p>
        {items.length > 0 && (
          <Button variant="ghost" size="sm" onClick={clearAll}>
            Очистить
          </Button>
        )}
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {filters.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            className={cn(
              "rounded-md px-3 py-1 text-xs font-medium transition-colors",
              filter === f.id
                ? "bg-primary text-white"
                : "bg-neutral-100 text-muted hover:bg-neutral-200"
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title="История пуста"
          description="Здесь появятся результаты проверок"
        />
      ) : (
        <>
          <div className="hidden overflow-x-auto rounded-lg border border-border md:block">
            <table className="w-full text-left text-sm">
              <thead className="bg-neutral-100">
                <tr>
                  <th className="px-4 py-2.5 font-medium text-neutral-700">
                    Дата
                  </th>
                  <th className="px-4 py-2.5 font-medium text-neutral-700">
                    Документ
                  </th>
                  <th className="px-4 py-2.5 font-medium text-neutral-700">
                    Вердикт
                  </th>
                  <th className="px-4 py-2.5 font-medium text-neutral-700" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((item) => (
                  <tr
                    key={item.id}
                    className="group border-b border-border hover:bg-neutral-50"
                  >
                    <td className="px-4 py-3 text-xs text-muted">
                      {new Date(item.createdAt).toLocaleString("ru-RU")}
                    </td>
                    <td className="max-w-xs px-4 py-3">
                      <button
                        type="button"
                        onClick={() => handleLoad(item)}
                        className="line-clamp-2 text-left text-sm text-neutral-700 hover:text-primary"
                      >
                        {item.documentPreview}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "text-xs font-medium",
                          verdictTextColor[item.verdict]
                        )}
                      >
                        {getVerdictLabel(item.verdict)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => removeReview(item.id)}
                        className="text-muted opacity-0 transition-opacity hover:text-neutral-700 group-hover:opacity-100"
                        aria-label="Удалить запись"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="space-y-2 md:hidden">
            {filtered.map((item) => (
              <li
                key={item.id}
                className="rounded-lg border border-border bg-surface px-4 py-3"
              >
                <button
                  type="button"
                  onClick={() => handleLoad(item)}
                  className="w-full text-left"
                >
                  <div className="flex items-center gap-2 text-xs text-muted">
                    <time dateTime={item.createdAt}>
                      {new Date(item.createdAt).toLocaleString("ru-RU")}
                    </time>
                    <span
                      className={cn(
                        "font-medium",
                        verdictTextColor[item.verdict]
                      )}
                    >
                      {getVerdictLabel(item.verdict)}
                    </span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-sm text-neutral-700">
                    {item.documentPreview}
                  </p>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
