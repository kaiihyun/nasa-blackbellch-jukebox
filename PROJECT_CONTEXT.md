# PROJECT_CONTEXT.md

## Purpose
**DANIG** ("the world, through sound"; Tagalog *daigdig* + *tinig*) turns map-style data videos (NASA Earth Information Center / GMAO GEOS-CF / IMERG) into sound. Users play preset videos or upload their own video and a legend picture (an image of the color bar). The app decodes colors into data values and sonifies them. Public site: www.danig.earth (per README).

## Tech stack
- Plain HTML, CSS and vanilla JavaScript (mostly ES5-style IIFEs, some `async/await` in the Location engine). No build step, no package manager.
- Python 3 standard library only (`server.py`).
- Browser APIs: Web Audio, Canvas 2D, `<video>`, `<dialog>`, MutationObserver, ResizeObserver, `localStorage`, WebGL (via globe.gl).

## Folder structure and key files
(Layout taken from the README and the `<script>` paths in `index.html`.)

```
index.html          Main page: landing, mode picker, carousel, Location player, About/Settings dialogs
styles.css          Only stylesheet (tokens, glass look, screens, coverflow, loader); shared by both modes
globalconfig.js     DANIG.dirs (asset paths), DANIG.keys (all shortcuts), CONFIG.ui switches, CONFIG.globe, CONFIG.stars, CONFIG.sweepUpload
global.js           Shared logic: key badges, one keyboard dispatcher, About/Settings sheets, text size, glass opacity,
                    shortcut pager, loader, Sweep iframe bridge, landing/mode navigation, coverflow, dialog fit-to-screen
intro.js            SVG-mask "DANIG" zoom intro; fills in accepted formats on the Upload card
space.js            Starfield canvas and the 3D landing-page globe (hover color circle, 3D bars, hover notes)
server.py           Local static server plus /proxy endpoint
locationmode/      config.js (datasets, places, gazetteer, analysis), engine.js, upload-form.js, plugins.js,
                    instruments/ (registry.js, builtin.js, custom/), scenes/ (settings.js, builtin.js, engine.js, custom/)
sweepmode/          sweep.html (own page), sweep.js (player, audio, analysis), presets.js (track list)
assets/             videos/, legends/, ui/
tools/              make-plugins.py (referenced by README and plugins.js; not in the provided source)
```

## Architecture
A **frontend-only app**. The backend only serves files and proxies remote media.

**Script loading and namespaces**
- Plain globals loaded in a fixed order: `globalconfig.js`, `locationmode/config.js`, `sweepmode/presets.js`, `global.js`, instrument registry and built-ins, scene settings/built-ins/engine, `plugins.js`, `engine.js`, `upload-form.js`, `intro.js`.
- Namespaces: `window.DANIG` (paths, keys, helpers), `window.CONFIG`, `window.LOC` (instrument and scene registries), `window.SCENE_LAYERS` / `SceneLayers`, `window.EJ` (Sweep).

**Screens**
- Driven by `<body>` classes: `home`, `modes`, `playing`, `form`, `upload`.
- One capture-phase keydown dispatcher in `global.js` clicks any button with `data-act="name"` when its configured key is pressed.

**Location mark mode** (`locationmode/engine.js`)
- Each video frame is drawn to an analysis canvas and sampled on a grid (18×9).
- Pixel colors are matched to the decoded legend (128-sample color table read from the legend image).
- The user picks a spot (click map/video, arrow keys, named places). The spot's legend value drives pitch, an instrument note, a scene layer and a planetary drone.
- Text readouts go through the `#live` region.
- Instruments register via `LOC.instruments`; scene layers (pad, drops, hiss, custom code) via `LOC.scenes`. Plugins in `custom/` folders are listed by `plugins.js`.

**Sweep mode** (`sweepmode/`)
- Runs in its own page (`sweep.html`), loaded as a full-screen **iframe** and driven by the bridge in `global.js`.
- Each frame is reduced to 64×14 cells and matched to a legend. A line sweeps west to east and plays the columns under it (pad, drops, noise), panned left to right.
- Legends are read from images (`readLegend`); tracks come from `EJ.PRESETS`. The temperature legend is hard-coded.

**Carousel**
- Shared by both modes, rebuilt per mode by `setMode`; 3D coverflow from `DANIG.coverflow`. The last card of each mode is "Upload your own".

## Database and external integrations
- **Database:** none.
- **Browser storage:** `localStorage` keys `danigSize`, `danigGlass`, `danigPan`, `danigHue` (preferences only). Uploaded files live in memory as `File`/blob URLs.
- **External services:** Google Fonts (Poppins); jsDelivr CDN for `globe.gl` and the three-globe Earth texture/bump map (texture overridable via `CONFIG.globe.texture`); links to NASA SVS and NASA Earth Information Center.
- Preset videos and legends are local files in `assets/`.

## API communication and data flow
- No application API. Only server endpoint: `GET /proxy?url=<remote URL>` in `server.py`, forwarding `Range` and content headers and adding `Access-Control-Allow-Origin: *`. It only checks that the URL starts with `http(s)://`.
- The Location engine loads legends/videos directly first, then retries through the proxy (`CONFIG.proxyPath`).
- Flow: preset or uploaded file loads (with progress loader) → legend image → color/value table → video frame → canvas pixels → matched values → pitch, loudness, texture, chord mood → Web Audio output plus canvas/readout updates.
- The Sweep iframe is controlled by the parent through direct DOM and `window.EJ` access (same origin).

## Authentication
None. No accounts, sessions or secrets in the code.

## Deployment
- **Local:** `python3 server.py` → `http://localhost:8000` (`python3 -m http.server` works but lacks the proxy and custom error page).
- **Production:** no deployment config in the source. Hosted at www.danig.earth per README; hosting setup not provided. Any static host works, but the proxy fallback needs `server.py` or an equivalent.

## Constraints and notes
- Must be served over HTTP; `file://` fails because browsers block pixel reads from video.
- Cross-origin videos need CORS headers or the proxy, otherwise canvas `getImageData` is tainted.
- Audio needs a user gesture; the code primes/resumes audio on key press or click.
- Location mode accepts MP4 only; Sweep also accepts PNG/JPG. Legends: PNG, JPG, WEBP or GIF.
- Pages do not scroll by design; dialogs and forms scale to fit. Reduced motion is respected.
- Accessibility is core: configurable key for every action, live regions, adjustable text size and glass opacity.
- Global scope and load order matter in `index.html` and `sweep.html`.
- Unresolved references in the provided code:
  - `global.js` uses a `colorShift` key and `#hueSeg` control that are not defined in `globalconfig.js` or `index.html`.
  - `engine.js` references `scaleBtn`, which is absent from `index.html`; scene layer `smoke` is mapped in `byType` but not defined.
  - README mentions `locationmode/templates/` and `tools/make-plugins.py`, which were not provided.
- `globe.gl` is loaded from an unpinned jsDelivr path. No dependency or lock files exist.
