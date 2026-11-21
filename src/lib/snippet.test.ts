import { describe, expect, it } from 'vitest'
import { extractPost } from './extract.ts'
import { decodePostHash } from './handoff.ts'
import { buildBookmarklet } from './snippet.ts'

// Fixtures use made-up hosts. The page model mirrors what the bookmarklet reads: JSON <script> tags.
const SIFT = 'https://sift.example.test/app/'
const cdn = (name: string, stp = '') => `https://cdn.example.test/i/${name}.jpg${stp ? `?stp=${stp}` : ''}`
const logoutImage = (name: string, w: number, h: number) => ({
  original_width: w,
  original_height: h,
  // Logged-out shape: candidates have only a url; the first is the original size.
  image_versions2: {
    candidates: [{ url: cdn(name) }, { url: cdn(name, 's1080x1080') }, { url: cdn(name, 's640x640') }],
  },
})

/** Runs the bookmarklet the way the browser would, against a fake page. */
function run(path: string, scripts: { type: string; text: string }[]) {
  const opened: string[] = []
  const alerts: string[] = []
  const href = buildBookmarklet(SIFT)
  expect(href.startsWith('javascript:')).toBe(true)
  const code = decodeURIComponent(href.slice('javascript:'.length)) // the browser decodes it first
  new Function('location', 'document', 'alert', 'window', 'btoa', code)(
    { pathname: path },
    { scripts: scripts.map((s) => ({ type: s.type, textContent: s.text })) },
    (s: string) => alerts.push(s),
    { open: (u: string) => opened.push(u) },
    (s: string) => globalThis.btoa(s),
  )
  return { opened, alerts }
}

/** What Sift would read from the opened tab. */
const received = (opened: string[]) => {
  expect(opened).toHaveLength(1)
  expect(opened[0].startsWith(`${SIFT}#post=`)).toBe(true)
  return decodePostHash(opened[0].slice(SIFT.length))
}

const wrap = (media: unknown, extra: unknown = {}) =>
  JSON.stringify({ require: [{ data: { gated: { if_not_gated_logged_out: media }, ...(extra as object) } }] })

describe('buildBookmarklet', () => {
  it('has no literal percent sign (the browser decodes the URL before running it)', () => {
    expect(decodeURIComponent(buildBookmarklet(SIFT).slice('javascript:'.length))).not.toContain('%')
  })

  it('opens Sift with every carousel item at its original size, readable by extractPost', () => {
    const post = {
      code: 'Cabc123',
      media_type: 8,
      carousel_media: [logoutImage('a', 1440, 1440), logoutImage('b', 1440, 1440), logoutImage('c', 1242, 1242)],
    }
    const { opened, alerts } = run('/someuser/p/Cabc123/', [{ type: 'application/json', text: wrap(post) }])
    expect(alerts).toEqual([])
    const slides = extractPost(received(opened) ?? '')
    expect(slides.map((s) => s.thumbnail?.url)).toEqual([cdn('a'), cdn('b'), cdn('c')])
    expect(slides.map((s) => [s.thumbnail?.width, s.thumbnail?.height])).toEqual([[1440, 1440], [1440, 1440], [1242, 1242]])
    expect(slides.every((s) => s.type === 'image')).toBe(true)
  })

  it('handles a single post with no carousel', () => {
    const post = { code: 'Cone', ...logoutImage('solo', 1080, 1350) }
    const { opened } = run('/p/Cone/', [{ type: 'application/json', text: wrap(post) }])
    const slides = extractPost(received(opened) ?? '')
    expect(slides).toHaveLength(1)
    expect(slides[0].thumbnail).toMatchObject({ url: cdn('solo'), width: 1080, height: 1350 })
  })

  it('keeps video urls so the best one can be picked', () => {
    const post = {
      code: 'Creel',
      video_versions: [{ url: 'https://cdn.example.test/v/one.mp4', type: 101 }],
      ...logoutImage('cover', 720, 1280),
    }
    const { opened } = run('/reel/Creel/', [{ type: 'application/json', text: wrap(post) }])
    const [slide] = extractPost(received(opened) ?? '')
    expect(slide.type).toBe('video')
    expect(slide.video?.url).toBe('https://cdn.example.test/v/one.mp4')
  })

  it('uses the largest candidate when candidates carry sizes', () => {
    const post = {
      code: 'Csized',
      image_versions2: {
        candidates: [
          { url: cdn('small'), width: 320, height: 320 },
          { url: cdn('big'), width: 1080, height: 1350 },
          { url: cdn('square'), width: 1080, height: 1080 },
        ],
      },
    }
    const { opened } = run('/p/Csized/', [{ type: 'application/json', text: wrap(post) }])
    expect(extractPost(received(opened) ?? '')[0].thumbnail).toMatchObject({ url: cdn('big'), width: 1080, height: 1350 })
  })

  it('picks the post named in the URL, not another post on the page', () => {
    const other = { code: 'Cother', ...logoutImage('other', 640, 640) }
    const mine = { code: 'Cmine', ...logoutImage('mine', 1080, 1080) }
    const { opened } = run('/p/Cmine/', [{ type: 'application/json', text: wrap(other, { related: mine }) }])
    expect(extractPost(received(opened) ?? '')[0].thumbnail?.url).toBe(cdn('mine'))
  })

  it('skips scripts that are not JSON or do not mention the post', () => {
    const post = { code: 'Cabc', ...logoutImage('x', 1000, 1000) }
    const { opened } = run('/p/Cabc/', [
      { type: 'text/javascript', text: 'Cabc' },
      { type: 'application/json', text: '{not json Cabc' },
      { type: 'application/json', text: '{"other":1}' },
      { type: 'application/json', text: wrap(post) },
    ])
    expect(extractPost(received(opened) ?? '')).toHaveLength(1)
  })

  it('alerts and opens nothing when the page is not a post', () => {
    const { opened, alerts } = run('/someuser/', [])
    expect(opened).toEqual([])
    expect(alerts).toEqual(['Open a post page first.'])
  })

  it('alerts and opens nothing when the post data is missing', () => {
    const { opened, alerts } = run('/p/Cmissing/', [{ type: 'application/json', text: '{"a":"Cmissing"}' }])
    expect(opened).toEqual([])
    expect(alerts).toEqual(['Post data not found. Reload the post page and try again.'])
  })
})

describe('decodePostHash', () => {
  const hash = (s: string) => `#post=${encodeURIComponent(btoa(s))}`
  it('decodes what the bookmarklet sends', () => {
    expect(decodePostHash(hash('{"items":[]}'))).toBe('{"items":[]}')
  })
  it('survives characters that need escaping in a URL', () => {
    const s = '{"u":"https://x.test/a?b=c&d=e+f/g=="}'
    expect(decodePostHash(hash(s))).toBe(s)
  })
  it.each(['', '#', '#other=abc', '#post=', '#post=%%%', '#post=!!notbase64!!'])('returns null for %j', (h) => {
    expect(decodePostHash(h)).toBeNull()
  })
})
