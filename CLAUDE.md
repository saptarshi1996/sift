# Sift — project context

A small, client-only React tool. The user gives a username or story link, copies the page source of that story, pastes it back, and Sift pulls out the **best video** and the **largest picture** for every story slide, with previews, copy and open buttons. Two flows feed it: the original one (Stories and Posts tabs: copy a page's source, paste it back) and **Sift Media**, where a bookmark on the page itself sends the data (see "Sift Media").

No backend, no uploads, no network calls of its own. The browser only requests the media URLs to show previews. Live at https://saptarshi1996.github.io/sift/

This React project is a port of an earlier static prototype (see "Legacy prototype"). The UI and behavior were iterated on at length with the user; the decisions below are deliberate, so don't "improve" them without asking.

## Commands

```bash
npm run dev       # vite dev server (the Claude desktop preview uses port 5173)
npm run build     # tsc -b && vite build
npm run lint      # eslint (react-hooks v7 rules are strict)
```

```bash
npm test          # vitest run (unit tests for src/lib)
npm run test:watch
```

**Node:** `.nvmrc` is `24` to match the deploy workflow (`node-version: 24`). Tests, `tsc` and the build were checked on Node 24 as well as the user's local Node 26.

Always run `npm run lint`, `npm test` and `npm run build` after changes. The pure logic in `src/lib` has unit tests; UI behavior is verified in a browser (see "Testing").

**Git hooks** (husky, `.husky/`, installed by the `prepare` script): `pre-commit` runs `npm run lint` and `npm run build`; `pre-push` runs `npm test`. Don't bypass them with `--no-verify`; fix the failure instead. Same setup as the sibling `toolshed` project.

## Deploy

GitHub Pages, via `.github/workflows/deploy.yml` (same setup as the sibling `toolshed` project): on push to `main` it runs `npm ci`, `npm run lint`, `npm run build` with `BASE_PATH=/sift/`, and publishes `dist/`. Live at `https://saptarshi1996.github.io/sift/`. Pages must be set to the **GitHub Actions** source in the repo settings (one-time).

- `vite.config.ts` sets `base: process.env.BASE_PATH ?? '/'`. Never hard-code `/sift/` as the base, or local dev breaks.
- Each tool has its own path (`/sift/stories`, `/sift/posts`, `/sift/sift-media`; see "Routes"). GitHub Pages answers unknown paths with `404.html`, so the `postbuild` script copies `dist/index.html` to `dist/404.html` (same as `toolshed`). Without it, reloading on `/sift/posts` is a Pages 404. `vite preview` and the dev server fall back to `index.html` on their own, so they do **not** prove this works; check that `dist/404.html` exists.
- To test the Pages build locally, both `build` and `preview` need `BASE_PATH=/sift/` (the preview server reads it at start-up; without it `/sift/...` returns the home page). Open `http://localhost:4173/sift/`.
- The workflow runs `npm run lint`, `npm test` and `npm run build` in that order, so a failing test blocks the deploy.

## How it works (the Stories and Posts tabs)

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

## Tools (the tabs)

The sidebar has three items under **Media**: **Stories**, **Posts** and **Sift Media**, each its own page (Stories and Posts have the same three panels and results; Sift Media has a bookmark button instead, see below). All are defined in `src/tools.ts` (title, icon, instruction line, placeholder, `normalize`, `extract`) and rendered by `src/components/MediaTool.tsx`. `App.tsx` only holds the shell and the active tab. Every page stays mounted (`hidden` on the inactive one) so a pasted source survives switching tabs; each page has its own state. Adding another tool means adding an entry to `TOOLS`.

- **Posts** takes a post, reel or tv link (`normalizePostUrl`: `/p/CODE/`, `/reel/CODE/`, `/tv/CODE/`, optionally under a username; tracking queries dropped; profile and story links are rejected). Stories behavior is unchanged: a post link on the Stories page is still not a story link.
- `extractPost` reads only the **first** `"items":[` entry (the post; later arrays are related posts). A multi-item post lists its items under `carousel_media` and each child becomes a slide; a single post or reel is the entry itself. Children use the same `video_versions` / `image_versions2` shape as story slides, so best-video and largest-picture logic is shared. Image candidates include square crops, but the largest by area is still the full-size one (1242×1656 in the sample).
- Video ranking for post videos is unverified (the sample post has only images); it assumes the same `efg` resolution tag as stories.

### Routes

Tabs are real paths, so a reload or a shared link stays on the tab: `${BASE}stories`, `${BASE}posts`, `${BASE}sift-media` (the tool `id` is the path; `BASE` is `import.meta.env.BASE_URL`, exported from `src/tools.ts`). No router library: `src/lib/route.ts` (`pathForTool`, `toolIdFromPath`, unit-tested) plus the History API in `App.tsx` (`pushState` on a sidebar click, a `popstate` listener for back/forward). At load the URL is read once and rewritten to the canonical path, so `/` and unknown paths become the Stories path. Sidebar items are real `<a href>` links (a modified click, e.g. cmd-click, opens a new tab). The bookmark's Sift URL is `origin + BASE + 'sift-media'`; an old bookmark that opens the site root, or the old `/sift-posts` / `/sift-stories` paths, with `#post=` / `#story=` still lands on Sift Media because `App.tsx` picks that tool whenever the fragment carries data. (Those old paths themselves are unknown routes now and fall back to Stories.)

### Sift Media (id `sift-media`)

No `view-source:` and no pasting: **one tab and one bookmark serve stories, posts and reels.** The tab shows a draggable **Sift It** button; its `href` is a `javascript:` bookmarklet built by `buildBookmarklet` in `src/lib/snippet.ts` (set through a ref callback, because React 19 refuses `javascript:` in `href` props). Why a bookmark: story and post pages add their media to the **live page** as JSON `<script>` tags, so it is not in the original source for a logged-out request (a plain `fetch`/`view-source:` gets a shell and a login wall) and the browser blocks Sift from fetching cross-origin, so something has to run on the site's own page.

**Flow.** The user opens a story or post and clicks the bookmark. It decides by the page it runs on (`/stories/...` → story, otherwise a post/reel/tv URL → post), finds the data, keeps only the media fields and `window.open`s Sift with `#story=` or `#post=` plus the base64 JSON in the **URL fragment** (never sent to a server, so Sift stays client-only). Either kind opens Sift Media (`IMPORT_TOOL` in `App.tsx`). `App.tsx` reads the fragment **once** at load (`decodeHandoff` in `src/lib/handoff.ts`), clears it, and passes the data to `MediaTool` as `initialData`, which runs `extractAny` (a post's items sit under `carousel_media`, a story's slides are the `items` themselves). Reloading Sift shows nothing (the data is not stored). It was two tabs (Sift stories, Sift posts) at first; they were merged on request.

**Posts.** The bookmark finds the object whose `code` equals the code in the URL and sends `{"items":[{"carousel_media":[{video_versions, image_versions2}]}]}`. In the logged-out data the post sits under a `...if_not_gated_logged_out` key and image candidates carry only a `url`: the **first candidate is the original size** (no `sNNNxNNN` in its `stp` param; checked by loading them: 1440x1440 and 1242x1242 matched `original_width/height`), so the bookmark labels it with the item's `original_width/height`; if candidates do carry sizes it takes the largest.

**Stories.** The data is under `xdt_api__v1__feed__reels_media.reels_media[0].items` (first reel only); each item already has `video_versions` and sized `image_versions2.candidates`, so the bookmark trims them and sends `{"items":[...]}`, which `extractMedia` reads (best video by the `efg` tag, largest picture by area).

**Wrong-user guard.** The page only embeds the data of the page that loaded first; opening another user's story by clicking inside the app changes the URL but not the data. So the bookmark refuses unless `reel.user.username` matches the user in the URL (case-insensitive; skipped for `/stories/highlights/...` and for a reel that names no user).

**Fetch fallback.** When the live page has no data, or the wrong user's, the bookmark fetches `location.href` again (same request as a reload, `Accept: text/html`), parses it with `DOMParser`, and reads the data from that HTML (what view-source shows). It opens a blank window synchronously first, while the click still counts for the pop-up blocker, and points it at Sift when the fetch finishes; on failure it closes it and alerts. Posts use the same fallback. This was added after the user reported "Story data not found" on `/stories/<user>/` pages reached from the in-app tray; afterwards it stopped failing for them. **Which change fixed it was never established** (the live page was never inspected), so don't assume the `Accept` header is or isn't needed.

**Diagnostic line (deliberate, the user asked to keep it, don't remove it).** A failure alert appends `[page: json=N stories=M | fetched: <status> len=L json=N stories=M | <why>]`: JSON scripts in the live page and how many mention the story data, the same for the re-fetched HTML, then why the last try failed. A screenshot of a failure shows what each page held. The user re-drags the bookmark whenever its code changes (it is a snapshot), so say so after changing `snippet.ts`.

**Highlights do NOT work (known, unfixed).** Only regular story pages and posts were ever seen. On a highlight link the user got `[page: json=48 stories=0 | fetched: 200 len=1247607 json=38 stories=1 | no story]`: one script mentions the story key but not in the `reels_media[0].items` shape the code accepts. To fix it, ask the user for the saved view-source of that highlight page (e.g. `scripts/source-highlight.html`, outside the repo), find where its slides live, add support and test against that file as for the other samples. Don't guess the structure.

**Phone.** The site itself renders fine at phone width (checked at 412px). The bookmark on a phone is **untested**: Brave on Android has no extensions and no bookmarks bar to drag onto; it would mean copying the code into a bookmark (or typing `javascript:` then pasting into the address bar, since browsers strip a pasted `javascript:` prefix) and running it from the address bar. With a phone user agent, the public post page did carry the same data and the bookmark returned the images. The user decided to **stay with the desktop browser** and not build anything for phones; a Copy-code button, a Firefox userscript and an iPhone Shortcut were discussed, not built.

**Constraints and tests.** The bookmark code must contain no literal `%` (the browser percent-decodes a `javascript:` URL before running it) and must not name the platform; Sift's own URL is baked in at render time from `window.location` (`origin + BASE + tool.id`). `snippet.test.ts` runs it against a fake page via `new Function` with fake `fetch`/`DOMParser`/popup window (no node types are installed, so don't import `node:` modules in tests) and covers `decodeHandoff`.

**Verified:** headless Chrome with a browser-initiated `javascript:` navigation (what a bookmark click does; a page script doing `location.href = 'javascript:...'` **is** blocked by the site's CSP, so test with CDP `Page.navigate`): a public carousel post (3 images at original size), a saved one-slide story and a saved 3-slide reel served locally at a `/stories/...` path (with a data-less live page, so the fallback ran), and the `/sift/` base used on Pages. The user also used the real bookmark in their own browser and confirmed posts and stories work. **Untested:** Safari and Firefox, private posts, videos/reels inside posts (it passes `video_versions` urls through and relies on the same `efg` tag), and phones.

## State model (per page, MediaTool.tsx)

- `slides: Slide[] | null` — `null` = nothing shown, `[]` = "Not found".
- `viewPref: 'video' | 'thumbnail'` — the global "Show all as" choice. Survives re-extracting. A slide that lacks that view falls back to the other.
- `overrides: Record<slideItem, Kind>` — per-slide choices. Cleared on Extract and on any global click.
- A slide's kind = `overrides[item] ?? (slide[viewPref] ? viewPref : slide.video ? 'video' : 'thumbnail')`.
- Global button highlight is **derived**: a button is pressed only when every slide that has that view is showing it, so after changing one slide alone, neither global button is highlighted. If every slide is an image, the global buttons read **Video (disabled) | Image**.
- Slides with no video are "images": their switcher says **Image** instead of **Thumbnail**, the badge says `Image · WxH`, and Video is disabled.
- `SlideMedia` is keyed by kind so switching stops the old video.

## UI decisions (user preferences, keep)

- **Dark theme only** (`color-scheme: dark`, tokens on `:root` in `src/index.css`). No light mode.
- App-shell layout: sidebar (brand "Sift", group "Media", items "Stories", "Posts", "Sift Media"), top bar (sidebar toggle, breadcrumb "Media / <current tab>", search), page header with the tab's title and the global switcher at the far right, then the tab's panels (three for Stories and Posts, the Sift It button for Sift Media), then Results.
- Collapsed sidebar is a 66px **icon rail**, not hidden. It starts collapsed on screens ≤ 800px.
- Sidebar item is indented to align with the group label (like the reference app the user supplied).
- The search box filters sidebar items only. No ⌘K shortcut (removed on request); Esc clears it.
- **No numbers or section headers** on the three input panels; each has one instruction line above its field. Keep the instruction wording as is.
- **Buttons are all plain neutral** (Generate, Copy, Extract): same size (112×40), 8px radius, no colored/primary button. Inputs are 40px, 8px radius, and match button height.
- Buttons sit **below** their field, left-aligned.
- Every editable field has a round × clear button that appears when it has text. The source-link field is read-only and has none.
- Empty-state errors are red messages under the field, not button text changes: empty Generate, empty Copy ("Nothing to copy yet. Generate a link first."), empty Extract ("Paste the page source first.").
- Focus style: thin accent border on inputs; thin 1px outline on buttons/links (keyboard only). No big glow.
- **No platform or brand name in the UI or the docs** (README, this file): not in UI text, errors, instruction lines or documentation (the user asked for this explicitly, twice, and repeated it on 2026-11-21 when shortening the Sift Media instruction line). In source code it is tolerated (the user: "in source code i guess its fine"), but in practice it still appears only as the host constant below; tests take the host from `HOSTS`, so don't spread it further. Keep fixtures and sample data generic (made-up hosts and usernames). The one unavoidable exception is the host constant at the top of `src/lib/normalize.ts`, which is needed to build story links and validate input; keep it the only place the host is named, and don't add the name anywhere else. The generated `view-source:` link necessarily contains the host at runtime. The page is named **Stories**; the icons are generic (the Stories icon is a phone frame with a play triangle, Media is a stack of layers) and must not imitate the platform's logo.
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

**Unit tests** (vitest, colocated as `src/lib/*.test.ts`, run in a plain Node environment, no jsdom):

- `normalize.test.ts` covers `normalizeStoryUrl`: usernames, `@name`, whitespace and case, the 30-character limit, `view-source:` prefixes, profile links in every shape (scheme, `www`/`m.`, queries, fragments, `/_u/` deep links), story/highlight links kept as given, non-profile paths, the bare home page, look-alike hosts, other schemes.
- `route.test.ts` covers `pathForTool` and `toolIdFromPath` (both bases, trailing slash, unknown and wrong-case paths, round trip).
- `snippet.test.ts` covers `buildBookmarklet` (the fetch fallback with fake `fetch`/`DOMParser` and a fake popup window; stories also: the wrong-user guard; posts: carousel, single post, video urls, sizes, picking the right post, non-JSON scripts; stories: slides and best video, highlights, first reel only, missing data; not-a-page alerts) and `decodeHandoff`.
- `extract.test.ts` also covers `extractAny` (post shape, story shape with several slides, single reel, null/empty carousel, empty) and `extractPost` (carousel items, single post, first entry only, empty); `normalize.test.ts` covers `normalizePostUrl`.
- `extract.test.ts` covers `extractArray` (nesting, brackets and escaped quotes in strings, broken/unterminated JSON), `resolution`, and `extractMedia` (duplicate entries, best video by resolution with ties keeping page order, largest picture by area, entries without a url, image-only and mixed stories, slides that are dropped keeping the others' numbers, the no-`items` fallback, escaped slashes).
- Fixtures are built inside the tests with made-up hosts. Tests get the real host from the exported `HOSTS` in `normalize.ts` so the brand name stays out of every other file (see the naming rule above).
- The suite was checked by deliberately breaking the code (reversed sort orders, a narrower resolution pattern, ignoring escapes, no lowercasing, accepting look-alike hosts, allowing reserved paths, and so on); each break made at least one test fail.
- When changing `src/lib`, add or adjust a test in the same change. UI components have no unit tests yet.

**Browser checks** for the UI:

- Run the dev server and drive the page in a browser. Set React-controlled fields via the native value setter plus an `input` event (`Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(el, v)`), then click.
- A real saved story page is needed as input (~0.5 MB HTML). Keep it **out of the repo**; for testing, copy it temporarily into `public/` and delete it afterwards.
- Simulate image slides by renaming `"video_versions":[` to something else in the sample text (all of them → all-image story; only the second occurrence → mixed story).
- Check the phone layout at 375px (no horizontal scroll; slide titles must stay on one line) and a wide layout (~1650px, four columns).
- Real clipboard tests overwrite the user's clipboard; mention it if you do one.

## Legacy prototype

`/Users/saptarshisengupta/Developer/scripts/sift/` holds the original static version:

- `index.html` — single-file prototype this React app mirrors (feature parity was checked against it).
- `extract-media.js` — Node CLI: `node extract-media.js [source.html]` prints a JSON array of slides (best video and largest thumbnail); `--post` reads a post page (default `source-post.html`, a sample saved post with 5 images). Its extraction logic duplicates `src/lib/extract.ts`; **keep the two in sync** if the logic changes (the only difference is `Buffer` vs `atob` for base64).
- `source.html` — a sample saved story page used for testing. It was replaced on 2026-11-21 with a fresh **one-slide** video story (the older sample had two slides); a saved story's media links expire after about a day.
- `../source-single-story.html` (in `scripts/`, not `scripts/sift/`) — a saved single-profile story page (3-slide reel); `source-post.html` is a saved 3-item post. Samples live outside the repo; their media links expire after about a day.
- `.claude/launch.json` — preview configs (`sift-static` on 8123 for the prototype, `sift-react` on 5173 for this project).

## Working with the user

- The user iterates visually and gives short, direct instructions ("remove this", "make it same as X"). They notice small alignment and spacing differences; measure in the browser rather than guessing.
- Verify in the browser before saying something works, and say plainly what was not tested (their own Chrome window, real image stories, narrow layouts if skipped).
- Don't add features, headings or explanatory text that weren't asked for; earlier rounds removed several of these on request.
