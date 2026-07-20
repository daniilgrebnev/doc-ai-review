"use client";

import { cn } from "@/lib/utils";
import { useLocale } from "@/lib/i18n";
import { TAB_LABEL_KEYS } from "@/types/navigation";
import type { AppTab } from "@/types/navigation";
import { useHistoryStore } from "@/store/useHistoryStore";
import type { Locale } from "@/lib/i18n";

interface AppShellProps {
  activeTab: AppTab;
  onTabChange: (tab: AppTab) => void;
  children: React.ReactNode;
}

const tabs: AppTab[] = ["review", "history"];
const locales: Locale[] = ["en", "ru"];

export function AppShell({ activeTab, onTabChange, children }: AppShellProps) {
  const historyCount = useHistoryStore((s) => s.items.length);
  const { locale, setLocale, t } = useLocale();

  const onTabKeyDown = (
    e: React.KeyboardEvent<HTMLButtonElement>,
    index: number
  ) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const next =
      e.key === "ArrowRight"
        ? (index + 1) % tabs.length
        : (index - 1 + tabs.length) % tabs.length;
    onTabChange(tabs[next]);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-surface/90 backdrop-blur-sm">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div>
            <h1 className="text-base font-semibold tracking-tight text-foreground">
              AgentFlow
            </h1>
            <p className="text-xs text-muted">{t("app.tagline")}</p>
          </div>

          <div className="flex items-center gap-2">
            <div
              className="flex rounded-md border border-border p-0.5"
              role="group"
              aria-label="Language"
            >
              {locales.map((code) => (
                <button
                  key={code}
                  type="button"
                  onClick={() => setLocale(code)}
                  className={cn(
                    "rounded px-2 py-1 text-xs font-medium uppercase transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    locale === code
                      ? "bg-primary text-white"
                      : "text-muted hover:text-foreground"
                  )}
                  aria-pressed={locale === code}
                >
                  {code}
                </button>
              ))}
            </div>

            <nav className="flex gap-1" aria-label={t("app.nav")} role="tablist">
              {tabs.map((tab, index) => {
                const selected = activeTab === tab;
                return (
                  <button
                    key={tab}
                    type="button"
                    role="tab"
                    id={`tab-${tab}`}
                    aria-selected={selected}
                    aria-controls={`panel-${tab}`}
                    tabIndex={selected ? 0 : -1}
                    onClick={() => onTabChange(tab)}
                    onKeyDown={(e) => onTabKeyDown(e, index)}
                    className={cn(
                      "rounded-md px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      selected
                        ? "bg-primary text-white"
                        : "text-muted hover:text-foreground"
                    )}
                  >
                    {t(TAB_LABEL_KEYS[tab])}
                    {tab === "history" && historyCount > 0 && (
                      <span className="ml-1.5 text-xs opacity-80">
                        ({historyCount})
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
          </div>
        </div>
      </header>

      <main
        id={`panel-${activeTab}`}
        role="tabpanel"
        aria-labelledby={`tab-${activeTab}`}
        className="mx-auto max-w-3xl px-4 py-6"
      >
        {children}
      </main>
    </div>
  );
}
