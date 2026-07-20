import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});

const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "AgentFlow — Document Approval",
  description:
    "Multi-agent document approval. Lawyer, finance, security, and PM experts review your document sequentially.",
  openGraph: {
    title: "AgentFlow — Document Approval",
    description:
      "Four AI experts review contracts and specs sequentially and return a structured verdict.",
    type: "website",
    locale: "en_US",
    images: [{ url: "/og.svg", width: 1200, height: 630, alt: "AgentFlow" }],
  },
  icons: {
    icon: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} min-h-screen antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
