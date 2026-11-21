import { useState } from 'react'
import MediaTool from './components/MediaTool.tsx'
import Sidebar from './components/Sidebar.tsx'
import TopBar from './components/TopBar.tsx'
import { decodePostHash } from './lib/handoff.ts'
import { TOOLS } from './tools.ts'

/** Post data sent by the bookmarklet in the URL fragment; read once, then the fragment is cleared. */
const IMPORTED = (() => {
  const data = decodePostHash(window.location.hash)
  if (data !== null) history.replaceState(null, '', window.location.pathname + window.location.search)
  return data
})()
const IMPORT_TOOL = 'public-posts'

function App() {
  const [collapsed, setCollapsed] = useState(() => window.matchMedia('(max-width: 800px)').matches)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(IMPORTED !== null ? IMPORT_TOOL : TOOLS[0].id)
  const current = TOOLS.find((t) => t.id === active) ?? TOOLS[0]

  return (
    <div className={`app${collapsed ? ' collapsed' : ''}`}>
      <Sidebar query={query} active={active} onSelect={setActive} />

      <div className="main">
        <TopBar
          title={current.title}
          onToggleSidebar={() => setCollapsed((c) => !c)}
          query={query}
          onQuery={setQuery}
        />

        <main className="content">
          {/* Every page stays mounted so a pasted source survives switching tabs. */}
          {TOOLS.map((t) => (
            <div key={t.id} hidden={t.id !== active}>
              <MediaTool tool={t} initialData={t.id === IMPORT_TOOL && IMPORTED !== null ? IMPORTED : undefined} />
            </div>
          ))}
        </main>
      </div>
    </div>
  )
}

export default App
