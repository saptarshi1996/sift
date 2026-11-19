import { useRef, useState } from 'react'
import { ClearableInput, ClearableTextArea } from './components/ClearableFields.tsx'
import ResultsPanel from './components/ResultsPanel.tsx'
import SegToggle from './components/SegToggle.tsx'
import Sidebar from './components/Sidebar.tsx'
import TopBar from './components/TopBar.tsx'
import { useCopy } from './hooks/useCopy.ts'
import { extractMedia } from './lib/extract.ts'
import { normalizeStoryUrl } from './lib/normalize.ts'
import type { Kind, Slide } from './types.ts'

function App() {
  // ---- shell ----
  const [collapsed, setCollapsed] = useState(() => window.matchMedia('(max-width: 800px)').matches)
  const [query, setQuery] = useState('')

  // ---- the three panels ----
  const [storyInput, setStoryInput] = useState('')
  const [urlErr, setUrlErr] = useState<string | null>(null)
  const [sourceLink, setSourceLink] = useState('')
  const [linkErr, setLinkErr] = useState<string | null>(null)
  const [source, setSource] = useState('')
  const [srcErr, setSrcErr] = useState<string | null>(null)

  const storyRef = useRef<HTMLInputElement>(null)
  const sourceLinkRef = useRef<HTMLInputElement>(null)
  const sourceRef = useRef<HTMLTextAreaElement>(null)
  const linkCopy = useCopy()

  // ---- results ----
  const [slides, setSlides] = useState<Slide[] | null>(null)
  /** The global "Show all as" choice; slides without that view fall back to the other one. */
  const [viewPref, setViewPref] = useState<Kind>('video')
  /** Per-slide choices that differ from the global one. */
  const [overrides, setOverrides] = useState<Record<number, Kind>>({})

  const kindOf = (s: Slide): Kind =>
    overrides[s.item] ?? (s[viewPref] ? viewPref : s.video ? 'video' : 'thumbnail')

  const generate = () => {
    const r = normalizeStoryUrl(storyInput)
    if ('error' in r) {
      setUrlErr(r.error)
      setSourceLink('')
      storyRef.current?.focus()
      return
    }
    setUrlErr(null)
    setLinkErr(null)
    setSourceLink('view-source:' + r.url)
  }

  const copyLink = () => {
    if (!sourceLink.trim()) {
      setLinkErr('Nothing to copy yet. Generate a link first.')
      sourceLinkRef.current?.focus()
      return
    }
    setLinkErr(null)
    void linkCopy.copy(sourceLink)
  }

  const extract = () => {
    if (!source.trim()) {
      setSrcErr('Paste the page source first.')
      setSlides(null)
      sourceRef.current?.focus()
      return
    }
    setSrcErr(null)
    setSlides(extractMedia(source))
    setOverrides({})
  }

  // ---- global switcher state, derived from the slides ----
  const list = slides ?? []
  const allImages = list.length > 0 && list.every((s) => !s.video)
  const pressed = (k: Kind) => {
    const have = list.filter((s) => s[k])
    if (have.length) return have.every((s) => kindOf(s) === k)
    return list.length ? false : viewPref === k
  }

  return (
    <div className={`app${collapsed ? ' collapsed' : ''}`}>
      <Sidebar query={query} />

      <div className="main">
        <TopBar onToggleSidebar={() => setCollapsed((c) => !c)} query={query} onQuery={setQuery} />

        <main className="content">
          <div className="page-head">
            <h1>Stories</h1>
            <div className="seg-wrap">
              <span>Show all as</span>
              <SegToggle
                ariaLabel="Show all slides as"
                onPick={(k) => {
                  setViewPref(k)
                  setOverrides({})
                }}
                items={[
                  {
                    kind: 'video',
                    label: 'Video',
                    pressed: pressed('video'),
                    disabled: allImages,
                    title: allImages ? 'No videos in this story' : undefined,
                  },
                  { kind: 'thumbnail', label: allImages ? 'Image' : 'Thumbnail', pressed: pressed('thumbnail') },
                ]}
              />
            </div>
          </div>

          <section className="panel">
            <p className="step">Type a username, or paste a profile link or a story link. Then click Generate.</p>
            <ClearableInput
              ref={storyRef}
              value={storyInput}
              onChange={setStoryInput}
              onClear={() => {
                setStoryInput('')
                setUrlErr(null)
                storyRef.current?.focus()
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') generate()
              }}
              placeholder="Username, profile link or story link"
              ariaLabel="Username or story link"
            />
            {urlErr && (
              <p className="hint err" role="alert">
                {urlErr}
              </p>
            )}
            <button type="button" onClick={generate}>
              Generate
            </button>
          </section>

          <section className="panel">
            <p className="step">Copy the URL below, open it in a new tab, then copy the entire page source</p>
            <ClearableInput
              ref={sourceLinkRef}
              value={sourceLink}
              readOnly
              mono
              placeholder="Generated view-source link appears here"
              ariaLabel="Source link"
            />
            {linkErr && (
              <p className="hint err" role="alert">
                {linkErr}
              </p>
            )}
            <button type="button" onClick={copyLink}>
              {linkCopy.state === 'done' ? 'Copied' : linkCopy.state === 'fail' ? 'Copy failed' : 'Copy'}
            </button>
          </section>

          <section className="panel">
            <p className="step">Paste the copied HTML source code below and click "Extract"</p>
            <ClearableTextArea
              ref={sourceRef}
              value={source}
              onChange={(v) => {
                setSource(v)
                setSrcErr(null)
              }}
              onClear={() => {
                setSource('')
                setSrcErr(null)
                sourceRef.current?.focus()
              }}
              placeholder="Paste the copied source here"
              ariaLabel="Page source"
            />
            {srcErr && (
              <p className="hint err" role="alert">
                {srcErr}
              </p>
            )}
            <button type="button" onClick={extract}>
              Extract
            </button>
          </section>

          {slides && (
            <ResultsPanel
              slides={slides}
              kindOf={kindOf}
              onSlideKind={(item, k) => setOverrides((o) => ({ ...o, [item]: k }))}
            />
          )}
        </main>
      </div>
    </div>
  )
}

export default App
