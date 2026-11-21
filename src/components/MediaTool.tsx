import { useRef, useState } from 'react'
import { buildBookmarklet } from '../lib/snippet.ts'
import type { Tool } from '../tools.ts'
import { ClearableInput, ClearableTextArea } from './ClearableFields.tsx'
import ResultsPanel from './ResultsPanel.tsx'
import SegToggle from './SegToggle.tsx'
import { useCopy } from '../hooks/useCopy.ts'
import type { Kind, Slide } from '../types.ts'

/** One tool page: page header, the three input panels and the results. */
export default function MediaTool({ tool, initialData }: { tool: Tool; initialData?: string }) {
  const steps = tool.steps
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
  const [slides, setSlides] = useState<Slide[] | null>(() => (initialData ? tool.extract(initialData) : null))
  /** The global "Show all as" choice; slides without that view fall back to the other one. */
  const [viewPref, setViewPref] = useState<Kind>('video')
  /** Per-slide choices that differ from the global one. */
  const [overrides, setOverrides] = useState<Record<number, Kind>>({})

  const kindOf = (s: Slide): Kind =>
    overrides[s.item] ?? (s[viewPref] ? viewPref : s.video ? 'video' : 'thumbnail')

  const generate = () => {
    if (!steps) return
    const r = steps.normalize(storyInput)
    if ('error' in r) {
      setUrlErr(r.error)
      setSourceLink('')
      storyRef.current?.focus()
      return
    }
    setUrlErr(null)
    setLinkErr(null)
    setSourceLink(steps.source(r.url))
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
    setSlides(tool.extract(source))
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
    <>
      <div className="page-head">
        <h1>{tool.title}</h1>
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
                title: allImages ? `No videos in this ${tool.noun}` : undefined,
              },
              { kind: 'thumbnail', label: allImages ? 'Image' : 'Thumbnail', pressed: pressed('thumbnail') },
            ]}
          />
        </div>
      </div>

      {steps ? (
        <>
          <section className="panel">
            <p className="step">{steps.instruction}</p>
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
              placeholder={steps.placeholder}
              ariaLabel={steps.placeholder}
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
            <p className="step">{steps.sourceStep}</p>
            <ClearableInput
              ref={sourceLinkRef}
              value={sourceLink}
              readOnly
              mono
              placeholder={steps.sourcePlaceholder}
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
            <p className="step">{steps.pasteStep}</p>
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
              placeholder={steps.pastePlaceholder}
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
        </>
      ) : (
        <section className="panel">
          <p className="step">{tool.bookmark?.instruction}</p>
          <a
            className="bookmark"
            draggable
            title="Drag me to the bookmarks bar"
            onClick={(e) => e.preventDefault()}
            ref={(el) => el?.setAttribute('href', buildBookmarklet(window.location.origin + window.location.pathname))}
          >
            Sift post
          </a>
        </section>
      )}

      {slides && (
        <ResultsPanel
          slides={slides}
          kindOf={kindOf}
          onSlideKind={(item, k) => setOverrides((o) => ({ ...o, [item]: k }))}
        />
      )}
    </>
  )
}
