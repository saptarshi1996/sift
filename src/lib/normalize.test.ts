import { describe, expect, it } from 'vitest'
import { HOSTS, normalizePostUrl, normalizeStoryUrl } from './normalize.ts'

const HOST = HOSTS[0]
const OTHER = HOSTS[1]
const story = (user: string) => ({ url: `https://www.${HOST}/stories/${user}/` })
const error = (message: string) => ({ error: message })

describe('normalizeStoryUrl: usernames', () => {
  it('turns a plain username into a story link', () => {
    expect(normalizeStoryUrl('someuser')).toEqual(story('someuser'))
  })

  it('accepts a leading @ and surrounding whitespace', () => {
    expect(normalizeStoryUrl('@someuser')).toEqual(story('someuser'))
    expect(normalizeStoryUrl('  someuser  ')).toEqual(story('someuser'))
  })

  it('lowercases the username', () => {
    expect(normalizeStoryUrl('SomeUser')).toEqual(story('someuser'))
    expect(normalizeStoryUrl('@SomeUser')).toEqual(story('someuser'))
  })

  it('allows dots, underscores and digits', () => {
    expect(normalizeStoryUrl('some.user_1')).toEqual(story('some.user_1'))
  })

  it('allows exactly 30 characters but not 31', () => {
    expect(normalizeStoryUrl('a'.repeat(30))).toEqual(story('a'.repeat(30)))
    expect(normalizeStoryUrl('a'.repeat(31))).toEqual(error('That is not a valid username.'))
  })

  it('rejects characters a username cannot contain', () => {
    expect(normalizeStoryUrl('not valid name!')).toEqual(error('That is not a valid username.'))
    expect(normalizeStoryUrl('some-user')).toEqual(error('That is not a valid username.'))
  })

  it('asks for input when empty or only spaces', () => {
    expect(normalizeStoryUrl('')).toEqual(error('Enter a username or a link.'))
    expect(normalizeStoryUrl('   ')).toEqual(error('Enter a username or a link.'))
  })

  it('ignores a pasted view-source: prefix', () => {
    expect(normalizeStoryUrl(`view-source:https://www.${HOST}/someuser/`)).toEqual(story('someuser'))
    expect(normalizeStoryUrl('view-source:someuser')).toEqual(story('someuser'))
  })
})

describe('normalizeStoryUrl: profile links', () => {
  it.each([
    ['https with www and a trailing slash', `https://www.${HOST}/someuser/`],
    ['no trailing slash', `https://www.${HOST}/someuser`],
    ['http', `http://${HOST}/someuser/`],
    ['no scheme', `${HOST}/someuser`],
    ['no scheme with www', `www.${HOST}/someuser/`],
    ['mobile host', `https://m.${HOST}/someuser/`],
    ['tracking query', `https://www.${HOST}/someuser/?igsh=abc`],
    ['fragment', `https://www.${HOST}/someuser/#x`],
    ['extra path after the username', `https://www.${HOST}/someuser/reels/`],
    ['app deep link', `https://www.${HOST}/_u/someuser/`],
    ['mixed-case host', `https://WWW.${HOST.toUpperCase()}/someuser/`],
  ])('%s', (_label, input) => {
    expect(normalizeStoryUrl(input)).toEqual(story('someuser'))
  })

  it('lowercases the username taken from a link', () => {
    expect(normalizeStoryUrl(`https://www.${HOST}/SomeUser/`)).toEqual(story('someuser'))
  })
})

describe('normalizeStoryUrl: story links', () => {
  it('keeps a story link exactly as given', () => {
    const link = `https://www.${HOST}/stories/someuser/`
    expect(normalizeStoryUrl(link)).toEqual({ url: link })
  })

  it('keeps story ids and query strings', () => {
    const link = `https://www.${HOST}/stories/someuser/3401234/?igsh=1`
    expect(normalizeStoryUrl(link)).toEqual({ url: link })
  })

  it('keeps highlight links', () => {
    const link = `https://www.${HOST}/stories/highlights/17900/`
    expect(normalizeStoryUrl(link)).toEqual({ url: link })
  })

  it('adds a scheme when a story link has none', () => {
    expect(normalizeStoryUrl(`${HOST}/stories/someuser/`)).toEqual({
      url: `https://${HOST}/stories/someuser/`,
    })
  })

  it('rejects a story link with no username', () => {
    expect(normalizeStoryUrl(`https://www.${HOST}/stories/`)).toEqual(
      error('That story link has no username in it.'),
    )
  })
})

describe('normalizeStoryUrl: links that are not profiles', () => {
  it.each(['p/Cabc123', 'reel/Cabc123', 'explore', 'accounts/login', 'direct/inbox', 'tv/abc'])(
    'rejects /%s',
    (path) => {
      expect(normalizeStoryUrl(`https://www.${HOST}/${path}/`)).toEqual(
        error('That link is not a profile. Paste a username or a profile link.'),
      )
    },
  )

  it('rejects the bare home page', () => {
    expect(normalizeStoryUrl(`https://www.${HOST}/`)).toEqual(error('No username found in that link.'))
    expect(normalizeStoryUrl(HOST)).toEqual(error('No username found in that link.'))
  })

  it('rejects a username that is not valid inside the link', () => {
    expect(normalizeStoryUrl(`https://www.${HOST}/some-user/`)).toEqual(
      error('That link is not a profile. Paste a username or a profile link.'),
    )
  })
})

describe('normalizeStoryUrl: other hosts', () => {
  const unsupported = error('That is not a supported link.')

  it('rejects unrelated sites', () => {
    expect(normalizeStoryUrl('https://example.com/someuser')).toEqual(unsupported)
  })

  it('rejects look-alike hosts', () => {
    expect(normalizeStoryUrl(`https://${HOST}.evil.com/someuser`)).toEqual(unsupported)
    expect(normalizeStoryUrl(`https://evil.com/${HOST}/someuser`)).toEqual(unsupported)
    expect(normalizeStoryUrl(`https://notwww${HOST}/someuser`)).toEqual(unsupported)
  })

  it('rejects non-web schemes', () => {
    expect(normalizeStoryUrl(`ftp://www.${HOST}/someuser`)).toEqual(unsupported)
  })

  it('recognises the short domain as a link but does not accept it', () => {
    expect(normalizeStoryUrl(OTHER)).toEqual(unsupported)
    expect(normalizeStoryUrl(`${OTHER}/someuser`)).toEqual(unsupported)
  })

  it('reports a malformed link', () => {
    expect(normalizeStoryUrl('https://')).toEqual(error('That does not look like a valid link.'))
  })
})

describe('normalizePostUrl', () => {
  const post = (path: string) => ({ url: `https://www.${HOST}/${path}/` })
  it.each([
    ['post', `https://www.${HOST}/p/Cabc_1-x/`, 'p/Cabc_1-x'],
    ['post under a username', `https://www.${HOST}/someuser/p/Cabc123/`, 'someuser/p/Cabc123'],
    ['reel', `https://www.${HOST}/reel/Cabc123/`, 'reel/Cabc123'],
    ['reel under a username', `https://www.${HOST}/someuser/reel/Cabc123/`, 'someuser/reel/Cabc123'],
    ['tv', `https://www.${HOST}/tv/Cabc123/`, 'tv/Cabc123'],
    ['no trailing slash', `https://www.${HOST}/p/Cabc123`, 'p/Cabc123'],
    ['no scheme', `${HOST}/p/Cabc123/`, 'p/Cabc123'],
    ['mobile host', `https://m.${HOST}/p/Cabc123/`, 'p/Cabc123'],
    ['tracking query and fragment', `https://www.${HOST}/p/Cabc123/?igsh=abc#x`, 'p/Cabc123'],
    ['view-source prefix', `view-source:https://www.${HOST}/p/Cabc123/`, 'p/Cabc123'],
    ['surrounding whitespace', `  https://www.${HOST}/p/Cabc123/  `, 'p/Cabc123'],
  ])('%s', (_label, input, path) => {
    expect(normalizePostUrl(input)).toEqual(post(path))
  })

  it('keeps the case of the post code', () => {
    expect(normalizePostUrl(`https://www.${HOST}/p/AbC/`)).toEqual(post('p/AbC'))
  })

  it('asks for input when empty', () => {
    expect(normalizePostUrl('   ')).toEqual(error('Enter a post link.'))
  })

  it.each([`https://www.${HOST}/someuser/`, `https://www.${HOST}/stories/someuser/`, `https://www.${HOST}/`])(
    'rejects %s as not a post link',
    (input) => {
      expect(normalizePostUrl(input)).toEqual(error('That is not a post link. Paste a link to a post or reel.'))
    },
  )

  it('rejects a bare username', () => {
    expect(normalizePostUrl('someuser')).toEqual(error('That is not a supported link.'))
  })

  it('rejects a post link with no code', () => {
    expect(normalizePostUrl(`https://www.${HOST}/p/`)).toEqual(error('That post link has no post code in it.'))
  })

  it('rejects other hosts and schemes', () => {
    expect(normalizePostUrl('https://example.test/p/Cabc123/')).toEqual(error('That is not a supported link.'))
    expect(normalizePostUrl(`ftp://www.${HOST}/p/Cabc123/`)).toEqual(error('That is not a supported link.'))
  })
})
