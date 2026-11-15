# DANIG: the world, through sound

DANIG turns NASA Earth-data videos into sound you can explore. It reads the color of each video frame, matches it against the video's color bar (its legend) to recover the real data value, and plays that value as music and nature texture.

It has two ways to listen, and both live in one carousel:

| Mode | Where | How you listen |
| --- | --- | --- |
| **Location mark** | The main DANIG presets (IMERG rain, temperature, CO, O3, NOx, and your own upload) | You pick one place on the map. Every 250 ms the color at that spot becomes a note plus a nature texture. |
| **Sweep** | The Earth Jukebox tracks (`jukebox/`) | A line sweeps west to east across the picture. Each of 14 rows is a note, and every column under the line plays. |

The Earth Jukebox tracks show up in the same carousel. Pressing Play on one opens the Earth Jukebox player on top; Exit (or Esc) lands you back on the carousel.

---

## Run it

The page loads videos and pictures at run time, so it must be served. Double-clicking `index.html` will not work.

```
python3 server.py
```

Then open <http://localhost:8000>. `server.py` is a small static server with a `/proxy?url=` helper, used when a video lives on another site that does not allow direct access.

## Folder layout

```
index.html            the page
style.css             base layout
glass.css             the DANIG look (loaded after style.css, only overrides)
config.js             presets, places, instruments, scale, analysis settings
app.js                audio, analysis, playback (the engine)
ui.js                 landing screen, About/Setting sheets, text size, keyboard shortcuts
loader.js             the loading screen (logo with orbiting notes)
bridge.js             puts the Earth Jukebox tracks into the carousel
scene-layers.js       the nature-sound layers (the file you edit)
scene-engine.js       shared machinery for scene-layers.js (leave alone)
server.py             local web server + proxy
make-thumbnails.py    saves one JPG frame beside every MP4
assets/               DANIG videos, legend pictures, earth.png, danig_logo.svg
jukebox/
  jukebox.html        the Earth Jukebox player page
  jukebox.js          its engine
  presets.js          its track list
  style.css           its styles
  media/              its videos and legend pictures
```

## What happens when you press Play

1. A loading screen (the logo with notes orbiting it and a progress bar) comes up. It is the same screen for every preset, DANIG or jukebox.
2. The legend picture is read and the video is loaded in full.
3. Only when both are ready and the bar reaches 100% does the player open, and only then can sound start.

While loading, the keyboard is locked so you can not move to another preset by accident. **Esc cancels** the load and returns you to the carousel. If a file can not be loaded, you get a message and nothing plays.

## Keyboard

### Carousel
| Key | Action |
| --- | --- |
| Left / Right | Previous or next dataset (jukebox tracks included) |
| 1 to 9 | Jump to a dataset |
| Enter or Space | Start, then open the player |
| A | About |
| ? | Setting and shortcuts |
| T | Change text size |
| Esc | Back one screen |

### Location-mark player (the DANIG presets)
| Key | Action |
| --- | --- |
| Space | Play or pause |
| **P** | **Panning on or off** |
| S | Silence now (pause) |
| Arrow keys | Move the listening spot |
| N / Shift+N | Next or previous named place |
| , and . | Seek back or forward 5 seconds |
| R | Restart from the beginning |
| K | Play the sound key (pauses playback) |
| D | Describe this moment |
| I / Shift+I | Next or previous instrument |
| U / Shift+U | Next or previous scene layer |
| V | Change video size |
| [ and ] | Slower or faster |
| - and = | Volume down or up |
| M | Focus the map |
| Esc | Back to the carousel |

### Sweep player (the Earth Jukebox)
| Key | Action |
| --- | --- |
| Space | Play or stop |
| **P** | **Panning on or off** |
| S | Stop the sound |
| R | Restart the sweep from the west |
| D | Describe this moment |
| [ and ] | Slower or faster sweep |
| - and = | Volume down or up |
| , and . | Video back or forward 5 seconds |
| O / L | Load an image or video / upload a legend |
| Esc | Back to the carousel |

The track can **not** be changed inside the sweep player (arrow keys and number keys are ignored there). Choose the track on the carousel, so the picture, legend and sound always match.

## Panning (P)

Panning places the sound between your ears.

- **Location mark:** west is in your left ear and east in your right, by the longitude of the spot.
- **Sweep:** the sound moves from left to right as the line sweeps west to east.

Press **P** in either player to switch it off; the sound is then centered. The setting is remembered (`danigPan` in the browser) and shared by both players, so turning it off in one also turns it off in the other.

## Adding a DANIG preset

Edit `config.js`, in `presets`:

```js
{
  name: "Carbon Monoxide (CO)",
  description: "Text shown on the carousel.",
  theme: { colors: ["#FFFCDA", "#FF6D20", "#E71F10"], fixed: false },
  videoUrl: "assets/co.mp4",
  mapCrop: { x: 0, y: 0, w: 1, h: 1 },   // part of the frame that holds the map
  wetMin: 70,                              // values below this count as "no signal"
  place: "Congo basin",                    // spot chosen by default
  legends: [{
    label: "CO (ppbv)", type: "carbon_monoxide", url: "assets/co_legend.png",
    min: 40, max: 500, scale: "linear",    // or "log"
    orientation: "horizontal-lowleft",     // where the lowest value is on the color bar
    crop: { x: 0, y: 0, w: 1, h: 1 }
  }]
}
```

- **Instrument:** `timbres` and `noteGain` in `config.js`, keyed by the legend `type`.
- **Nature sound:** `scene-layers.js`. Map a `type` to a layer in `byType`, or put `scene: "ocean"` on one legend. To make a new layer, copy one under `layers`, rename it and change the numbers. That is the only file you edit.
- **Places:** `places` (named spots for N) and `gazetteer` (names for any spot you click).

## Adding an Earth Jukebox track

Edit `jukebox/presets.js`. A track on the built-in temperature map only needs a video; a track with its own legend picture becomes a new map type. The comments at the top of that file list every option. Tracks appear in the carousel after the DANIG presets, using the same colors as a DANIG preset that has the same video file.

## Carousel pictures

The carousel shows a picture of each video. Run this once from the folder that holds `index.html` to save a JPG next to every MP4 (it needs [ffmpeg](https://ffmpeg.org)):

```
python3 make-thumbnails.py          # frame at 40% of the video
python3 make-thumbnails.py 0.6      # frame at 60%
```

Without the JPGs, the page takes a frame from the MP4 itself, which is slower.

## Upload your own

The last card, **Upload your own**, takes an MP4 and a picture of its color bar. Enter the lowest and highest value, say where the lowest value sits on the bar, and choose an instrument and background texture.

## Accessibility

Everything works from the keyboard, announcements go to a live region for screen readers, and text size (Normal to Largest) is in Setting (**?**). Reduced-motion preferences switch off the loading animation and the star twinkle.

## Notes

- `jukebox/build_single_file.py` is a leftover from the stand-alone Earth Jukebox. It expects the old `index.html` and a `media/` folder, so it does not apply to this layout.
- Browsers only allow sound after a click or key press, which is why starting a preset (not the page load) begins the audio.
