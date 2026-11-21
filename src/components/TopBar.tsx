import { SearchIcon, SidebarIcon } from './Icons.tsx'

interface Props {
  title: string
  onToggleSidebar: () => void
  query: string
  onQuery: (value: string) => void
}

export default function TopBar({ title, onToggleSidebar, query, onQuery }: Props) {
  return (
    <header className="topbar">
      <button className="icon-btn" type="button" aria-label="Toggle sidebar" onClick={onToggleSidebar}>
        <SidebarIcon />
      </button>
      <div className="crumbs">
        Media / <b>{title}</b>
      </div>
      <div className="search">
        <SearchIcon />
        <input
          type="text"
          value={query}
          placeholder="Search tools"
          aria-label="Search tools"
          autoComplete="off"
          onChange={(e) => onQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              onQuery('')
              e.currentTarget.blur()
            }
          }}
        />
      </div>
    </header>
  )
}
