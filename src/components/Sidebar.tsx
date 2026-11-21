import { pathForTool } from '../lib/route.ts'
import { BASE, TOOLS } from '../tools.ts'
import { FunnelIcon, LayersIcon } from './Icons.tsx'

interface Props {
  query: string
  active: string
  onSelect: (id: string) => void
}

/** Left navigation. Collapses to an icon strip (CSS, via the `collapsed` class on .app). */
export default function Sidebar({ query, active, onSelect }: Props) {
  const q = query.trim().toLowerCase()
  const shown = TOOLS.filter((t) => !q || t.title.toLowerCase().includes(q))

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-icon">
          <FunnelIcon />
        </div>
        <span className="lbl">Sift</span>
      </div>
      <nav>
        {shown.length > 0 && (
          <div className="nav-group">
            <LayersIcon />
            <span className="lbl">Media</span>
          </div>
        )}
        {shown.map(({ id, title, Icon }) => (
          <a
            key={id}
            className={`nav-item${id === active ? ' active' : ''}`}
            href={pathForTool(id, BASE)}
            aria-current={id === active ? 'page' : undefined}
            title={title}
            onClick={(e) => {
              // Let modified clicks (new tab, new window) use the real link.
              if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return
              e.preventDefault()
              onSelect(id)
            }}
          >
            <Icon />
            <span className="lbl">{title}</span>
          </a>
        ))}
        {shown.length === 0 && <p className="nav-empty">No matches</p>}
      </nav>
    </aside>
  )
}
