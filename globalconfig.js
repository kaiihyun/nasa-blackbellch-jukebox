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
  settings: "?",
  start: "Enter",              /* landing Start and the carousel Play */
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
  colorShift: "C",             /* Earth color shift on or off (Setting) */
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
  showMixer: true,             /* the "Playing now" list with one spectrum and a mute button per sound layer */
  showScenePicker: true,       /* the background texture button and its key */
  showShortcutBadges: true,    /* the key shown to the right of each button's text (screen readers always hear it) */
  showTextSize: true,          /* the "Text size" control in Setting */
  showGlassOpacity: true,      /* the "Glass opacity" slider in Setting */
  sweepAcceptsImages: true,    /* Sweep upload card: PNG and JPEG pictures are allowed next to videos */
  duckWhileSpeaking: false     /* true = lower the music while announcements are read */
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
  colorShift: false,    /* the color drift while hovering. The On/Off switch in Setting overrides this */
  hoverSound: true,    /* the instrument plays under the mouse (starts after the first click or key press) */
  instrument: "accordion",
  lowMidi: 55,         /* lowest note; the top of the globe is three octaves higher */
  volume: 0.3,
  dimDelay: 4,          /* seconds after the globe starts rising before it begins to blur and go grey */
  dimTime: 2,           /* seconds the blur and grey take to fully arrive */
  noteGap: 110          /* ms between notes when you glide over the globe (lower = more flowing) */
  /* texture: "assets/ui/your-map.jpg"   <- optional: your own equirectangular map instead of the CDN one */
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
