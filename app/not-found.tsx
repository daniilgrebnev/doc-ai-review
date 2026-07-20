import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="text-center">
        <p className="text-sm text-neutral-400">404</p>
        <h2 className="mt-2 text-lg font-medium text-neutral-900">
          Страница не найдена
        </h2>
        <Link
          href="/"
          className="mt-6 inline-block text-sm text-neutral-900 underline underline-offset-2 hover:no-underline"
        >
          На главную
        </Link>
      </div>
    </main>
  );
}
