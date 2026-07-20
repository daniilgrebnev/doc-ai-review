"use client";

import { useEffect, useState } from "react";
import { ReviewView } from "@/components/review/ReviewView";
import { ReviewHistoryPanel } from "@/components/history/ReviewHistoryPanel";
import { AppShell } from "@/components/layout/AppShell";
import { ToastProvider } from "@/components/ui/Toast";
import { LocaleProvider, useT } from "@/lib/i18n";
import { useHistoryStore } from "@/store/useHistoryStore";
import type { AppTab } from "@/types/navigation";

function HydrateGate({ children }: { children: React.ReactNode }) {
  const hasHydrated = useHistoryStore((s) => s._hasHydrated);
  const t = useT();

  useEffect(() => {
    void useHistoryStore.persist.rehydrate();
  }, []);

  if (!hasHydrated) {
    return (
      <div
        className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background"
        role="status"
        aria-live="polite"
      >
        <div className="h-8 w-8 animate-pulse rounded-full border-2 border-accent border-t-transparent" />
        <div className="text-center">
          <p className="text-sm font-semibold text-foreground">AgentFlow</p>
          <p className="mt-1 text-xs text-muted">{t("app.loading")}</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

function AppBody() {
  const [activeTab, setActiveTab] = useState<AppTab>("review");

  return (
    <ToastProvider>
      <AppShell activeTab={activeTab} onTabChange={setActiveTab}>
        {activeTab === "review" ? (
          <ReviewView />
        ) : (
          <ReviewHistoryPanel onNavigate={setActiveTab} />
        )}
      </AppShell>
    </ToastProvider>
  );
}

export function HomeContent() {
  return (
    <LocaleProvider>
      <HydrateGate>
        <AppBody />
      </HydrateGate>
    </LocaleProvider>
  );
}
