import type { Kind } from '../types.ts'

export interface SegItem {
  kind: Kind
  label: string
  pressed: boolean
  disabled?: boolean
  title?: string
}

interface Props {
  items: SegItem[]
  onPick: (kind: Kind) => void
  ariaLabel: string
}

/** Small two-button switcher (Video | Thumbnail/Image). Each button carries its own pressed state. */
export default function SegToggle({ items, onPick, ariaLabel }: Props) {
  return (
    <div className="seg" role="group" aria-label={ariaLabel}>
      {items.map((it) => (
        <button
          key={it.kind}
          type="button"
          aria-pressed={it.pressed}
          disabled={it.disabled}
          title={it.title}
          onClick={() => onPick(it.kind)}
        >
          {it.label}
        </button>
      ))}
    </div>
  )
}
