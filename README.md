# DANIG: the world, through sound

www.danig.earth

DANIG turns visual data into soundscapes. The name comes from two Tagalog words, *daigdig* (the world) and *tinig* (sound). It plays preset videos from NASA's Earth Information Center as music, and you can upload your own video (or picture) and color bar.

It is plain HTML, CSS and JavaScript. There is no build step and nothing to install except Python, which serves the files.

## Run it

```bash
python3 server.py
```

Then open <http://localhost:8000>. (`python3 -m http.server` also works, but `server.py` adds a proxy for remote videos and a custom error page.)

Opening `index.html` by double-clicking will not work, because browsers block video analysis on `file://`.

## Modes

| Mode | What it does |
| --- | --- |
| **Location mark** | Pick one place on the map. You hear what happens there as the video plays: notes for the value, a nature texture, a drone for the whole planet. |
| **Sweep** | A glowing line sweeps west to east and plays every column it crosses. Panned left to right. |

Both modes end with an **Upload your own** card. It has two boxes: one for the video, one for the legend (a picture of the color bar). In Location mark the video must be an MP4. In Sweep the first box also accepts PNG and JPG pictures.

## Keyboard

Every button has a key. It shows on the right of the button text, and screen readers hear it (`aria-keyshortcuts` plus a spoken "Shortcut: X"). Press `?` in the app for the full list. All keys live in `globalconfig.js`, so changing one there changes the screen, the announcement and the shortcut list.

| Where | Key | Action |
| --- | --- | --- |
| Everywhere | `Esc` | Back one screen, or close a sheet or error |
| Everywhere | `A` / `?` / `T` | About / Settings and shortcuts / text size |
| Mode screen | `1` / `2` | Location mark / Sweep |
| Carousel | `←` `→`, `Enter` | Change dataset, start |
| Upload cards | `V` / `L` | Upload video / upload legend |
| Upload form | `I`, `U`, `Enter` | Next instrument, next texture, load |
| Location player | `Space`, `K`, `D` | Play or pause, sound key, describe |
| Location player | `I`, `U`, `X` | Instrument, scene, speed (Slow, Normal, Fast) |
| Location player | `1`–`9`, `0` | Pick that instrument (the buttons beside the video) |
| Location player | `Shift`+`1`–`9` | Mute or unmute a row in "Playing now" |
| Location player | `←` `→` `↑` `↓`, `N`, `M` | Move the spot, named places, focus the map |
| Sweep player | `Space`, `P`, `R`, `D` | Play, panning, restart, describe |
| Error screen | `R` / `Esc` | Try again / go back |

## Settings for developers

Everything global is in `globalconfig.js`:

1. Where files live (`DANIG.dirs`).
2. `DANIG.keys`: one key per button.
3. `CONFIG.ui`: on/off switches for features.
4. `CONFIG.globe`: the landing globe (`dimDelay`, `dimTime`, `noteGap`, and `colorShift`, the color drift, which is a developer setting with no switch for users).

The NASA SVS card (top right of the landing and mode screens) uses `assets/ui/nasa-svs.jpg`.

```js
CONFIG.ui = {
  showInstrumentStrip: true,   // laptop only: instrument buttons between the video and the sidebar
  showMixer: true,
  showScenePicker: true,
  showShortcutBadges: true,    // the key shown on each button
  showTextSize: true,
  showGlassOpacity: true,
  sweepAcceptsImages: true,    // PNG and JPEG in the Sweep upload card
  duckWhileSpeaking: false
};
```

Look and feel is in the `:root` block at the top of `styles.css`:

- Spacing uses an 8px scale: `--s1` is 8px, `--s2` 16px, up to `--s6`.
- `--panel-w` is the width of every player panel (75% of the screen on a laptop, capped at 1180px).
- Every glass surface (mode picker, carousel, players, sheets) uses the one `.glass` rule, so `--glass-*` restyles them together.

## Adding data

- **Location mark datasets:** `locationmode/config.js`, in `presets`. Each needs a video, a legend picture and its min, max and scale.
- **Sweep tracks:** `sweepmode/presets.js`. A track on the built-in temperature map only needs a video.
- Put videos in `assets/videos/` and legend pictures in `assets/legends/`. Folder names are set in `globalconfig.js`.
- Instruments and scenes can be added as plugins: put a file in `locationmode/instruments/custom/` or `locationmode/scenes/custom/`, then run `python3 tools/make-plugins.py`.

## Folder map

```
index.html            the DANIG page (landing, modes, carousel, Location player)
styles.css            the only stylesheet, shared by both modes
globalconfig.js       keys, feature switches, file paths
global.js             shared code: shortcut badges, key handling, sheets, loader, bridge to Sweep
server.py             local server, video proxy, custom error page
locationmode/         Location mark only: config, engine, upload form, instruments, scenes, plugins
sweepmode/            Sweep only: page, player, tracks
assets/               videos, legends, ui images
tools/                make-plugins.py
```

## Accessibility

- Every screen can be used with the keyboard alone, and nothing on the page scrolls.
- State changes are announced through live regions. Errors open a modal alert dialog that takes focus and reads its message.
- Text size (four steps) and glass opacity are in Settings.
- Motion is reduced when the system asks for it.

## Credits

Preset videos come from NASA's Earth Information Center (GMAO and GEOS-CF models, IMERG rain). Please check NASA's media usage guidelines before redistributing them.

## License

N/A
