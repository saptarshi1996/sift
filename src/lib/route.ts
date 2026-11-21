/** `base` is the site's base path and ends with a slash ('/' locally, '/sift/' on Pages). */
export function pathForTool(id: string, base: string): string {
  return `${base}${id}`
}

/** The tool id in the first path segment after `base`, or null when it isn't one of `ids`. */
export function toolIdFromPath(pathname: string, base: string, ids: string[]): string | null {
  if (!pathname.startsWith(base)) return null
  const seg = pathname.slice(base.length).split('/').filter(Boolean)[0]
  return seg !== undefined && ids.includes(seg) ? seg : null
}
