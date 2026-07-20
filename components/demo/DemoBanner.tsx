"use client";

import { useT } from "@/lib/i18n";

interface DemoBannerProps {
  visible: boolean;
}

export function DemoBanner({ visible }: DemoBannerProps) {
  const t = useT();
  if (!visible) return null;

  return (
    <div
      className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-950"
      role="status"
    >
      <p>{t("demo.banner")}</p>
      <p className="mt-1 text-xs text-amber-800/80">{t("demo.bannerHint")}</p>
    </div>
  );
}
