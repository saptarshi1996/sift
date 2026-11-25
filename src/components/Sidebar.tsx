import { pathForTool } from '../lib/route.ts'
import { BASE, TOOLS } from '../tools.ts'
import { FunnelIcon, LayersIcon } from './Icons.tsx'

interface Props {
  active: string
  onSelect: (id: string) => void
}

/** Left navigation. Collapses to an icon strip (CSS, via the `collapsed` class on .app). */
export default function Sidebar({ active, onSelect }: Props) {

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-icon">
          <FunnelIcon />
        </div>
        <span className="lbl">Sift</span>
      </div>
      <nav>
        <div className="nav-group">
          <LayersIcon />
          <span className="lbl">Media</span>
        </div>
        {TOOLS.map(({ id, title, Icon }) => (
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
      </nav>
    </aside>
  )
}
