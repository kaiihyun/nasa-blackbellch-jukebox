/* scenes/builtin.js: the ready-made nature layers. Edit numbers here; add new layers in scenes/custom/. */
function softWarn(env, P) {
  var last = -99;
  return function (d) {
    var t = env.ctx.currentTime;
    if (d.norm < P.threshold || t - last < P.minGap) return;
    last = t;
    var f = env.freq(0, -1);
    env.voice(f, t + 0.02, "lyre", P.level, d.pan);
    env.voice(f * 1.0595, t + 0.02, "lyre", P.level * 0.8, d.pan); // a semitone above: gentle unease
  };
}


/* Kenan's drone: two quiet sines (A1 + E2) so a calm place is never fully silent */
function kenanDrone(env, P) {
  var g = env.ctx.createGain();
  g.gain.value = 0;
  g.connect(env.out);
  [55, 82.41].forEach(function (f) {
    var o = env.ctx.createOscillator();
    o.frequency.value = f;
    o.connect(g);
    o.start();
  });
  return {
    update: function () { g.gain.setTargetAtTime(P.level, env.ctx.currentTime, 0.3); },
    silence: function () { g.gain.setTargetAtTime(0, env.ctx.currentTime, 0.2); }
  };
}


LOC.scenes.registerAll({
    /* ---------- ready-made layers ---------- */

    /* ---------- rain, snow, heat and sea (the sea layer is the swell for sea temperature) ---------- */
    heat: {
      describe: "Heat: a buzzing pad that brightens as it gets hotter, with glassy chimes.",
      pad:   { on:true, wave:"sawtooth", gain:0.05, octave:-1, cutoff:[200,2800], detune:[4,30] },
      drops: { on:true, kind:"ice", gain:1, octave:2, tempo:[64,128], density:0.45 },
      hiss:  { on:true, type:"bandpass", gain:0.05, freq:[2500,4500] },
      reverb: 0.45,
      params: { level: 0.03 },
      custom: function (env, P) { return kenanDrone(env, P); }
    },
    sea: {
      describe: "Ocean: a soft, deep swell with shimmering chimes. Warmer means faster, brighter.",
      pad:   { on:true, wave:"triangle", gain:0.05, octave:-1, cutoff:[150,1800], detune:[3,14] },
      drops: { on:true, kind:"ice", gain:1, octave:2, tempo:[52,96], density:0.45 },
      hiss:  { on:true, type:"bandpass", gain:0.04, freq:[2500,4500] },
      reverb: 0.7,
      params: { level: 0.03 },
      custom: function (env, P) { return kenanDrone(env, P); }
    },
    rain: {
      describe: "Rain: drips and a wash, with a low rumble under heavy rain.",
      pad:   { on:true, wave:"sawtooth", gain:0.03, octave:-1, cutoff:[90,350], detune:[2,6] },
      drops: { on:true, kind:"drip", gain:1, octave:1, tempo:[66,120], density:0.45 },
      hiss:  { on:true, type:"bandpass", gain:0.07, freq:[2500,4500] },
      reverb: 0.45,
      params: { level: 0.03 },
      custom: function (env, P) { return kenanDrone(env, P); }
    },
    snow: {
      describe: "Snow: soft, muffled chimes and a hush.",
      pad:   { on:true, wave:"triangle", gain:0.035, octave:-1, cutoff:[100,500], detune:[2,6] },
      drops: { on:true, kind:"ice", gain:0.6, octave:2, tempo:[48,84], density:0.45 },
      hiss:  { on:true, type:"bandpass", gain:0.03, freq:[1500,3000] },
      reverb: 0.8,
      params: { level: 0.03 },
      custom: function (env, P) { return kenanDrone(env, P); }
    },
    ocean: {
      describe: "Ocean swell: warmer water means faster, brighter waves.",
      pad: {
        on: true,
        wave: "sine",
        gain: 0.04,
        cutoff: [200, 900],
        detune: [0, 6],
      },
      hiss: {
        on: true,
        type: "lowpass",
        gain: 0.12,
        floor: 0.5,
        freq: [350, 1250],
        q: 0.5,
        swell: [0.08, 0.33],
      },
      reverb: 0.4,
    },

    /* ---------- examples of custom code layers (copy these to make your own) ----------

       custom: function (env, P) { ...build once...; return { update: function (d) {...}, silence: function () {...} }; }

       P   = this layer's params object (the numbers you tune at the top)
       env = the main audio engine, handed to you:
         env.ctx                  the shared AudioContext
         env.out                  scene bus (goes to master volume and reverb). Connect your sound here.
         env.reverb               the reverb node, for an extra send
         env.voice(hz, when, kind, vol, pan)   play ANY of your app instruments (bell, harp, flute...)
         env.freq(i, octave)      note i of your scale as Hz (i = 0 is the lowest)
         env.noiseBuffer()        shared white noise buffer
         env.bed(type, hz, q)     looping filtered noise, returns a handle ...
         env.steer(handle, gain, hz)   ... and this glides it to a new loudness / pitch
         env.lerp([a,b], t)       a to b by t (0..1)
         env.clamp01(x)
       d   = the data, every reading:
         d.norm      0..1 position of the value on its legend
         d.value     the real number (degrees, mm/hr...)
         d.type      the legend type
         d.anomaly   how far above this place's normal (0 if none yet)
         d.rows[]    0..1 strength per latitude row, north first (whole-map views), or the spot's row
         d.pan       -1 (left, west) .. 1 (right, east)
         d.lat, d.lon   the listening spot
         d.rate      playback speed
         d.ms        length of this reading in ms
         d.view      "spot", "map" or "chord"
    */

    thunderstorm: {
      upload: false, // false = not offered in the upload form
      extends: "rain", // everything from rain, plus thunder
      describe: "Rain, with distant thunder when the rain is extreme.",
      params: { threshold: 0.85, minGap: 8, level: 0.6, length: 3.5 },
      custom: function (env, P) {
        var last = -99;
        function rumble(t) {
          var c = env.ctx,
            s = c.createBufferSource(),
            f = c.createBiquadFilter(),
            g = c.createGain();
          s.buffer = env.noiseBuffer();
          s.loop = true;
          f.type = "lowpass";
          f.frequency.setValueAtTime(220, t);
          f.frequency.exponentialRampToValueAtTime(40, t + P.length * 0.85);
          g.gain.setValueAtTime(0.0001, t);
          g.gain.exponentialRampToValueAtTime(P.level, t + 0.15);
          g.gain.exponentialRampToValueAtTime(0.0001, t + P.length);
          s.connect(f);
          f.connect(g);
          g.connect(env.out);
          s.start(t);
          s.stop(t + P.length + 0.5);
        }
        return {
          update: function (d) {
            var t = env.ctx.currentTime;
            if (d.norm > P.threshold && t - last > P.minGap) {
              last = t;
              rumble(t + 0.02);
            }
          },
          silence: function () {},
        };
      },
    },

    warmer: {
      upload: false,
      extends: "ocean", // ocean swell, plus a low bell when a place is above its own normal
      describe:
        "Ocean swell. A low bell tolls when the water is warmer than this place usually is.",
      params: {
        threshold: 0.15,
        minGap: 4,
        kind: "bell",
        octave: -1,
        level: 0.3,
      },
      custom: function (env, P) {
        var last = -99;
        return {
          update: function (d) {
            var t = env.ctx.currentTime;
            if (d.anomaly > P.threshold && t - last > P.minGap) {
              last = t;
              env.voice(
                env.freq(0, P.octave),
                t + 0.02,
                P.kind,
                Math.min(P.level, d.anomaly + 0.1),
                d.pan,
              );
            }
          },
          silence: function () {},
        };
      },
    },
    air: {
      describe: "Thin, glassy air: more sparkle and a brighter shimmer mean more ozone.",
      pad:   { on:true, wave:"sine", gain:0.03, octave:0, cutoff:[500,3000], detune:[0,25] },
      drops: { on:true, kind:"ice", gain:0.3, octave:1, tempo:[30,75], density:0.25 },
      hiss:  { on:true, type:"highpass", gain:0.025, freq:[4000,8000] },
      reverb: 0.55,
      params: { threshold: 0.85, minGap: 8, level: 0.1 },
      custom: function (env, P) { var w = softWarn(env, P); return { update: w, silence: function () {} }; }
    },

    city: {
      describe: "A low city hum, like distant engines and ships. Faster, brighter pulses mean more nitrogen oxides.",
      pad:  { on:true, wave:"triangle", gain:0.035, octave:-1, cutoff:[150,700], detune:[0,10] },
      hiss: { on:true, type:"lowpass", gain:0.1, floor:0.3, freq:[200,700], q:0.6, swell:[0.12,0.6] },
      reverb: 0.3,
      params: { threshold: 0.85, minGap: 8, level: 0.1 },
      custom: function (env, P) { var w = softWarn(env, P); return { update: w, silence: function () {} }; }
    },

    intense: {
      uploadDefault: true, // first choice in the upload form
      describe: "Intense texture: a low pulsing rumble that gets faster, brighter and rougher as the value rises.",
      pad:  { on:true, wave:"sawtooth", gain:0.05, octave:-1, cutoff:[200,2500], detune:[0,40] },
      hiss: { on:true, type:"lowpass", gain:0.13, floor:0.3, freq:[300,1800], q:0.8, swell:[0.2,1.4] },
      reverb: 0.35,
      params: { threshold: 0.85, minGap: 6, level: 0.12 },
      custom: function (env, P) { var w = softWarn(env, P); return { update: w, silence: function () {} }; }
    }
});
