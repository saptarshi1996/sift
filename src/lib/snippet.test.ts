import { describe, expect, it } from 'vitest'
import { extractMedia, extractPost } from './extract.ts'
import { decodeHandoff } from './handoff.ts'
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

type Script = { type: string; text: string }
const json = (text: string): Script => ({ type: 'application/json', text })
/** A page's HTML as the server sends it: the JSON scripts a fetch of the page would return. */
const html = (...scripts: Script[]) =>
  scripts.map((s) => `<script type="${s.type}">${s.text}</script>`).join('\n')

interface Result {
  /** Every url Sift was opened with (directly, or by pointing the opened window at it). */
  opened: string[]
  alerts: string[]
  /** How many times the page was fetched again, and how many windows were opened blank and closed. */
  fetches: number
  closed: number
  /** The headers of the last fetch. */
  accept?: string
}

/**
 * Runs the bookmarklet the way the browser would, against a fake page: `scripts` is what the live
 * page holds, `fetched` is the HTML a fetch of the page returns (or an Error to make it fail).
 */
async function run(path: string, scripts: Script[], fetched: string | Error = new Error('offline')): Promise<Result> {
  const result: Result = { opened: [], alerts: [], fetches: 0, closed: 0 }
  const href = buildBookmarklet(SIFT)
  expect(href.startsWith('javascript:')).toBe(true)
  const code = decodeURIComponent(href.slice('javascript:'.length)) // the browser decodes it first
  const window = {
    open: (url?: string) => {
      if (url) {
        result.opened.push(url)
        return null
      }
      return {
        location: {
          set href(v: string) {
            result.opened.push(v)
          },
        },
        close: () => result.closed++,
      }
    },
  }
  const fakeFetch = (_url: string, init?: { headers?: { Accept?: string } }) => {
    result.fetches++
    result.accept = init?.headers?.Accept
    return fetched instanceof Error
      ? Promise.reject(fetched)
      : Promise.resolve({
          status: 200,
          redirected: false,
          url: `https://page.example.test${path}`,
          text: () => Promise.resolve(fetched),
        })
  }
  class FakeParser {
    parseFromString(text: string) {
      const scripts = [...text.matchAll(/<script type="([^"]*)">([\s\S]*?)<\/script>/g)].map((m) => ({
        type: m[1],
        textContent: m[2],
      }))
      return { scripts }
    }
  }
  new Function('location', 'document', 'alert', 'window', 'btoa', 'fetch', 'DOMParser', code)(
    { pathname: path, href: `https://page.example.test${path}` },
    { scripts: scripts.map((s) => ({ type: s.type, textContent: s.text })) },
    (s: string) => result.alerts.push(s),
    window,
    (s: string) => globalThis.btoa(s),
    fakeFetch,
    FakeParser,
  )
  await new Promise((r) => setTimeout(r, 0)) // let the fetch chain finish
  return result
}

/** The message of each alert, without the diagnostic lines a failure adds below it. */
const messages = (alerts: string[]) => alerts.map((a) => a.split('\n')[0])

/** What Sift would read from the opened tab. */
const received = (opened: string[]) => {
  expect(opened).toHaveLength(1)
  expect(opened[0].startsWith(`${SIFT}#`)).toBe(true)
  const h = decodeHandoff(opened[0].slice(SIFT.length))
  expect(h).not.toBeNull()
  return h!
}
/** The post slides Sift would show for a post page. */
const postSlides = (opened: string[]) => {
  const h = received(opened)
  expect(h.kind).toBe('post')
  return extractPost(h.data)
}

const wrap = (media: unknown, extra: unknown = {}) =>
  JSON.stringify({ require: [{ data: { gated: { if_not_gated_logged_out: media }, ...(extra as object) } }] })

describe('buildBookmarklet', () => {
  it('has no literal percent sign (the browser decodes the URL before running it)', () => {
    expect(decodeURIComponent(buildBookmarklet(SIFT).slice('javascript:'.length))).not.toContain('%')
  })

  it('opens Sift with every carousel item at its original size, readable by extractPost', async () => {
    const post = {
      code: 'Cabc123',
      media_type: 8,
      carousel_media: [logoutImage('a', 1440, 1440), logoutImage('b', 1440, 1440), logoutImage('c', 1242, 1242)],
    }
    const { opened, alerts, fetches } = await run('/someuser/p/Cabc123/', [json(wrap(post))])
    expect(alerts).toEqual([])
    expect(fetches).toBe(0) // the live page had the data, no second request
    const slides = postSlides(opened)
    expect(slides.map((s) => s.thumbnail?.url)).toEqual([cdn('a'), cdn('b'), cdn('c')])
    expect(slides.map((s) => [s.thumbnail?.width, s.thumbnail?.height])).toEqual([[1440, 1440], [1440, 1440], [1242, 1242]])
    expect(slides.every((s) => s.type === 'image')).toBe(true)
  })

  it('handles a single post with no carousel', async () => {
    const post = { code: 'Cone', ...logoutImage('solo', 1080, 1350) }
    const { opened } = await run('/p/Cone/', [json(wrap(post))])
    const slides = postSlides(opened)
    expect(slides).toHaveLength(1)
    expect(slides[0].thumbnail).toMatchObject({ url: cdn('solo'), width: 1080, height: 1350 })
  })

  it('keeps video urls so the best one can be picked', async () => {
    const post = {
      code: 'Creel',
      video_versions: [{ url: 'https://cdn.example.test/v/one.mp4', type: 101 }],
      ...logoutImage('cover', 720, 1280),
    }
    const { opened } = await run('/reel/Creel/', [json(wrap(post))])
    const [slide] = postSlides(opened)
    expect(slide.type).toBe('video')
    expect(slide.video?.url).toBe('https://cdn.example.test/v/one.mp4')
  })

  it('uses the largest candidate when candidates carry sizes', async () => {
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
    const { opened } = await run('/p/Csized/', [json(wrap(post))])
    expect(postSlides(opened)[0].thumbnail).toMatchObject({ url: cdn('big'), width: 1080, height: 1350 })
  })

  it('picks the post named in the URL, not another post on the page', async () => {
    const other = { code: 'Cother', ...logoutImage('other', 640, 640) }
    const mine = { code: 'Cmine', ...logoutImage('mine', 1080, 1080) }
    const { opened } = await run('/p/Cmine/', [json(wrap(other, { related: mine }))])
    expect(postSlides(opened)[0].thumbnail?.url).toBe(cdn('mine'))
  })

  it('skips scripts that are not JSON or do not mention the post', async () => {
    const post = { code: 'Cabc', ...logoutImage('x', 1000, 1000) }
    const { opened } = await run('/p/Cabc/', [
      { type: 'text/javascript', text: 'Cabc' },
      json('{not json Cabc'),
      json('{"other":1}'),
      json(wrap(post)),
    ])
    expect(postSlides(opened)).toHaveLength(1)
  })

  it('alerts and opens nothing, without fetching, when the page is not a post or story', async () => {
    const { opened, alerts, fetches, closed } = await run('/someuser/', [])
    expect(opened).toEqual([])
    expect(alerts).toEqual(['Open a post or story page first.'])
    expect(fetches).toBe(0)
    expect(closed).toBe(0)
  })
})

describe('story pages', () => {
  const videoUrl = (name: string, res: number) =>
    `https://cdn.example.test/v/${name}.mp4?efg=${encodeURIComponent(btoa(JSON.stringify({ vencode_tag: `xpv.STORY.C3.${res}.dash` })))}`
  const story = (name: string, res?: number) => ({
    original_width: 720,
    original_height: 1280,
    ...(res ? { video_versions: [{ url: videoUrl(name, 480) }, { url: videoUrl(name, res) }, { url: videoUrl(name, 480) }] } : {}),
    image_versions2: {
      candidates: [
        { url: cdn(`${name}-big`), width: 640, height: 1136 },
        { url: cdn(`${name}-small`), width: 320, height: 568 },
        { url: cdn(`${name}-square`), width: 640, height: 640 },
      ],
    },
  })
  const reelsOf = (user: unknown, ...items: unknown[]) =>
    JSON.stringify({ require: [{ data: { xdt_api__v1__feed__reels_media: { reels_media: [{ id: '1', user, items }] } } }] })
  const reels = (...items: unknown[]) => reelsOf({ username: 'someuser' }, ...items)
  const fromStory = async (items: unknown[], path = '/stories/someuser/123/') => {
    const { opened, alerts } = await run(path, [json(reels(...items))])
    return { alerts, h: received(opened) }
  }

  it('sends every story slide, tagged as a story, readable by extractMedia', async () => {
    const { alerts, h } = await fromStory([story('a', 720), story('b')])
    expect(alerts).toEqual([])
    expect(h.kind).toBe('story')
    const slides = extractMedia(h.data)
    expect(slides.map((s) => s.type)).toEqual(['video', 'image'])
    expect(slides[0].video).toMatchObject({ url: videoUrl('a', 720), res: 720 }) // best of the three video entries
    expect(slides[0].thumbnail).toMatchObject({ url: cdn('a-big'), width: 640, height: 1136 })
    expect(slides[1].thumbnail?.url).toBe(cdn('b-big'))
  })

  it('works on a highlight page', async () => {
    expect((await fromStory([story('h', 720)], '/stories/highlights/18000/')).h.kind).toBe('story')
  })

  it('uses the first reel when the page lists several', async () => {
    const text = JSON.stringify({
      reels_media: [{ items: [story('first', 720)] }, { items: [story('second', 720), story('third', 720)] }],
    })
    const { opened } = await run('/stories/someuser/', [json(text)])
    expect(extractMedia(received(opened).data)).toHaveLength(1)
  })

  it('does not treat a post page as a story page', async () => {
    const post = { code: 'Cabc', ...logoutImage('p', 1000, 1000) }
    const { opened } = await run('/p/Cabc/', [json(reels(story('s', 720))), json(wrap(post))])
    expect(received(opened).kind).toBe('post')
  })

  describe('the page must hold the story of the user in the address bar', () => {
    const wrongUser = 'This page holds the story of another user. Reload the story page and try again.'
    const stale = (user: unknown) => [json(reelsOf(user, story('a', 720)))]

    it('with another user\'s data and no way to fetch the right one: alerts and opens nothing', async () => {
      const { opened, alerts, closed } = await run('/stories/otheruser/', stale({ username: 'someuser' }))
      expect(opened).toEqual([])
      expect(messages(alerts)).toEqual([wrongUser])
      expect(closed).toBe(1) // the blank window it opened is closed again
    })

    it('refuses it even when the address has a story id', async () => {
      expect(messages((await run('/stories/otheruser/4035379841310490256/', stale({ username: 'someuser' }))).alerts)).toEqual([wrongUser])
    })

    it('ignores letter case in the username', async () => {
      const { opened, alerts } = await run('/stories/SomeUser/', stale({ username: 'someuser' }))
      expect(alerts).toEqual([])
      expect(opened).toHaveLength(1)
    })

    it('does not check highlight pages (their address has no username)', async () => {
      expect((await run('/stories/highlights/18000/', stale({ username: 'someuser' }))).opened).toHaveLength(1)
    })

    it('accepts a reel that names no user', async () => {
      expect((await run('/stories/someuser/', stale(undefined))).opened).toHaveLength(1)
      expect((await run('/stories/someuser/', stale({}))).opened).toHaveLength(1)
    })
  })
})

describe('when the live page does not hold the data (opened by clicking inside the app)', () => {
  const reel = (username: string, name: string) =>
    JSON.stringify({ reels_media: [{ id: '1', user: { username }, items: [{ ...logoutImage(name, 720, 1280) }] }] })
  const post = (code: string, name: string) => wrap({ code, ...logoutImage(name, 1440, 1440) })
  /** Another page's data, as left in the live page by whatever was loaded first. */
  const home = [json('{"feed":[1,2,3]}')]

  it('story: fetches the page again and opens Sift with that data in the window it opened first', async () => {
    const { opened, alerts, fetches, closed } = await run('/stories/someuser/', home, html(json(reel('someuser', 'fresh'))))
    expect(alerts).toEqual([])
    expect(fetches).toBe(1)
    expect(closed).toBe(0)
    const h = received(opened)
    expect(h.kind).toBe('story')
    expect(extractMedia(h.data)[0].thumbnail?.url).toBe(cdn('fresh'))
  })

  it('story: the live page holds another user\'s story, the fetched page holds the right one', async () => {
    const { opened, alerts, fetches } = await run(
      '/stories/someuser/',
      [json(reel('olduser', 'stale'))],
      html(json(reel('someuser', 'fresh'))),
    )
    expect(alerts).toEqual([])
    expect(fetches).toBe(1)
    expect(extractMedia(received(opened).data)[0].thumbnail?.url).toBe(cdn('fresh'))
  })

  it('story: still refuses when the fetched page holds another user\'s story too', async () => {
    const { opened, alerts, closed } = await run('/stories/someuser/', home, html(json(reel('olduser', 'x'))))
    expect(opened).toEqual([])
    expect(messages(alerts)).toEqual(['This page holds the story of another user. Reload the story page and try again.'])
    expect(closed).toBe(1)
  })

  it('story: alerts and closes the window when the fetched page has no story data either', async () => {
    const { opened, alerts, closed } = await run('/stories/someuser/', home, html(json('{"other":1}')))
    expect(opened).toEqual([])
    expect(messages(alerts)).toEqual(['Story data not found. Reload the story page and try again.'])
    expect(closed).toBe(1)
  })

  it('story: alerts and closes the window when the fetch fails', async () => {
    const { opened, alerts, closed } = await run('/stories/someuser/', home, new Error('offline'))
    expect(opened).toEqual([])
    expect(messages(alerts)).toEqual(['Story data not found. Reload the story page and try again.'])
    expect(closed).toBe(1)
  })

  it('story: the failure alert says what the page and the fetched page held', async () => {
    const { alerts } = await run('/stories/someuser/', home, html(json('{"other":1}'), json(reel('olduser', 'x'))))
    expect(alerts[0].split('\n').slice(2)).toEqual([
      '[page: json=1 stories=0 | fetched: 200 len=' + html(json('{"other":1}'), json(reel('olduser', 'x'))).length + ' json=2 stories=1 | story of olduser]',
    ])
  })

  it('story: the failure alert names a failed fetch', async () => {
    const { alerts } = await run('/stories/someuser/', home, new Error('offline'))
    expect(alerts[0].split('\n').slice(2)).toEqual(['[page: json=1 stories=0 | fetch failed: Error: offline]'])
  })

  it('story: asks for the page the way a normal page load does', async () => {
    expect((await run('/stories/someuser/', home, html(json(reel('someuser', 'x'))))).accept).toBe('text/html')
  })

  it('post: fetches the page again and finds the post by its code', async () => {
    const { opened, alerts, fetches } = await run('/p/Cnew/', [json(post('Cold', 'old'))], html(json(post('Cnew', 'fresh'))))
    expect(alerts).toEqual([])
    expect(fetches).toBe(1)
    expect(postSlides(opened)[0].thumbnail?.url).toBe(cdn('fresh'))
  })

  it('post: alerts when the fetched page does not hold the post', async () => {
    const { opened, alerts } = await run('/p/Cnew/', home, html(json(post('Cother', 'x'))))
    expect(opened).toEqual([])
    expect(messages(alerts)).toEqual(['Post data not found. Reload the post page and try again.'])
  })
})

describe('decodeHandoff', () => {
  const hash = (kind: string, s: string) => `#${kind}=${encodeURIComponent(btoa(s))}`
  it('decodes what the bookmarklet sends, with its kind', () => {
    expect(decodeHandoff(hash('post', '{"items":[]}'))).toEqual({ kind: 'post', data: '{"items":[]}' })
    expect(decodeHandoff(hash('story', '{"items":[]}'))).toEqual({ kind: 'story', data: '{"items":[]}' })
  })
  it('survives characters that need escaping in a URL', () => {
    const s = '{"u":"https://x.test/a?b=c&d=e+f/g=="}'
    expect(decodeHandoff(hash('post', s))?.data).toBe(s)
  })
  it.each(['', '#', '#other=abc', '#post=', '#story=', '#post=%%%', '#story=!!notbase64!!', '#poster=abc'])('returns null for %j', (h) => {
    expect(decodeHandoff(h)).toBeNull()
  })
})
