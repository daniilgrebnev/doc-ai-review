"use client";

import { Button } from "@/components/ui/Button";
import { Panel } from "@/components/ui/Panel";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <Panel className="max-w-md text-center">
        <h2 className="text-lg font-medium text-neutral-900">
          Что-то пошло не так
        </h2>
        <p className="mt-2 text-sm text-neutral-500">
          {error.message || "Произошла непредвиденная ошибка"}
        </p>
        <Button className="mt-6" onClick={reset}>
          Попробовать снова
        </Button>
      </Panel>
    </main>
  );
}
