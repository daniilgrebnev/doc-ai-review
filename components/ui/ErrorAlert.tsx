"use client";

import { Button } from "@/components/ui/Button";
import { useT } from "@/lib/i18n";

interface ErrorAlertProps {
  message: string;
  onRetry?: () => void;
}

export function ErrorAlert({ message, onRetry }: ErrorAlertProps) {
  const t = useT();

  return (
    <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3">
      <p className="text-sm text-red-800">{message}</p>
      {onRetry && (
        <Button variant="ghost" size="sm" className="mt-2 -ml-2" onClick={onRetry}>
          {t("error.retry")}
        </Button>
      )}
    </div>
  );
}
