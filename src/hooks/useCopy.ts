import { useCallback, useEffect, useRef, useState } from 'react'
import { writeClipboard } from '../lib/clipboard.ts'

export type CopyState = 'idle' | 'done' | 'fail'

/** Copies text and reports the result as `done` / `fail`, resetting to `idle` after a moment. */
export function useCopy(resetMs = 1500) {
  const [state, setState] = useState<CopyState>('idle')
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => () => clearTimeout(timer.current), [])

  const copy = useCallback(
    async (text: string) => {
      const ok = await writeClipboard(text)
      setState(ok ? 'done' : 'fail')
      clearTimeout(timer.current)
      timer.current = setTimeout(() => setState('idle'), resetMs)
    },
    [resetMs],
  )

  return { state, copy }
}
