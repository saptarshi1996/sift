# Sift

Paste a username or a story link, get a `view-source:` link, paste the page source back, and Sift pulls out the best video and the largest picture for every story slide.

Everything runs in the browser. Nothing is uploaded, and the page makes no network requests of its own (the browser only requests the media links to show previews).

## Scripts

```bash
npm run dev      # start the dev server
npm run build    # type-check and build to dist/
npm run lint     # eslint
npm run preview  # serve the production build
```

## How it works

1. **Generate** turns a username, profile link or story link into a story URL and shows its `view-source:` form. Browsers don't let a page open `view-source:` links, so you copy it and paste it into a new tab's address bar yourself.
2. Copy the whole page source from that tab and paste it into the textbox.
3. **Extract** reads the JSON embedded in the page. For each slide it keeps the best video (ranked by the resolution in its encode tag) and the largest picture. A slide with no video is an image.

Each slide has its own Video | Thumbnail (or Image) switcher. The "Show all as" switcher in the header changes every slide at once.

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
