import type { ComponentType } from 'react'
import { GlobeIcon, PostsIcon, StoriesIcon } from './components/Icons.tsx'
import { extractMedia, extractPost } from './lib/extract.ts'
import { normalizePostUrl, normalizeStoryUrl, type NormalizeResult } from './lib/normalize.ts'
import type { Slide } from './types.ts'

/** Three panels: link in, source link out, source pasted back. */
/** The site's base path, ending with a slash ('/' locally, '/sift/' on Pages). */
export const BASE = import.meta.env.BASE_URL

export interface Steps {
  instruction: string
  placeholder: string
  normalize: (raw: string) => NormalizeResult
  /** What the middle panel shows and Copy copies, given the normalized link. */
  source: (url: string) => string
  sourceStep: string
  sourcePlaceholder: string
  pasteStep: string
  pastePlaceholder: string
}

export interface Tool {
  id: string
  /** Sidebar label, breadcrumb and page title. */
  title: string
  Icon: ComponentType<{ className?: string }>
  /** Used in "No videos in this ___". */
  noun: string
  extract: (data: string) => Slide[]
  /** The three-panel flow. */
  steps?: Steps
  /** Instead of the panels: a bookmark button that sends the data here (see lib/snippet.ts). */
  bookmark?: { instruction: string }
}

const viewSource = {
  source: (url: string) => 'view-source:' + url,
  sourceStep: 'Copy the URL below, open it in a new tab, then copy the entire page source',
  sourcePlaceholder: 'Generated view-source link appears here',
  pasteStep: 'Paste the copied HTML source code below and click "Extract"',
  pastePlaceholder: 'Paste the copied source here',
}

export const TOOLS: Tool[] = [
  {
    id: 'stories',
    title: 'Stories',
    Icon: StoriesIcon,
    noun: 'story',
    extract: extractMedia,
    steps: {
      instruction: 'Type a username, or paste a profile link or a story link. Then click Generate.',
      placeholder: 'Username, profile link or story link',
      normalize: normalizeStoryUrl,
      ...viewSource,
    },
  },
  {
    id: 'posts',
    title: 'Posts',
    Icon: PostsIcon,
    noun: 'post',
    extract: extractPost,
    steps: {
      instruction: 'Paste a post or reel link. Then click Generate.',
      placeholder: 'Post or reel link',
      normalize: normalizePostUrl,
      ...viewSource,
    },
  },
  {
    id: 'sift-posts',
    title: 'Sift posts',
    Icon: GlobeIcon,
    noun: 'post',
    extract: extractPost,
    bookmark: { instruction: 'Drag this button to your bookmarks bar. Then open a post and click Sift It from the bar.' },
  },
]
