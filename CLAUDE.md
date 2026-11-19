# Sift — project context

A small, client-only React tool. The user gives a username or story link, copies the page source of that story, pastes it back, and Sift pulls out the **best video** and the **largest picture** for every story slide, with previews, copy and open buttons.

No backend, no uploads, no network calls of its own. The browser only requests the media URLs to show previews.

This React project is a port of an earlier static prototype (see "Legacy prototype"). The UI and behavior were iterated on at length with the user; the decisions below are deliberate, so don't "improve" them without asking.

## Commands

```bash
npm run dev       # vite dev server (the Claude desktop preview uses port 5173)
npm run build     # tsc -b && vite build
npm run lint      # eslint (react-hooks v7 rules are strict)
```

Always run `npm run build` and `npm run lint` after changes. There is no test framework; behavior is verified in a browser (see "Testing").

## Deploy

GitHub Pages, via `.github/workflows/deploy.yml` (same setup as the sibling `toolshed` project): on push to `main` it runs `npm ci`, `npm run lint`, `npm run build` with `BASE_PATH=/sift/`, and publishes `dist/`. Live at `https://saptarshi1996.github.io/sift/`. Pages must be set to the **GitHub Actions** source in the repo settings (one-time).

- `vite.config.ts` sets `base: process.env.BASE_PATH ?? '/'`. Never hard-code `/sift/` as the base, or local dev breaks.
- The app is a single page with no client-side routes, so unlike `toolshed` there is no `404.html` copy step. Add one only if a router is introduced.
- To test the Pages build locally, both `build` and `preview` need `BASE_PATH=/sift/` (the preview server reads it at start-up; without it `/sift/...` returns the home page). Open `http://localhost:4173/sift/`.
- The workflow has no test step because there are no tests yet; add `npm test` before the build if tests are added.

## How it works

1. **Generate** turns a username / `@name` / profile link / story link into a story URL (`normalizeStoryUrl`) and shows its `view-source:` form in a read-only field.
2. Browsers **cannot** open `view-source:` links from a page (`window.open` is blocked). The user copies the link and pastes it into a new tab's address bar, then copies the whole page source. Do not add an "Open" button for it; it was tried and removed.
3. The user pastes the source into the textarea and clicks **Extract** (`extractMedia`).
4. Results: one card per slide, each with its own Video | Thumbnail switcher. A "Show all as" switcher in the page header changes every slide at once.

### Page-source data shape (story page)

The source contains JSON with an `"items":[ ... ]` array, one entry per slide:

- `item.video_versions[]` → `{ url }` entries. A slide has **no** `video_versions` when it's an image.
- `item.image_versions2.candidates[]` → `{ url, width, height }`, several sizes. The largest by pixel area is used (typically 640×1136 for video covers; real image stories were not available to test with, so their candidate sizes are unverified).
- `video_versions` typically holds 3 near-identical entries (types 101/102/103): same file, different signing params. They have no width/height, so quality is ranked from the `efg` query param on the URL: base64 JSON with `vencode_tag` like `...STORY.C3.720.dash_baseline_1_v1`; the number between dots is the resolution. Ties keep page order.
- If there is no `"items":[` array, `extractMedia` falls back to a single pseudo-slide built from the first `"video_versions":[` and `"candidates":[` it finds.
- `extractArray` walks to the matching `]` while respecting JSON strings; the source is ~0.5 MB, so don't use a naive regex.

### Gotchas that cost time before

- **Referrer**: `index.html` has `<meta name="referrer" content="no-referrer">`. The media CDN answers requests that carry a Referer with a 302 to another host, and for some slides that host fails to play. Without a referrer the file is served directly. Keep the meta.
- **URLs expire**: media URLs are signed; the `oe` query param is a hex Unix timestamp. Old pasted sources stop working. This is why the app never stores anything.
- **Clipboard** needs a real user click (scripted `.click()` fails). `writeClipboard` falls back to `execCommand('copy')`.
- Slide 2 of the sample story is a 1080p **VP9-in-MP4** file (older video); slide 1 is H.264. Both play in Chrome. A video that won't play shows a message pointing at the open icon.
- A cached old copy of the page can hide changes in the preview browser; navigate with a cache-busting query (`?v=2`) when in doubt.

## State model (App.tsx)

- `slides: Slide[] | null` — `null` = nothing shown, `[]` = "Not found".
- `viewPref: 'video' | 'thumbnail'` — the global "Show all as" choice. Survives re-extracting. A slide that lacks that view falls back to the other.
- `overrides: Record<slideItem, Kind>` — per-slide choices. Cleared on Extract and on any global click.
- A slide's kind = `overrides[item] ?? (slide[viewPref] ? viewPref : slide.video ? 'video' : 'thumbnail')`.
- Global button highlight is **derived**: a button is pressed only when every slide that has that view is showing it, so after changing one slide alone, neither global button is highlighted. If every slide is an image, the global buttons read **Video (disabled) | Image**.
- Slides with no video are "images": their switcher says **Image** instead of **Thumbnail**, the badge says `Image · WxH`, and Video is disabled.
- `SlideMedia` is keyed by kind so switching stops the old video.

## UI decisions (user preferences, keep)

- **Dark theme only** (`color-scheme: dark`, tokens on `:root` in `src/index.css`). No light mode.
- App-shell layout: sidebar (brand "Sift", group "Media", item "Stories"), top bar (sidebar toggle, breadcrumb "Media / Stories", search), page header "Stories" with the global switcher at the far right, then three panels, then Results.
- Collapsed sidebar is a 66px **icon rail**, not hidden. It starts collapsed on screens ≤ 800px.
- Sidebar item is indented to align with the group label (like the reference app the user supplied).
- The search box filters sidebar items only. No ⌘K shortcut (removed on request); Esc clears it.
- **No numbers or section headers** on the three input panels; each has one instruction line above its field. Keep the instruction wording as is.
- **Buttons are all plain neutral** (Generate, Copy, Extract): same size (112×40), 8px radius, no colored/primary button. Inputs are 40px, 8px radius, and match button height.
- Buttons sit **below** their field, left-aligned.
- Every editable field has a round × clear button that appears when it has text. The source-link field is read-only and has none.
- Empty-state errors are red messages under the field, not button text changes: empty Generate, empty Copy ("Nothing to copy yet. Generate a link first."), empty Extract ("Paste the page source first.").
- Focus style: thin accent border on inputs; thin 1px outline on buttons/links (keyboard only). No big glow.
- **No platform or brand name appears anywhere in this repo**: not in the UI, errors, comments, docs or sample data (the user asked for this explicitly, twice). The one unavoidable exception is the host constant at the top of `src/lib/normalize.ts`, which is needed to build story links and validate input; keep it the only place the host is named, and don't add the name anywhere else. The generated `view-source:` link necessarily contains the host at runtime. The page is named **Stories**; the icons are generic (the Stories icon is a phone frame with a play triangle, Media is a stack of layers) and must not imitate the platform's logo.
- Results: slides in an auto-fill grid (`minmax(250px, 1fr)`, 24px gap, 32px row gap), so about four fit across on a ~1650px screen. One 9:16 tile per slide, one view at a time (not side by side; that was rejected).
- Each tile: frosted badge top-left (`Video · 720p`, `Thumbnail · 640×1136`, `Image · …`), and two round icon buttons top-right (copy link, open in new tab) with custom tooltips. Copy shows a green check and a "Copied" tooltip for 1.5 s. There is no button row under the tile.
- Videos start **without native controls**, showing the full frame with a round play button, so the video tile looks the same height as the thumbnail. Controls appear after the first play.
- Page title is "Sift".

## Conventions and constraints

- TypeScript is strict: `erasableSyntaxOnly` (no enums or parameter properties), `verbatimModuleSyntax` (use `import type`), `noUnusedLocals/Parameters`. Imports include the file extension (`./App.tsx`, `../lib/extract.ts`).
- ESLint uses `eslint-plugin-react-hooks` v7: don't read refs during render, don't set state in effects, don't define components inside components.
- React 19: `ref` is a plain prop on function components (see `ClearableFields.tsx`).
- Plain CSS in one file (`src/index.css`), class-based, no CSS-in-JS or UI library. Keep the existing class names; selectors like `.panel > button` rely on buttons being direct children of the panel.
- Pure logic lives in `src/lib/` and is framework-free; keep it that way so it can be unit-tested later.
- `src/types.ts` holds `Slide`, `Kind`, `VideoMedia`, `ThumbMedia`.

## Testing

No automated tests yet. To verify behavior:

- Run the dev server and drive the page in a browser. Set React-controlled fields via the native value setter plus an `input` event (`Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(el, v)`), then click.
- A real saved story page is needed as input (~0.5 MB HTML). Keep it **out of the repo**; for testing, copy it temporarily into `public/` and delete it afterwards.
- Simulate image slides by renaming `"video_versions":[` to something else in the sample text (all of them → all-image story; only the second occurrence → mixed story).
- Check the phone layout at 375px (no horizontal scroll; slide titles must stay on one line) and a wide layout (~1650px, four columns).
- Real clipboard tests overwrite the user's clipboard; mention it if you do one.

Edge cases worth covering if tests are added: `normalizeStoryUrl` (usernames, `@name`, trailing slashes/queries, `/_u/` deep links, `/p/` and `/explore/` rejection, look-alike hosts (the real host used as a prefix of another domain), story and highlight links kept as given) and `extractMedia` (duplicate video entries, image-only slides, missing `items`).

## Legacy prototype

`/Users/saptarshisengupta/Developer/scripts/sift/` holds the original static version:

- `index.html` — single-file prototype this React app mirrors (feature parity was checked against it).
- `extract-media.js` — Node CLI: `node extract-media.js [source.html]` prints a JSON array of slides (best video and largest thumbnail). Its extraction logic duplicates `src/lib/extract.ts`; **keep the two in sync** if the logic changes (the only difference is `Buffer` vs `atob` for base64).
- `source.html` — a sample saved story page (two video slides) used for testing.
- `.claude/launch.json` — preview configs (`sift-static` on 8123 for the prototype, `sift-react` on 5173 for this project).

## Working with the user

- The user iterates visually and gives short, direct instructions ("remove this", "make it same as X"). They notice small alignment and spacing differences; measure in the browser rather than guessing.
- Verify in the browser before saying something works, and say plainly what was not tested (their own Chrome window, real image stories, narrow layouts if skipped).
- Don't add features, headings or explanatory text that weren't asked for; earlier rounds removed several of these on request.
