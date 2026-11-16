/* Copy this file to locationmode/instruments/custom/<name>.js, edit it, then run  python3 tools/make-plugins.py */
LOC.instruments.register({
  id: "kalimba",                 // unique key (also usable in config.js timbres and legends: timbre: "kalimba")
  name: "Kalimba",               // label on the Instrument button, About sheet and upload form
  spoken: "kalimba",             // what a screen reader says in the Sound key
  desc: "Soft, plucked metal tines.",   // read out when the instrument is chosen
  gap: 0.5,                      // seconds between notes in the Sound key
  icon: '<path d="M9 3h6v18H9z"/>',     // filled 24x24 icon (inner SVG)
  outline: '<rect x="9" y="3" width="6" height="18" rx="1"/>',   // outline icon for the grid
  types: [],                     // data types that use it by default, e.g. ["ozone"]  (optional)
  cycle: true,                   // false = not reachable with the I key (still in the upload grid)
  // f = Hz, t = start time, v = loudness, g = gain node to shape, E = helpers (E.ctx, E.tone, E.noise, E.conv, E.mood, E.scale, E.envelope)
  play: function (f, t, v, g, E) {
    E.tone("sine", f, 1, t, 1.2, g);
    E.tone("sine", f * 4, 0.2, t, 0.3, g);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(v * 0.8, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.2);
  }
});
