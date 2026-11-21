import type { HandoffKind } from './snippet.ts'

export interface Handoff {
  kind: HandoffKind
  /** The JSON the bookmarklet sent. */
  data: string
}

/** Reads what the bookmarklet put in the URL fragment (`#story=<base64>` or `#post=<base64>`), or null. */
export function decodeHandoff(hash: string): Handoff | null {
  const m = hash.match(/^#(story|post)=(.+)$/)
  if (!m) return null
  try {
    return { kind: m[1] as HandoffKind, data: atob(decodeURIComponent(m[2])) }
  } catch {
    return null
  }
}
