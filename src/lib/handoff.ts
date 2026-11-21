import { HASH_KEY } from './snippet.ts'

/** Reads the post JSON the bookmarklet put in the URL fragment (`#post=<base64>`), or null. */
export function decodePostHash(hash: string): string | null {
  const m = hash.match(new RegExp(`^#${HASH_KEY}=(.+)$`))
  if (!m) return null
  try {
    return atob(decodeURIComponent(m[1]))
  } catch {
    return null
  }
}
