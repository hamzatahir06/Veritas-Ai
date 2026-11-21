/** Host without "www.", e.g. "https://www.nature.com/x" -> "nature.com". */
export function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}
