import { describe, expect, it } from 'vitest'
import { pathForTool, toolIdFromPath } from './route.ts'

const IDS = ['stories', 'posts', 'sift-posts']

describe('pathForTool', () => {
  it('appends the id to the base', () => {
    expect(pathForTool('posts', '/')).toBe('/posts')
    expect(pathForTool('sift-posts', '/sift/')).toBe('/sift/sift-posts')
  })
})

describe('toolIdFromPath', () => {
  it.each([
    ['/', '/stories', 'stories'],
    ['/', '/posts', 'posts'],
    ['/sift/', '/sift/sift-posts', 'sift-posts'],
    ['/sift/', '/sift/posts/', 'posts'],
    ['/sift/', '/sift/posts/extra', 'posts'],
  ])('base %s, path %s -> %s', (base, path, id) => {
    expect(toolIdFromPath(path, base, IDS)).toBe(id)
  })

  it.each([
    ['/', '/'],
    ['/', '/unknown'],
    ['/', '/Posts'],
    ['/sift/', '/sift/'],
    ['/sift/', '/sift'],
    ['/sift/', '/other/posts'],
    ['/sift/', '/posts'],
  ])('base %s, path %s -> null', (base, path) => {
    expect(toolIdFromPath(path, base, IDS)).toBeNull()
  })

  it('round-trips with pathForTool', () => {
    for (const base of ['/', '/sift/']) for (const id of IDS) expect(toolIdFromPath(pathForTool(id, base), base, IDS)).toBe(id)
  })
})
