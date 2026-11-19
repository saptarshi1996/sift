import type { ComponentType } from 'react'
import { FunnelIcon, LayersIcon, StoriesIcon } from './Icons.tsx'

interface NavItem {
  id: string
  name: string
  Icon: ComponentType<{ className?: string }>
}

const ITEMS: NavItem[] = [{ id: 'stories', name: 'Stories', Icon: StoriesIcon }]

/** Left navigation. Collapses to an icon strip (CSS, via the `collapsed` class on .app). */
export default function Sidebar({ query }: { query: string }) {
  const q = query.trim().toLowerCase()
  const shown = ITEMS.filter((it) => !q || it.name.toLowerCase().includes(q))

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
        {shown.map(({ id, name, Icon }) => (
          <a
            key={id}
            className="nav-item active"
            href={`#${id}`}
            aria-current="page"
            title={name}
            onClick={(e) => e.preventDefault()}
          >
            <Icon />
            <span className="lbl">{name}</span>
          </a>
        ))}
        {shown.length === 0 && <p className="nav-empty">No matches</p>}
      </nav>
    </aside>
  )
}
