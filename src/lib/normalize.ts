export type NormalizeResult = { url: string } | { error: string }

const RESERVED = new Set([
  'p', 'reel', 'reels', 'tv', 'explore', 'accounts', 'direct', 'about', 'developer',
  'legal', 'privacy', 'web', 'api', 'challenge', 'session', 'oauth', 'emails', 'nametag',
  'download', 'directory', 'login', 'locations', 'topics', 'stories',
])

// The only place the story host is named (tests import it from here). HOSTS[0] is the host
// links are built on and accepted from; the others are recognised as links so they get a clear error.
export const HOSTS = ['instagram.com', 'instagr.am']
const esc = (h: string) => h.replace(/\./g, '\\.')
const LINK_START = new RegExp(`^(www\\.|m\\.)?(${HOSTS.map(esc).join('|')})\\b`, 'i')
const STORY_HOST = new RegExp(`^(www\\.|m\\.)?${esc(HOSTS[0])}$`, 'i')

const isUser = (u: string) => /^[A-Za-z0-9._]{1,30}$/.test(u)
const toStory = (u: string): NormalizeResult => ({
  url: `https://www.${HOSTS[0]}/stories/${u.toLowerCase()}/`,
})

/**
 * Accepts a username, @username, profile link or story link.
 * Returns a story URL, or an error message for input it can't use.
 * Story links (including highlights and story ids) are returned as given.
 */
export function normalizeStoryUrl(raw: string): NormalizeResult {
  const s = String(raw || '').trim().replace(/^view-source:/i, '').trim()
  if (!s) return { error: 'Enter a username or a link.' }

  const looksLikeLink = /\//.test(s) || LINK_START.test(s)

  if (!looksLikeLink) {
    const name = s.replace(/^@/, '')
    return isUser(name) ? toStory(name) : { error: 'That is not a valid username.' }
  }

  let u: URL
  try {
    u = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(s) ? s : 'https://' + s)
  } catch {
    return { error: 'That does not look like a valid link.' }
  }
  if (!/^https?:$/.test(u.protocol) || !STORY_HOST.test(u.hostname)) {
    return { error: 'That is not a supported link.' }
  }

  let seg = u.pathname.split('/').filter(Boolean)
  if (seg[0] && seg[0].toLowerCase() === '_u') seg = seg.slice(1) // app deep link: /_u/username

  if (seg[0] && seg[0].toLowerCase() === 'stories') {
    return seg[1] ? { url: u.href } : { error: 'That story link has no username in it.' }
  }
  if (!seg[0]) return { error: 'No username found in that link.' }
  if (RESERVED.has(seg[0].toLowerCase()) || !isUser(seg[0])) {
    return { error: 'That link is not a profile. Paste a username or a profile link.' }
  }
  return toStory(seg[0])
}

const POST_KINDS = new Set(['p', 'reel', 'reels', 'tv'])
const POST_CODE = /^[A-Za-z0-9_-]+$/

/**
 * Accepts a post or reel link: /p/CODE/, /reel/CODE/, /tv/CODE/, optionally under a
 * username (/username/p/CODE/). Returns the clean post URL (tracking query dropped).
 */
export function normalizePostUrl(raw: string): NormalizeResult {
  const s = String(raw || '').trim().replace(/^view-source:/i, '').trim()
  if (!s) return { error: 'Enter a post link.' }

  let u: URL
  try {
    u = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(s) ? s : 'https://' + s)
  } catch {
    return { error: 'That does not look like a valid link.' }
  }
  if (!/^https?:$/.test(u.protocol) || !STORY_HOST.test(u.hostname)) {
    return { error: 'That is not a supported link.' }
  }

  const seg = u.pathname.split('/').filter(Boolean)
  const kind = seg.findIndex((x, i) => i < 2 && POST_KINDS.has(x.toLowerCase()))
  if (kind === -1 || (kind === 1 && !isUser(seg[0]))) {
    return { error: 'That is not a post link. Paste a link to a post or reel.' }
  }
  if (!POST_CODE.test(seg[kind + 1] ?? '')) return { error: 'That post link has no post code in it.' }
  return { url: `https://www.${HOSTS[0]}/${seg.slice(0, kind + 2).join('/')}/` }
}
