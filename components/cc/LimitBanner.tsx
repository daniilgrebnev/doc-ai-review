/** Shown once the free demo runs are used up: clone the repo with your own keys, or get in touch */
const REPO_URL = "https://github.com/daniilgrebnev/doc-ai-review";
const CONTACT_EMAIL = "danilgrebneff@proton.me";

export function LimitBanner({ limit }: { limit?: number | null }) {
  return (
    <section role="status" className="flex flex-col gap-3 rounded-lg border border-ink bg-white p-5">
      <strong className="text-[17px]">You&apos;ve used all {limit ?? 10} free runs</strong>
      <span className="text-sm text-ink-2">
        This is a public demo with a run limit. To use Contract Check for your business, clone the repository and add your own API keys, or get
        in touch about an integration. The ready-made examples still work.
      </span>
      <div className="flex flex-wrap items-center gap-4">
        <a
          href={REPO_URL}
          target="_blank"
          rel="noreferrer"
          className="inline-flex min-h-[44px] items-center rounded-lg bg-ink px-4 text-sm font-semibold text-white no-underline hover:bg-[#2B2E36]"
        >
          Clone on GitHub
        </a>
        <a href={`mailto:${CONTACT_EMAIL}?subject=Contract%20Check%20integration`} className="inline-flex min-h-[44px] items-center text-sm font-semibold text-link">
          Write to {CONTACT_EMAIL}
        </a>
      </div>
    </section>
  );
}
