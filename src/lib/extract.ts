import type { Slide, ThumbMedia, VideoMedia } from '../types.ts'

interface RawVideo {
  url?: string
}
interface RawCandidate {
  url?: string
  width?: number
  height?: number
}
interface RawItem {
  video_versions?: RawVideo[]
  image_versions2?: { candidates?: RawCandidate[] }
  carousel_media?: RawItem[] | null
}

/**
 * Returns the JSON array that follows `key` (e.g. `"items":[`) in the page source.
 * Walks to the matching closing bracket while respecting JSON strings, so nested
 * arrays and brackets inside strings don't end the array early.
 */
export function extractArray(html: string, key: string): unknown[] {
  const start = html.indexOf(key)
  if (start === -1) return []
  const begin = html.indexOf('[', start)
  let i = begin
  let depth = 0
  let inStr = false
  for (; i < html.length; i++) {
    const c = html[i]
    if (inStr) {
      if (c === '\\') i++
      else if (c === '"') inStr = false
    } else if (c === '"') inStr = true
    else if (c === '[') depth++
    else if (c === ']' && --depth === 0) break
  }
  try {
    const value: unknown = JSON.parse(html.slice(begin, i + 1))
    return Array.isArray(value) ? value : []
  } catch {
    return []
  }
}

/**
 * Video entries carry no width/height, so rank them by the resolution encoded in the
 * URL's `efg` parameter (e.g. "...STORY.C3.720.dash_baseline_1_v1" -> 720).
 */
export function resolution(url: string): number {
  try {
    const efg = new URL(url).searchParams.get('efg')
    if (!efg) return 0
    const tag = (JSON.parse(atob(efg)) as { vencode_tag?: string }).vencode_tag ?? ''
    const m = tag.match(/\.(\d{3,4})\./)
    return m ? parseInt(m[1], 10) : 0
  } catch {
    return 0
  }
}

function bestVideo(item: RawItem): VideoMedia | null {
  const [v] = (item.video_versions ?? [])
    .filter((x): x is RawVideo & { url: string } => Boolean(x && x.url))
    .sort((a, b) => resolution(b.url) - resolution(a.url)) // stable: ties keep page order
  return v ? { url: v.url, res: resolution(v.url) } : null
}

function bestThumb(item: RawItem): ThumbMedia | null {
  const [t] = (item.image_versions2?.candidates ?? [])
    .filter((x): x is RawCandidate & { url: string } => Boolean(x && x.url))
    .sort((a, b) => (b.width ?? 0) * (b.height ?? 0) - (a.width ?? 0) * (a.height ?? 0))
  return t ? { url: t.url, width: t.width, height: t.height } : null
}

function toSlides(items: RawItem[]): Slide[] {
  return items
    .map((item, i): Slide => {
      const video = bestVideo(item)
      return { item: i + 1, type: video ? 'video' : 'image', video, thumbnail: bestThumb(item) }
    })
    .filter((s) => s.video || s.thumbnail)
}

/**
 * One entry per story slide. Falls back to a single pseudo-item when the page has no
 * "items" array.
 */
export function extractMedia(html: string): Slide[] {
  let items = extractArray(html, '"items":[') as RawItem[]
  if (!items.length) {
    items = [
      {
        video_versions: extractArray(html, '"video_versions":[') as RawVideo[],
        image_versions2: { candidates: extractArray(html, '"candidates":[') as RawCandidate[] },
      },
    ]
  }
  return toSlides(items)
}

/**
 * One entry per item of a post page. The post is the first entry of "items"; a multi-item
 * post lists its items under `carousel_media`, a single post or reel is the entry itself.
 * Other "items" arrays on the page (related posts) are ignored.
 */
export function extractPost(html: string): Slide[] {
  const [post] = extractArray(html, '"items":[') as RawItem[]
  if (!post) return []
  return toSlides(Array.isArray(post.carousel_media) && post.carousel_media.length ? post.carousel_media : [post])
}

/**
 * Reads what the bookmarklet sends, whatever page it ran on: a post's items sit under
 * `carousel_media`, a story's slides are the entries of `items` themselves.
 */
export function extractAny(json: string): Slide[] {
  const [first] = extractArray(json, '"items":[') as RawItem[]
  return Array.isArray(first?.carousel_media) && first.carousel_media.length ? extractPost(json) : extractMedia(json)
}
