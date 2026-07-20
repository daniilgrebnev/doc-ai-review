import { LoadingSpinner } from "@/components/ui/LoadingSpinner";

export default function Loading() {
  return (
    <main className="flex min-h-screen items-center justify-center">
      <LoadingSpinner size="lg" />
    </main>
  );
}
