/* ============================================================
   GLOBAL CONFIG. Everything that both modes share and a developer may change.
   Loaded first by index.html and sweepmode/sweep.html.
     1. Where files live
     2. Keyboard: one key per button
     3. Switches: turn features on or off
     4. The "Upload your own" card
   Look and feel (colors, glass, 8px spacing): styles.css, :root block.
   Location mark settings: locationmode/config.js. Sweep tracks: sweepmode/presets.js.
   ============================================================ */
window.DANIG = window.DANIG || {};
window.CONFIG = window.CONFIG || {};

/* ---------- 1. Where files live ----------
   Pages in a subfolder (sweepmode/) set <html data-root="../"> so DANIG.url() can reach the site root.
   Config files write site-root paths, e.g. DANIG.video("lst.mp4") = "assets/videos/lst.mp4". */
(function (D) {
  "use strict";
  D.root = document.documentElement.getAttribute("data-root") || "";
  D.dirs = { videos: "assets/videos/", legends: "assets/legends/", ui: "assets/ui/" };   /* rename a folder here and everything follows */
  D.video = function (n) { return D.dirs.videos + n; };
  D.legend = function (n) { return D.dirs.legends + n; };
  D.ui = function (n) { return D.dirs.ui + n; };
  D.url = function (p) { return /^(https?:|data:|blob:|\/)/.test(p) ? p : D.root + p; };   /* site-root path -> path from THIS page */
})(window.DANIG);

/* ---------- 2. Keyboard ----------
   One key for every button. global.js shows it on the button (to the right of the text) and tells screen readers
   (aria-keyshortcuts plus the spoken words "Shortcut: ..."). Change a value here and the screen follows.
   Values are KeyboardEvent.key names: letters (case does not matter), digits, symbols, "Enter", " " (Space),
   "Escape", "ArrowLeft", "ArrowRight". "Shift+1" means Shift held. A list gives one key per button in a row. */


 DANIG.keys = {
  /* top bar and screens */
  exit: "Escape",
  about: "A",
  svs: "N",      
  settings: "?",
  start: "Enter",              
  
  /* landing Start and the carousel Play */
  modeLocation: "1",
  modeSweep: "2",
  prev: "ArrowLeft",
  next: "ArrowRight",
  
  /* upload card and upload form */
  uploadVideo: "V",
  uploadLegend: "L",
  load: "Enter",
  cancel: "Escape",
  
  /* players */
  play: " ",                   /* Space */
  soundKey: "K",
  describe: "D",
  speed: "X",                  /* Location mark: Slow, Normal, Fast */
  instrument: "I",             /* next instrument; with Shift, the one before */
  scene: "U",                  /* next background texture; with Shift, the one before */
  instrumentPick: ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"],   /* the instrument buttons beside the video, top to bottom */
  mute: ["Shift+1", "Shift+2", "Shift+3", "Shift+4", "Shift+5", "Shift+6", "Shift+7", "Shift+8", "Shift+9", "Shift+0"],   /* rows of "Playing now" */
  
  /* keys that have no button */
  textSize: "T",
  silence: "S",
  pan: "P",
  restart: "R",
  focusMap: "M",
  nextPlace: "N",
  slower: "[",
  faster: "]",
  volumeDown: "-",
  volumeUp: "=",
  seekBack: ",",
  seekForward: "."

};

/* ---------- 3. Switches (developers only: nothing on screen turns these on or off) ---------- */
CONFIG.ui = {
  showInstrumentStrip: true,   /* laptop only: one button per instrument between the video and the sidebar (Location mark player) */
  showMixer: false,             /* the "Playing now" list with one spectrum and a mute button per sound layer */
  showScenePicker: true,       /* the background texture button and its key */
  showShortcutBadges: true,    /* the key shown to the right of each button's text (screen readers always hear it) */
  showTextSize: true,          /* the "Text size" control in Settings */
  showGlassOpacity: true,      /* the "Glass opacity" slider in Settings */
  sweepAcceptsImages: true,    /* Sweep upload card: PNG and JPEG pictures are allowed next to videos */
  duckWhileSpeaking: false     /* true = lower the music while announcements are read */
};

/* ---------- 3a. Interface sounds (sfx.js): a note for every button that does something ---------- */
CONFIG.sfx = {
  enabled: true,
  volume: 0.4,                  /* level of all interface sounds, 0 to 1 */
  majorMidi: 76,                /* bright major arpeggio: Space, Enter, Play, Start, Next, cards, opening a sheet */
  minorMidi: 69,                /* softer falling minor: Exit, Cancel, Pause, closing a sheet */
  sizeMidi: [48, 57, 66, 76],   /* text size Normal, Large, Extra large, Largest: low to high (a plucked sound, unlike the bells) */
  shifts: [-5, -3, 0, 2, 4],    /* the major and minor sounds start on a different note each time, picked from these semitone shifts. [0] = always the same */
  clickVolume: 0.7,             /* the faint click of About, Settings and NASA SVS */
  thud: true,                   /* faint dull tap when you click empty space in the Location player */
  thudVolume: 0.35
};

/* ---------- 3b. The 3D globe: the "music disc" on the landing page (space.js) ----------
   It sits exactly over the circle of the landing page, starts grey and blurry, fades into colour, spins clockwise,
   and is removed completely when you press Start (and built again when you come back). */

CONFIG.globe = {
  enabled: true,
  spin: 40,           /* seconds for one clockwise turn of the disc, 0 = no disc spin */
  speed: 0.5,         /* the globe's own turning, 0 = still */
  lat: 14, lng: 121,  /* the point facing you at the start */
  glowColor: "#5aa9ee",
  blur: 3,             /* px of blur on the grey globe (it stays grey; the mouse reveals colour) */
  radius: 0.5,         /* size of the colour circle around the mouse, as a fraction of the globe's width */
  hueSpeed: 20,        /* degrees per second the colours drift while hovering. 0 = no drift */
  bars: 20,            /* bars in the 3D spectrum ring that rises at the mouse */
  ring: 5,             /* radius of that ring, in degrees of the globe */
  barHeight: 0.3,      /* tallest bar, as a fraction of the globe's radius */
  colorShift: false,    /* the color drift while hovering. Developers only: there is no switch for it in Settings */
  hoverSound: true,    /* the instrument plays under the mouse (starts after the first click or key press) */
  instrument: "accordion",
  lowMidi: 55,         /* lowest note; the top of the globe is three octaves higher */
  volume: 0.3,
  dimDelay: 0,          /* seconds after the globe starts rising before it begins to blur and go grey */
  dimTime: 2,           /* seconds the blur and grey take to fully arrive */
  noteGap: 110          /* ms between notes when you glide over the globe (lower = more flowing) */
  /* texture: "assets/ui/your-map.jpg"   <- optional: your own equirectangular map instead of the CDN one */
};


/* ---------- 3d. The intro (intro.js) ----------*/
CONFIG.intro = {
  enabled: true,        /* false = no intro (also skipped when the visitor asks for reduced motion) */
  gate: true,           /* "Tap to begin" screen. false = starts at once, but the sparkles are silent unless sound is already unlocked */
  title: "DANIG",         /* the giant word on the start screen */
  titleHue: null,         /* starting colour 0-360. null = a random colour every visit */
  titleSpread: 90,        /* degrees of hue the gradient travels through (small = calm, 180 = rainbow-ish) */
  titleFlow: 6,           /* s for the colours to flow once from left to right */
  gateText: "Tap anywhere to start",
  gateKeyText: "or press Space to start",   /* shown only on laptops and desktops (mouse + keyboard) */
  earthFade: 3,         /* s for the black to fade away and show the Earth */
  blur: 2,              /* px of blur on the grey Earth at the start */
  clearTime: 2,         /* s the Earth takes to turn sharp and coloured after the burst */
  clearAfter: true,     /* false = after the intro the Earth goes back to grey and blurry (the mouse reveals colour) */
  startDelay: 0,      /* s from the moment the Earth begins to show until the first bar */
  fillTime: 6,          /* s for the whole ring to fill, clockwise */
  growTime: 0.2,        /* s one bar takes to rise */
  holdMin: 0.2,         /* s the full ring waits before the burst (longer if the page is still loading) */
  maxWait: 7,           /* s after page start; then the burst happens even if a file is missing */
  bars: 48,
  startDeg: -90,        /* first bar: -90 = top, then clockwise */
  innerRadius: 0.94,    /* where bars begin, as a fraction of the Earth's radius (below 1 = hidden behind the Earth) */
  minLength: 0.14, maxLength: 0.55,   /* shortest and tallest bar */
  segHeight: 0.045, segGap: 0.02,     /* each bar is a stack of rounded dashes */
  barFill: 0.62,        /* dash width as a share of its slot */
  hueStart: 120, hueDir: -1,          /* first bar's hue and which way it turns (-1 = green, yellow, red, purple, blue, cyan) */
  saturation: 90, lightness: 55,
  glow: 0.3, glowSize: 1.8,           /* glow strength 0..1, and its width as a multiple of a dash */
  idleWiggle: true,     /* the full ring flickers like a live spectrum while it waits */
  burstTime: 2.8,       /* s for the notes to fly out and fade */
  burstSpeed: 1.6,      /* how far they fly, in Earth radii */
  burstDust: 140,       /* extra glitter */
  noteGlyphs: 0.12,     /* share of the pieces drawn as ♪ ♫ */
  sound: true,
  volume: 0.5, echo: 0.3,
  lowMidi: 60, octaves: 4, decay: 1.1,   /* fill notes: lowest note, octaves covered, ring time (s) */
  awardNotes: 40, awardTime: 1.8, awardLowMidi: 72   /* the "award" sparkle at the burst */
  /* scale: [0, 2, 4, 7, 9]   <- optional: defaults to CONFIG.scale, else pentatonic */
};


/* ---------- 3c. Stars: the light "Stardust" background (space.js) ----------
   density = stars per 10,000 px of screen (5 is about 1,000 on a 1080p screen). The stars cover the whole screen. Lower it if a device lags. */
CONFIG.stars = {
  density: 5,
  speed: 12,          /* px per second of drift */
  fps: 30,
  color: "#C8E9FF",
  angle: 121,         /* 0 = up, 90 = right, 180 = down */
  flicker: 1          /* 0 = steady, 2 = twice as fast */
};

/* ---------- 4. The "Upload your own" card (the last card of each carousel) ----------
   Two boxes, no text: the video (Sweep also takes PNG and JPEG) and the legend picture. */
CONFIG.sweepUpload = {
  name: "Upload your own",
  description: "",
  theme: { colors: ["#e5e5e5", "#737373", "#404040"], fixed: true },
  videoUrl: "", legends: [], sweep: true, trackId: "__upload__"
};
