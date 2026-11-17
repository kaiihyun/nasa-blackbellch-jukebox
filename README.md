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

Every button has a key, shown on the button and announced by screen readers (`aria-keyshortcuts` plus a spoken "Shortcut: X"). Press `?` in the app for the full list.

| Where | Key | Action |
| --- | --- | --- |
| Everywhere | `Esc` | Back one screen, or close a sheet or error |
| Everywhere | `A` / `?` / `T` | About / Setting and shortcuts / text size |
| Mode screen | `1` / `2` | Location mark / Sweep |
| Carousel | `←` `→`, `Enter` | Change dataset, start |
| Upload cards | `V` / `L` | Upload video / upload legend |
| Upload form | `I`, `U`, `Enter` | Next instrument, next texture, load |
| Location player | `Space`, `K`, `D` | Play or pause, sound key, describe |
| Location player | `I`, `U`, `X` | Instrument, scene, speed (Slow → Normal → Fast) |
| Location player | `1`–`9` | Mute or unmute a row in "Playing now" |
| Location player | `←` `→` `↑` `↓`, `N`, `M` | Move the spot, named places, focus the map |
| Sweep player | `Space`, `P`, `R`, `D` | Play, panning, restart, describe |
| Error screen | `R` / `Esc` | Try again / go back |

## Settings for developers

`locationmode/config.js`:

```js
ui: {
  showMixer: true,
  showScenePicker: true,
  showInstrumentStrip: true,   // laptop only: a column of instrument buttons between the video and the sidebar
  duckWhileSpeaking: false
}
```

All colors, sizes, glass look and the player panel width are in `css/tokens.css`:

- `--panel-w` is the width of both player panels (75% of the screen on a laptop, capped at 1180px).
- `--glass-*` restyle every glass surface at once.

## Adding data

- **Location mark datasets:** `locationmode/config.js`, in `presets`. Each needs a video, a legend picture and its min, max and scale.
- **Sweep tracks:** `sweepmode/presets.js`. A track on the built-in temperature map only needs a video.
- Put videos in `assets/videos/` and legend pictures in `assets/legends/`. Folder names are set in `js/paths.js`.
- Instruments and scenes can be added as plugins: put a file in `locationmode/instruments/custom/` or `locationmode/scenes/custom/`, then run `python3 tools/make-plugins.py`.

## Folder map

```
index.html            the DANIG page (landing, modes, carousel, Location player)
main_config.js        global settings
server.py             local server, video proxy, custom error page
css/                  tokens, base, glass, kit (components), loader (loading and error screens)
js/                   paths, loader, error, bridge, ui, hotkeys, fit, glass
locationmode/         Location mark: config, engine, upload form, plugins, layout CSS
sweepmode/            Sweep: page, player, tracks, layout CSS
assets/               videos, legends, ui images (not in this repo's source files)
```

## Accessibility

- Every screen can be used with the keyboard alone, and nothing on the page scrolls.
- State changes are announced through live regions. Errors open a modal alert dialog that takes focus and reads its message.
- Text size (four steps) and glass opacity are in Setting.
- Motion is reduced when the system asks for it.

## Credits

Preset videos come from NASA's Earth Information Center (GMAO and GEOS-CF models, IMERG rain). Please check NASA's media usage guidelines before redistributing them.

## License

N/A
