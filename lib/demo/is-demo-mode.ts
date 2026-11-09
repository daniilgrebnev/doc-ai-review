/** Demo mode when the Anthropic API key is not configured */
export function isDemoMode(): boolean {
  return !process.env.ANTHROPIC_API_KEY;
}
