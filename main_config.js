/* ============================================================
   GLOBAL CONFIG (both modes). Look and feel: css/tokens.css. Paths: js/paths.js.
   Location mode settings: locationmode/config.js. Sweep tracks: sweepmode/presets.js.
   ============================================================ */
window.CONFIG = window.CONFIG || {};

/* The last card of the Sweep carousel. Play opens the sweep player empty, ready for your own picture or video and legend. */
CONFIG.sweepUpload = {
  name: "Upload your own",
  description: "Bring a picture or video and a picture of its color bar. Hear it swept from west to east.",
  theme: { colors: ["#e5e5e5", "#737373", "#404040"], fixed: true },
  videoUrl: "", legends: [], sweep: true, trackId: "__upload__"
};
