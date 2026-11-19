import type { Kind, Slide } from '../types.ts'
import SegToggle from './SegToggle.tsx'
import SlideMedia from './SlideMedia.tsx'

interface Props {
  slide: Slide
  total: number
  kind: Kind
  onKind: (kind: Kind) => void
}

/** One slide: title, its own Video | Thumbnail/Image switcher, and the picked picture. */
export default function SlideCard({ slide, total, kind, onKind }: Props) {
  return (
    <div className="slide">
      <div className="slide-head">
        <div className="slide-title">
          Slide {slide.item}
          <span>of {total}</span>
        </div>
        <SegToggle
          ariaLabel={`Slide ${slide.item} media`}
          onPick={onKind}
          items={[
            {
              kind: 'video',
              label: 'Video',
              pressed: kind === 'video',
              disabled: !slide.video,
              title: slide.video ? undefined : 'Not available for this slide',
            },
            {
              kind: 'thumbnail',
              label: slide.video ? 'Thumbnail' : 'Image',
              pressed: kind === 'thumbnail',
              disabled: !slide.thumbnail,
              title: slide.thumbnail ? undefined : 'Not available for this slide',
            },
          ]}
        />
      </div>
      {/* keyed so switching Video/Thumbnail starts a fresh player (and stops the old video) */}
      <SlideMedia key={kind} slide={slide} kind={kind} />
    </div>
  )
}
