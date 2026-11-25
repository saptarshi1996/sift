import { SidebarIcon } from './Icons.tsx'

interface Props {
  title: string
  onToggleSidebar: () => void
}

export default function TopBar({ title, onToggleSidebar }: Props) {
  return (
    <header className="topbar">
      <button className="icon-btn" type="button" aria-label="Toggle sidebar" onClick={onToggleSidebar}>
        <SidebarIcon />
      </button>
      <div className="crumbs">
        Media / <b>{title}</b>
      </div>
    </header>
  )
}
