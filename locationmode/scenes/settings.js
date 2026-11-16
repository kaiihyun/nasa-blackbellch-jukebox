/* SCENE SETTINGS (locationmode/scenes/settings.js)
   Global switches, the data-type map and the part defaults live HERE.
   The ready-made layers are in scenes/builtin.js. Your own layers go in scenes/custom/*.js and register themselves:
       LOC.scenes.register("myLayer", { name: "My layer", types: ["some_type"], describe: "...", pad: {...}, ... });
   name = label in the U button and upload form, types = data types that use it by default,
   upload:false = hide it from the upload form. Run  python3 tools/make-plugins.py  to list new files.
   See locationmode/templates/scene.template.js. The parameter rules below apply to every layer. */
/* ============================================================
   SCENE LAYERS: the nature sound under the notes.
   THIS IS THE ONLY FILE YOU EDIT to add or change a layer.
   (scene-engine.js is the shared engine. app.js never changes.)

   HOW A LEGEND FINDS ITS LAYER
     config.js legend  type: "liquid"   ->  byType (below)  ->  layer name  ->  layers (below)
     A legend can skip byType with   scene: "ocean"   in config.js.

   ADD A NEW LAYER IN 3 STEPS
     1. Copy a layer in  layers  below, give it a new name, change its numbers.
     2. Point a data type at it in  byType,  or put  scene: "yourName"  on one legend.
     3. Reload. Done. Nothing else changes.
        (The instrument for that data type is separate: config.js timbres + noteGain.)

   EVERY LAYER CAN HAVE
     describe   text read out by the Sound key (K)
     extends    start from another layer and change only what differs
     pad        sustained buzzy chord, one voice per latitude row
     drops      short notes: "drip" (falls) or "ice" (glassy)
     hiss       filtered noise bed: rain, wind, sea. swell adds a wave-like pulse
     reverb     extra reverb for this layer, 0 to 1
     drive      what moves the [low, high] ranges:
                "value" (default, the data value), "anomaly" (warmer or wetter than normal),
                "lat" (north = high)
     params + custom   your own code (see the examples at the bottom)

   PARAMETER RULES
     [a, b]   follows the data: a when the value is lowest, b when highest
     a number  stays fixed
     on        true or false: this part is switched on or off
     octave    0 = same register as CONFIG.lowMidi, 1 = octave up, -1 = octave down
     Every pitch comes from CONFIG.lowMidi and CONFIG.scale, so layers are always in key with your notes.
   ============================================================ */
window.SCENE_LAYERS = {
  enabled: true, // false = no nature layers at all (notes only)
  parts: { pad: true, drops: true, hiss: true, extras: true },  // false = off in every layer
  gain: 1, // overall loudness of every layer
  rootMidi: null, // null = follow CONFIG.lowMidi

  /* data type (config.js legend type)  ->  layer name */
    byType: {
    liquid: "rain",
    frozen: "snow",
    temperature: "heat",
    seatemperature: "sea",
    carbon_monoxide: "smoke",
    ozone: "air",
    nitrogen_oxide: "city",
    default: "none",
  },

  /* what a part looks like when a layer does not mention it */
  defaults: {
    pad: {
      on: false,
      wave: "sawtooth",
      gain: 0.05,
      octave: -1,
      cutoff: [300, 3000],
      detune: [0, 20],
    },
    drops: {
      on: false,
      kind: "drip",
      gain: 1,
      octave: 1,
      tempo: [60, 120],
      density: 0.45,
      maxPerStep: 4,
    },
    hiss: {
      on: false,
      type: "bandpass",
      gain: 0.25,
      floor: 0,
      freq: [2500, 4500],
      q: 0.6,
      swell: null,
    },
    reverb: 0.3,
  },

  layers: {},
};

(function () {
  "use strict";
  var LOC = (window.LOC = window.LOC || {}), SL = window.SCENE_LAYERS;
  function pretty(id) { return id.replace(/([A-Z])/g, " $1").replace(/^./, function (c) { return c.toUpperCase(); }); }
  LOC.scenes = {
    register: function (id, def) {
      SL.layers[id] = def;
      (def.types || []).forEach(function (t) { SL.byType[t] = id; });
    },
    registerAll: function (o) { Object.keys(o).forEach(function (k) { LOC.scenes.register(k, o[k]); }); },
    label: function (id) { var d = SL.layers[id]; return (d && d.name) || pretty(id); },
    list: function () {
      return Object.keys(SL.layers).map(function (id) {
        var d = SL.layers[id];
        return { id: id, name: (d.name) || pretty(id), upload: d.upload !== false, uploadDefault: !!d.uploadDefault };
      });
    }
  };
})();
