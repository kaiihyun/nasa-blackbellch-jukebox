/* Copy this file to locationmode/scenes/custom/<name>.js, edit it, then run  python3 tools/make-plugins.py
   Parameter rules are explained in locationmode/scenes/settings.js. */
LOC.scenes.register("breeze", {
  name: "Breeze",                    // label on the U button and upload form
  types: [],                         // data types that use it by default, e.g. ["carbon_monoxide"]  (optional)
  upload: true,                      // false = hide from the upload form
  describe: "A soft breeze that gets brighter as the value rises.",   // read out by the Sound key
  pad:   { on: false },
  drops: { on: false },
  hiss:  { on: true, type: "bandpass", gain: 0.08, freq: [1200, 3500], q: 0.5, swell: [0.1, 0.5] },
  reverb: 0.4
  // extends: "rain",                // start from another layer and change only what differs
  // params + custom: function (env, P) { return { update: function (d) {}, silence: function () {} }; }
});
