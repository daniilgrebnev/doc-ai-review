import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Contract Check",
  description:
    "An AI agent finds traps in a contract, backs every finding with an exact quote and measures its own quality.",
  openGraph: {
    title: "Contract Check",
    description: "Finds traps in a contract and shows exactly where they are.",
    type: "website",
    locale: "en_US",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Onest:wght@400;500;600;700&family=PT+Serif:ital,wght@0,400;0,700;1,400&family=JetBrains+Mono:wght@400;500&display=swap"
        />
      </head>
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
