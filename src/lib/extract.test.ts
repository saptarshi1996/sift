import { describe, expect, it } from 'vitest'
import { extractAny, extractArray, extractMedia, extractPost, resolution } from './extract.ts'

// ---- fixtures (made-up hosts and data; no real pages) ----
const efg = (tag: string) => encodeURIComponent(btoa(JSON.stringify({ vencode_tag: tag })))
const video = (name: string, res?: number) =>
  res
    ? `https://cdn.example.test/v/${name}.mp4?efg=${efg(`xpv_progressive.STORY.C3.${res}.dash_baseline_1_v1`)}&oe=1`
    : `https://cdn.example.test/v/${name}.mp4?oe=1`
const image = (name: string) => `https://cdn.example.test/i/${name}.jpg`
const candidates = (...sizes: [name: string, w: number, h: number][]) => ({
  candidates: sizes.map(([name, width, height]) => ({ url: image(name), width, height })),
})
/** A page whose embedded JSON holds a story with the given slides. */
const page = (items: unknown[]) =>
  `<html><script type="application/json">{"data":{"items":${JSON.stringify(items)},"other":1}}</script></html>`

describe('extractArray', () => {
  it('returns the array that follows the key', () => {
    expect(extractArray('noise "k":[1,2,3] more', '"k":[')).toEqual([1, 2, 3])
  })

  it('handles nested arrays and objects', () => {
    expect(extractArray('"k":[[1,2],{"a":[3]}]', '"k":[')).toEqual([[1, 2], { a: [3] }])
  })

  it('is not fooled by brackets and escaped quotes inside strings', () => {
    expect(extractArray('"k":["a]b","c\\"]d"] tail', '"k":[')).toEqual(['a]b', 'c"]d'])
  })

  it('stops at the matching bracket, not the first one it sees', () => {
    expect(extractArray('"k":[[1],[2]] "z":[9]', '"k":[')).toEqual([[1], [2]])
  })

  it('returns an empty array when the key is missing', () => {
    expect(extractArray('<html>nothing</html>', '"k":[')).toEqual([])
  })

  it('returns an empty array for broken or unterminated JSON', () => {
    expect(extractArray('"k":[1,2,}', '"k":[')).toEqual([])
    expect(extractArray('"k":[1,2', '"k":[')).toEqual([])
  })
})

describe('resolution', () => {
  it('reads the resolution from the encode tag', () => {
    expect(resolution(video('a', 720))).toBe(720)
    expect(resolution(video('a', 1080))).toBe(1080)
  })

  it('reads it from tags that end differently', () => {
    const url = `https://cdn.example.test/a.mp4?efg=${efg('xpv_progressive.STORY.C3.1080.compressed_source')}`
    expect(resolution(url)).toBe(1080)
  })

  it('returns 0 when there is nothing usable', () => {
    expect(resolution(video('a'))).toBe(0) // no efg parameter
    expect(resolution(`https://cdn.example.test/a.mp4?efg=${encodeURIComponent(btoa('not json'))}`)).toBe(0)
    expect(resolution(`https://cdn.example.test/a.mp4?efg=${efg('no_resolution_here')}`)).toBe(0)
    expect(resolution('%%% not a url')).toBe(0)
  })
})

describe('extractMedia: videos', () => {
  it('returns a video slide with its best video and largest picture', () => {
    const slides = extractMedia(
      page([{ video_versions: [{ url: video('a', 720) }], image_versions2: candidates(['c', 640, 1136]) }]),
    )
    expect(slides).toEqual([
      {
        item: 1,
        type: 'video',
        video: { url: video('a', 720), res: 720 },
        thumbnail: { url: image('c'), width: 640, height: 1136 },
      },
    ])
  })

  it('collapses duplicate entries (same file, different signing) to one', () => {
    const dup = [{ url: video('a', 720) }, { url: video('a', 720) + '&x=2' }, { url: video('a', 720) + '&x=3' }]
    const [slide] = extractMedia(page([{ video_versions: dup }]))
    expect(slide.video?.url).toBe(video('a', 720))
  })

  it('picks the highest resolution whatever the order', () => {
    const low = { url: video('low', 720) }
    const high = { url: video('high', 1080) }
    expect(extractMedia(page([{ video_versions: [low, high] }]))[0].video?.res).toBe(1080)
    expect(extractMedia(page([{ video_versions: [high, low] }]))[0].video?.res).toBe(1080)
  })

  it('keeps page order when resolutions tie', () => {
    const first = { url: video('first', 720) }
    const second = { url: video('second', 720) }
    expect(extractMedia(page([{ video_versions: [first, second] }]))[0].video?.url).toBe(first.url)
  })

  it('skips video entries that have no url', () => {
    const [slide] = extractMedia(page([{ video_versions: [{ type: 101 }, { url: video('ok', 720) }] }]))
    expect(slide.video?.url).toBe(video('ok', 720))
  })

  it('still reads urls whose slashes are escaped in the page', () => {
    const raw = '{"items":[{"video_versions":[{"url":"https:\\/\\/cdn.example.test\\/a.mp4"}]}]}'
    expect(extractMedia(raw)[0].video?.url).toBe('https://cdn.example.test/a.mp4')
  })
})

describe('extractMedia: pictures', () => {
  it('picks the picture with the largest area, not the first or the tallest', () => {
    const [slide] = extractMedia(
      page([
        {
          video_versions: [{ url: video('a', 720) }],
          image_versions2: candidates(['small', 240, 426], ['square', 640, 640], ['big', 640, 1136], ['wide', 1000, 300]),
        },
      ]),
    )
    expect(slide.thumbnail).toEqual({ url: image('big'), width: 640, height: 1136 })
  })

  it('ignores candidates without a url', () => {
    const [slide] = extractMedia(
      page([{ image_versions2: { candidates: [{ width: 9999, height: 9999 }, { url: image('ok'), width: 10, height: 10 }] } }]),
    )
    expect(slide.thumbnail?.url).toBe(image('ok'))
  })

  it('uses the slide\'s own picture, not unrelated images nested elsewhere in the slide', () => {
    const [slide] = extractMedia(
      page([
        {
          image_versions2: candidates(['own', 640, 1136]),
          stickers: [{ image_versions2: candidates(['sticker', 5000, 5000]) }],
        },
      ]),
    )
    expect(slide.thumbnail?.url).toBe(image('own'))
  })
})

describe('extractMedia: image slides and mixed stories', () => {
  it('marks a slide with no video as an image', () => {
    const [slide] = extractMedia(page([{ image_versions2: candidates(['pic', 640, 1136]) }]))
    expect(slide.type).toBe('image')
    expect(slide.video).toBeNull()
    expect(slide.thumbnail?.url).toBe(image('pic'))
  })

  it('treats an empty video list as no video', () => {
    const [slide] = extractMedia(page([{ video_versions: [], image_versions2: candidates(['pic', 640, 1136]) }]))
    expect(slide.type).toBe('image')
  })

  it('returns one entry per slide, in order, with the right types', () => {
    const slides = extractMedia(
      page([
        { video_versions: [{ url: video('a', 720) }], image_versions2: candidates(['a', 640, 1136]) },
        { image_versions2: candidates(['b', 640, 1136]) },
        { video_versions: [{ url: video('c', 1080) }], image_versions2: candidates(['c', 640, 1136]) },
      ]),
    )
    expect(slides.map((s) => [s.item, s.type])).toEqual([[1, 'video'], [2, 'image'], [3, 'video']])
  })

  it('drops a slide with neither video nor picture but keeps the others\' numbers', () => {
    const slides = extractMedia(
      page([
        { image_versions2: candidates(['a', 10, 10]) },
        { note: 'nothing usable' },
        { image_versions2: candidates(['c', 10, 10]) },
      ]),
    )
    expect(slides.map((s) => s.item)).toEqual([1, 3])
  })
})

describe('extractMedia: pages without an items array', () => {
  it('falls back to the first video list and picture list on the page', () => {
    const html = `<script>{"video_versions":[{"url":"${video('a', 720)}"}],"image_versions2":{"candidates":[{"url":"${image('c')}","width":640,"height":1136}]}}</script>`
    const slides = extractMedia(html)
    expect(slides).toHaveLength(1)
    expect(slides[0].video?.url).toBe(video('a', 720))
    expect(slides[0].thumbnail?.url).toBe(image('c'))
  })

  it('returns nothing when the page has no media at all', () => {
    expect(extractMedia('<html>nothing here</html>')).toEqual([])
    expect(extractMedia('')).toEqual([])
  })
})

describe('extractPost', () => {
  const child = (name: string, vid?: string) => ({
    ...(vid ? { video_versions: [{ url: video(vid, 720) }] } : {}),
    image_versions2: candidates([`${name}-small`, 320, 427], [name, 1080, 1440], [`${name}-square`, 1080, 1080]),
  })

  it('returns one slide per carousel item, not just the cover', () => {
    const slides = extractPost(
      page([{ image_versions2: candidates(['cover', 1080, 1440]), carousel_media: [child('a'), child('b', 'vb'), child('c')] }]),
    )
    expect(slides.map((s) => [s.item, s.type])).toEqual([[1, 'image'], [2, 'video'], [3, 'image']])
    expect(slides.map((s) => s.thumbnail?.url)).toEqual([image('a'), image('b'), image('c')])
    expect(slides[1].video?.url).toBe(video('vb', 720))
  })

  it('treats null or empty carousel_media as a single post', () => {
    for (const carousel_media of [null, []]) {
      const slides = extractPost(page([{ image_versions2: candidates(['only', 640, 800]), carousel_media }]))
      expect(slides).toHaveLength(1)
      expect(slides[0].thumbnail?.url).toBe(image('only'))
    }
  })

  it('reads a single-video post (reel)', () => {
    const [slide] = extractPost(page([{ video_versions: [{ url: video('r', 1080) }], image_versions2: candidates(['rc', 720, 1280]) }]))
    expect(slide).toMatchObject({ item: 1, type: 'video', video: { res: 1080 } })
  })

  it('uses only the first entry, ignoring related posts later on the page', () => {
    const slides = extractPost(page([{ carousel_media: [child('a')] }, { carousel_media: [child('x'), child('y')] }]))
    expect(slides).toHaveLength(1)
  })

  it('returns nothing when the page has no items', () => {
    expect(extractPost('<html></html>')).toEqual([])
    expect(extractPost(page([]))).toEqual([])
  })

  it('numbers items from 1 and drops empty ones but keeps the others\' numbers', () => {
    const slides = extractPost(page([{ carousel_media: [child('a'), {}, child('c')] }]))
    expect(slides.map((s) => s.item)).toEqual([1, 3])
  })
})

describe('extractAny', () => {
  const pic = (name: string) => ({ image_versions2: candidates([name, 640, 800]) })

  it('reads a post: every carousel item, not just the first entry', () => {
    const slides = extractAny(page([{ carousel_media: [pic('a'), pic('b'), pic('c')] }]))
    expect(slides.map((s) => s.thumbnail?.url)).toEqual([image('a'), image('b'), image('c')])
  })

  it('reads a story: every entry of items, including more than one', () => {
    const slides = extractAny(page([{ video_versions: [{ url: video('v', 720) }], ...pic('a') }, pic('b'), pic('c')]))
    expect(slides.map((s) => s.type)).toEqual(['video', 'image', 'image'])
    expect(slides.map((s) => s.item)).toEqual([1, 2, 3])
  })

  it('reads a single post or reel (no carousel) as one slide', () => {
    const slides = extractAny(page([{ video_versions: [{ url: video('r', 1080) }], ...pic('cover') }]))
    expect(slides).toHaveLength(1)
    expect(slides[0]).toMatchObject({ type: 'video', video: { res: 1080 } })
  })

  it('treats null or empty carousel_media as a story-shaped entry', () => {
    for (const carousel_media of [null, []]) {
      expect(extractAny(page([{ carousel_media, ...pic('only') }, pic('two')]))).toHaveLength(2)
    }
  })

  it('returns nothing when there is nothing to read', () => {
    expect(extractAny('')).toEqual([])
    expect(extractAny(page([]))).toEqual([])
  })
})
