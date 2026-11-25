import { useRef, useState } from 'react'
import { useCopy } from '../hooks/useCopy.ts'
import type { Kind, Slide } from '../types.ts'
import { CopyIcon, DoneIcon, OpenIcon } from './Icons.tsx'

function TileActions({ url }: { url: string }) {
  const { state, copy } = useCopy()
  const tip = state === 'done' ? 'Copied' : state === 'fail' ? "Couldn't copy" : 'Copy link'
  return (
    <div className="tile-actions">
      <button
        type="button"
        className={`tile-btn${state === 'idle' ? '' : ` ${state}`}`}
        data-tip={tip}
        aria-label="Copy link"
        onClick={() => void copy(url)}
      >
        {state === 'done' ? <DoneIcon className="i-done" /> : <CopyIcon />}
      </button>
      <a
        className="tile-btn"
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        data-tip="Open in new tab"
        aria-label="Open in new tab"
      >
        <OpenIcon />
      </a>
    </div>
  )
}

/** One picture-frame tile: the video (with a play button) or the image, with copy/open actions. */
export default function SlideMedia({ slide, kind }: { slide: Slide; kind: Kind }) {
  const item = slide[kind]
  const videoRef = useRef<HTMLVideoElement>(null)
  const [controls, setControls] = useState(false)
  const [failed, setFailed] = useState(false)

  if (!item) {
    return (
      <div className="tile empty">
        {kind === 'video' ? 'No video in this slide' : 'No picture for this slide'}
      </div>
    )
  }

  const isVideo = kind === 'video' && slide.video
  const dims = slide.thumbnail?.width && slide.thumbnail.height ? ` · ${slide.thumbnail.width}×${slide.thumbnail.height}` : ''
  const chip = isVideo
    ? slide.video?.res
      ? `Video · ${slide.video.res}p`
      : 'Video'
    : `${slide.video ? 'Thumbnail' : 'Image'}${dims}`

  const play = () => {
    setControls(true)
    void videoRef.current?.play().catch(() => {})
  }

  return (
    <div className="tile">
      {isVideo ? (
        failed ? (
          <div className="msg">This browser can't play this video here. Use the open icon at the top right.</div>
        ) : (
          <video
            ref={videoRef}
            src={item.url}
            preload="metadata"
            playsInline
            controls={controls}
            onError={() => setFailed(true)}
          />
        )
      ) : (
        <img
          src={item.url}
          alt={`Slide ${slide.item} ${slide.video ? 'thumbnail' : 'image'}`}
          referrerPolicy="no-referrer"
        />
      )}
      <div className={`chip ${isVideo ? 'video' : 'image'}`}>{chip}</div>
      {isVideo && !failed && !controls && (
        <button type="button" className="play" aria-label="Play video" onClick={play} />
      )}
      <TileActions url={item.url} />
    </div>
  )
}
