/** External URL helpers for the public commons (anti-ad surface). */

const URL_RE = /https?:\/\/[^\s)\]\>"']+/gi;

const TRUSTED_HOST_SUFFIXES = [
  'brainpod.org',
  'www.brainpod.org',
  'luminanova.org',
  'www.luminanova.org',
];

function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

function isTrustedHost(host: string): boolean {
  return TRUSTED_HOST_SUFFIXES.some(
    (trusted) => host === trusted || host.endsWith(`.${trusted}`)
  );
}

/** Unique external (non-Brainpod / non-LuminaNova) http(s) URLs in text. */
export function listExternalUrls(text: string): string[] {
  if (!text) return [];
  const found = text.match(URL_RE) ?? [];
  const unique = new Set<string>();
  for (const raw of found) {
    const cleaned = raw.replace(/[.,;:]+$/, '');
    const host = hostOf(cleaned);
    if (!host || isTrustedHost(host)) continue;
    unique.add(cleaned);
  }
  return [...unique];
}

export function countExternalUrls(text: string): number {
  return listExternalUrls(text).length;
}

/** Max external links allowed in a Director public release note. */
export const MAX_EXTERNAL_LINKS_IN_RELEASE = 2;

/** Max external links allowed in a public insight note. */
export const MAX_EXTERNAL_LINKS_IN_INSIGHT = 1;
