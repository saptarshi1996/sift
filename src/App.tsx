import { useEffect, useState } from 'react'
import MediaTool from './components/MediaTool.tsx'
import Sidebar from './components/Sidebar.tsx'
import TopBar from './components/TopBar.tsx'
import { decodeHandoff } from './lib/handoff.ts'
import { pathForTool, toolIdFromPath } from './lib/route.ts'
import { BASE, TOOLS } from './tools.ts'

const IDS = TOOLS.map((t) => t.id)
/** The tool that receives what the bookmarklet sent, from a story page or a post page. */
const IMPORT_TOOL = 'sift-media'
const fromUrl = () => toolIdFromPath(window.location.pathname, BASE, IDS) ?? TOOLS[0].id

/**
 * Read once at load: story or post data sent by the bookmarklet in the URL fragment, and which tool the
 * URL names. Then the address is rewritten to the tool's own path (this also drops the fragment
 * and sends '/' or an unknown path to the first tool).
 */
const IMPORTED = decodeHandoff(window.location.hash)
const START = IMPORTED ? IMPORT_TOOL : fromUrl()
history.replaceState(null, '', pathForTool(START, BASE) + window.location.search)

function App() {
  const [collapsed, setCollapsed] = useState(() => window.matchMedia('(max-width: 800px)').matches)
  const [active, setActive] = useState(START)
  const current = TOOLS.find((t) => t.id === active) ?? TOOLS[0]

  // Back / forward move between tools.
  useEffect(() => {
    const onPop = () => setActive(fromUrl())
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  const select = (id: string) => {
    if (id === active) return
    history.pushState(null, '', pathForTool(id, BASE))
    setActive(id)
  }

  return (
    <div className={`app${collapsed ? ' collapsed' : ''}`}>
      <Sidebar active={active} onSelect={select} />

      <div className="main">
        <TopBar title={current.title} onToggleSidebar={() => setCollapsed((c) => !c)} />

        <main className="content">
          {/* Every page stays mounted so a pasted source survives switching tabs. */}
          {TOOLS.map((t) => (
            <div key={t.id} hidden={t.id !== active}>
              <MediaTool tool={t} initialData={IMPORTED && t.id === IMPORT_TOOL ? IMPORTED.data : undefined} />
            </div>
          ))}
        </main>
      </div>
    </div>
  )
}

export default App
