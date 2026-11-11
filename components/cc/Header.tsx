"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { ModelPicker } from "@/components/cc/ModelPicker";

const NAV = [
  { href: "/", label: "Examples" },
  { href: "/check", label: "Check" },
  { href: "/quality", label: "Quality" },
  { href: "/monitoring", label: "Monitoring" },
];

export function Header() {
  const path = usePathname();
  return (
    <header className="flex min-h-[60px] flex-wrap items-center gap-x-7 gap-y-1 border-b border-line px-4 sm:px-8">
      <Link href="/" className="flex items-center gap-2 text-base font-bold text-ink no-underline">
        <span aria-hidden="true" className="h-2.5 w-2.5 rounded-[2px] bg-ink" />
        Contract Check
      </Link>
      <nav aria-label="Sections" className="order-3 flex w-full gap-6 sm:order-none sm:w-auto sm:flex-1">
        {NAV.map((n) => {
          const on = n.href === "/" ? path === "/" : path.startsWith(n.href);
          return (
            <Link
              key={n.href}
              href={n.href}
              aria-current={on ? "page" : undefined}
              className={cn(
                "border-b-2 border-transparent py-3 text-sm font-medium text-muted no-underline hover:text-ink",
                on && "border-ink text-ink"
              )}
            >
              {n.label}
            </Link>
          );
        })}
      </nav>
      <div className="ml-auto sm:ml-0">
        <ModelPicker />
      </div>
    </header>
  );
}

export function Page({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-paper">
      <Header />
      {children}
    </div>
  );
}
