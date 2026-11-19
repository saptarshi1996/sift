import type { Kind, Slide } from '../types.ts'
import SlideCard from './SlideCard.tsx'

interface Props {
  slides: Slide[]
  kindOf: (slide: Slide) => Kind
  onSlideKind: (item: number, kind: Kind) => void
}

export default function ResultsPanel({ slides, kindOf, onSlideKind }: Props) {
  const found = slides.length > 0
  return (
    <section className="panel flush">
      {found && (
        <div className="panel-head">
          <h2>Results</h2>
          <span className="pill">
            {slides.length} {slides.length === 1 ? 'slide' : 'slides'}
          </span>
        </div>
      )}
      <div className="panel-body">
        {found ? (
          <>
            <p className="step">
              If a video doesn't play here, use the open icon at the top right of it to watch it in a new tab.
            </p>
            <div className="slides">
              {slides.map((s) => (
                <SlideCard
                  key={s.item}
                  slide={s}
                  total={slides.length}
                  kind={kindOf(s)}
                  onKind={(k) => onSlideKind(s.item, k)}
                />
              ))}
            </div>
          </>
        ) : (
          <p className="notfound">Not found. The pasted source has no video or thumbnail.</p>
        )}
      </div>
    </section>
  )
}
