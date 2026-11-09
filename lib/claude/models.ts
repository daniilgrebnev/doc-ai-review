const EFFORTS = ["low", "medium", "high", "xhigh", "max"] as const;
type Effort = (typeof EFFORTS)[number];

export function resolveEffort(value: string | undefined, fallback: Effort): Effort {
  const normalized = value?.trim().toLowerCase();
  return (EFFORTS as readonly string[]).includes(normalized ?? "")
    ? (normalized as Effort)
    : fallback;
}

/** claude-opus-5-5 → Claude Opus 5.5, claude-sonnet-5 → Claude Sonnet 5 */
export function formatModelLabel(model: string): string {
  const slug = model.trim();
  if (slug === "demo") return "Demo";

  const match = slug.match(/^claude-([a-z]+)-(\d+)(?:-(\d{1,2}))?$/);
  if (!match) return slug;

  const [, family, major, minor] = match;
  const name = family.charAt(0).toUpperCase() + family.slice(1);
  return `Claude ${name} ${minor ? `${major}.${minor}` : major}`;
}
