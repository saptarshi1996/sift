# Sift

Paste a username or a story link, get a `view-source:` link, paste the page source back, and Sift pulls out the best video and the largest picture for every story slide.

**Live site:** https://saptarshi1996.github.io/sift/

Everything runs in the browser. Nothing is uploaded, and the page makes no network requests of its own (the browser only requests the media links to show previews).

## Scripts

```bash
npm run dev         # start the dev server
npm run build       # type-check and build to dist/
npm run lint        # eslint
npm test            # run the tests once (vitest)
npm run test:watch  # re-run tests as you edit
npm run preview     # serve the production build
```

Git hooks (husky, installed by `npm install`): **pre-commit** runs lint and a build, **pre-push** runs the tests. The deploy workflow runs lint, tests and the build, so a failing test also blocks a deploy.

## How it works

1. **Generate** turns a username, profile link or story link into a story URL and shows its `view-source:` form. Browsers don't let a page open `view-source:` links, so you copy it and paste it into a new tab's address bar yourself.
2. Copy the whole page source from that tab and paste it into the textbox.
3. **Extract** reads the JSON embedded in the page. For each slide it keeps the best video (ranked by the resolution in its encode tag) and the largest picture. A slide with no video is an image.

Each slide has its own Video | Thumbnail (or Image) switcher. The "Show all as" switcher in the header changes every slide at once.

## Deploy (GitHub Pages)

Pushing to `main` runs `.github/workflows/deploy.yml`, which lints, runs the tests, builds with `BASE_PATH=/sift/` and publishes `dist/` to GitHub Pages. The site is at `https://saptarshi1996.github.io/sift/`.

One-time setup: in the repo on GitHub, go to Settings → Pages and set **Source** to **GitHub Actions**. Without that the deploy job fails.

A project site is served from `/<repo>/`, so `vite.config.ts` reads `BASE_PATH` for `base` (it is `/` locally). To check the Pages build locally:

```bash
BASE_PATH=/sift/ npm run build && BASE_PATH=/sift/ npm run preview   # then open http://localhost:4173/sift/
```

The preview needs `BASE_PATH` too; without it the server answers `/sift/...` with the home page.

## Structure

```
src/
  App.tsx                  state and page layout
  types.ts                 Slide / Kind types
  lib/
    normalize.ts           username / profile / story link -> story URL
    extract.ts             page source -> slides
    clipboard.ts           clipboard write with a fallback
  hooks/useCopy.ts         copy + "Copied" feedback state
  components/
    Sidebar.tsx, TopBar.tsx
    ClearableFields.tsx    inputs with an x button
    SegToggle.tsx          the Video | Thumbnail switcher
    ResultsPanel.tsx, SlideCard.tsx, SlideMedia.tsx
    Icons.tsx
  index.css                all styles (dark theme, tokens on :root)
```

`index.html` sets `<meta name="referrer" content="no-referrer">`. The CDN that serves the media redirects requests that carry a referrer to a host that can fail, so the previews rely on it.
