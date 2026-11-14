/* ============================================================
   SCENE ENGINE: shared machinery for scene-layers.js. You normally never edit this file.
   Based on kenan-audio.js (pad, drops, hiss), made config driven.

   app.js talks to it through four calls:
     SceneLayers.attach(host)     once, in initAudio(): host = { ctx, out, reverb, rows, voice }
     SceneLayers.feed(name, d)    every reading: d = data (see scene-layers.js)
     SceneLayers.silence()        no signal, pause, stop
     SceneLayers.describe(name)   text for the Sound key
     SceneLayers.has(name)        is there such a layer
   ============================================================ */
(function () {
  "use strict";
  var E = {}, ac, out, rev, host, R = 9, env;
  var pans = [], panPad, panDrops, panHiss, cout, revSend, lowpass, noise, noiseGain, bp, lfo, lfoAmt, voices = [];
  var timer = null, nextTime = 0, live = { rows: [], mean: 0, rate: 1 }, playing = false;
  var cache = {}, inst = {}, cur = null, vName = null, V = null, warned = {};

  function SL() { return window.SCENE_LAYERS || {}; }
  function gainAll() { return SL().gain != null ? SL().gain : 1; }
  function root() { return SL().rootMidi != null ? SL().rootMidi : (window.CONFIG.lowMidi || 48); }
  function lerp(r, t) { return r[0] + (r[1] - r[0]) * t; }
  function clamp01(x) { return Math.max(0, Math.min(1, x)); }
  function clamp(x) { return Math.max(-1, Math.min(1, x)); }
  function mix(a, b) { var o = {}, k; for (k in a) o[k] = a[k]; for (k in b) o[k] = b[k]; return o; }
  function warn(name, e) { if (!warned[name]) { warned[name] = 1; console.error("Scene layer '" + name + "':", e); } }

  /* a layer = defaults + (extends) + its own settings */
  function resolve(name, depth) {
    depth = depth || 0;
    var L = (SL().layers || {})[name] || {}, D = SL().defaults || {};
    var B = (L.extends && depth < 5) ? resolve(L.extends, depth + 1) : null;
    function part(k) { return mix(mix(D[k], B && B[k]), L[k]); }
    return {
      pad: part("pad"), drops: part("drops"), hiss: part("hiss"),
      reverb: L.reverb != null ? L.reverb : (B ? B.reverb : (D.reverb != null ? D.reverb : 0.3)),
      drive: L.drive || (B && B.drive) || "value",
      params: mix(B && B.params, L.params),
      custom: L.custom || (B && B.custom) || null,
      describe: L.describe || (B && B.describe) || ""
    };
  }
  function layer(name) {
  if (!cache[name]) {
    var L = resolve(name), p = SL().parts || {};
    if (p.pad    === false) L.pad   = mix(L.pad,   { on: false });
    if (p.drops  === false) L.drops = mix(L.drops, { on: false });
    if (p.hiss   === false) L.hiss  = mix(L.hiss,  { on: false });
    if (p.extras === false) L.custom = null;
    cache[name] = L;
  }
  return cache[name];
}

  /* note i (0 = lowest) of the app's scale, in Hz */
  function freq(i, octave) {
    var sc = window.CONFIG.scale, n = sc.length;
    var midi = root() + 12 * (octave || 0) + Math.floor(i / n) * 12 + sc[((i % n) + n) % n];
    return 440 * Math.pow(2, (midi - 69) / 12);
  }

  E.attach = function (h) {
    if (ac) return;
    host = h; ac = h.ctx; out = h.out; rev = h.reverb; R = h.rows || 9;

        revSend = ac.createGain(); revSend.gain.value = 0.3; revSend.connect(rev);
    function mkPan(id, label) {
      var p = ac.createStereoPanner();
      p.connect(h.channel ? h.channel(id, label) : out);
      p.connect(revSend); pans.push(p); return p;
    }
    panPad = mkPan("scene-pad", "Texture pad");
    panDrops = mkPan("scene-drops", "Texture drops");
    panHiss = mkPan("scene-hiss", "Texture noise");
    cout = h.channel ? h.channel("scene-custom", "Layer extras") : out;

    lowpass = ac.createBiquadFilter(); lowpass.type = "lowpass"; lowpass.Q.value = 2; lowpass.frequency.value = 300;
    lowpass.connect(panPad);
    for (var r = 0; r < R; r++) {                    // pad: two detuned oscillators per latitude row
      var g = ac.createGain(); g.gain.value = 0; g.connect(lowpass);
      var a = ac.createOscillator(), b = ac.createOscillator();
      a.type = b.type = "sawtooth"; a.frequency.value = b.frequency.value = 110;
      a.connect(g); b.connect(g); a.start(); b.start();
      voices.push({ g: g, a: a, b: b });
    }

    var sr = ac.sampleRate; noise = ac.createBuffer(1, sr * 2, sr);
    var nd = noise.getChannelData(0); for (var k = 0; k < nd.length; k++) nd[k] = Math.random() * 2 - 1;
    var ns = ac.createBufferSource(); ns.buffer = noise; ns.loop = true;
    bp = ac.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = 3500; bp.Q.value = 0.6;
    noiseGain = ac.createGain(); noiseGain.gain.value = 0;
    ns.connect(bp); bp.connect(noiseGain); noiseGain.connect(panHiss); ns.start();
    lfo = ac.createOscillator(); lfo.frequency.value = 0.1;     // swell: slow pulse on the hiss
    lfoAmt = ac.createGain(); lfoAmt.gain.value = 0;
    lfo.connect(lfoAmt); lfoAmt.connect(noiseGain.gain); lfo.start();

    /* what custom layers receive: the hooks into the main audio engine */
    env = {
      ctx: ac, out: cout, reverb: rev, rows: R,
      voice: h.voice, freq: freq, lerp: lerp, clamp01: clamp01,
      noiseBuffer: function () { return noise; },
      bed: function (type, hz, q) {
        var s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
        s.buffer = noise; s.loop = true; f.type = type; f.frequency.value = hz; f.Q.value = q || 0.7; g.gain.value = 0;
        s.connect(f); f.connect(g); g.connect(cout); s.start();
        return { f: f, g: g };
      },
      steer: function (b, gain, hz) {
        var t = ac.currentTime; b.g.gain.setTargetAtTime(gain, t, 0.25);
        if (hz) b.f.frequency.setTargetAtTime(hz, t, 0.25);
      }
    };
  };

  /* ---- pad, drops, hiss: the built-in recipe parts ---- */
  function applyVoice(name) {
    V = layer(name); vName = name;
    var now = ac.currentTime;
    for (var r = 0; r < R; r++) {
      voices[r].a.type = voices[r].b.type = V.pad.wave;
      var f = freq(r, V.pad.octave);
      voices[r].a.frequency.setTargetAtTime(f, now, 0.05); voices[r].b.frequency.setTargetAtTime(f, now, 0.05);
    }
    bp.type = V.hiss.type; bp.Q.value = V.hiss.q;
    revSend.gain.setTargetAtTime(V.reverb, now, 0.2);
    if (host.label) {
      var nm = name.replace(/([A-Z])/g, " $1").replace(/^./, function (c) { return c.toUpperCase(); });
      host.label("scene-pad", nm + " pad");
      host.label("scene-drops", nm + " drops");
      host.label("scene-hiss", nm + " noise");
      host.label("scene-custom", nm + " extras");
    }
  }
  function drop(i, when, vel) {
    var D = V.drops, ice = D.kind === "ice", f = freq(i, D.octave), k = D.gain * gainAll();
    var o = ac.createOscillator(), g = ac.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(ice ? f : f * 1.35, when);
    o.frequency.exponentialRampToValueAtTime(f, when + 0.07);
    g.gain.setValueAtTime(0, when);
    g.gain.linearRampToValueAtTime((0.03 + 0.14 * vel) * k, when + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0008, when + 1.4);
    o.connect(g); g.connect(panDrops); o.start(when); o.stop(when + 1.5);
    if (ice) {                                       // inharmonic overtone: rings like glass
      var o2 = ac.createOscillator(), g2 = ac.createGain();
      o2.type = "sine"; o2.frequency.value = f * 2.76;
      g2.gain.setValueAtTime(0, when);
      g2.gain.linearRampToValueAtTime((0.012 + 0.05 * vel) * k, when + 0.003);
      g2.gain.exponentialRampToValueAtTime(0.0005, when + 0.7);
      o2.connect(g2); g2.connect(panDrops); o2.start(when); o2.stop(when + 0.8);
    }
  }
  function scheduler() {                             // every 30 ms; schedules drops a little ahead
    if (!playing || !ac || !V || !V.drops.on) return;
    var D = V.drops, tempo = lerp(D.tempo, live.mean) * live.rate, step = 60 / tempo / 2, now = ac.currentTime;
    if (nextTime < now) nextTime = now + 0.05;
    while (nextTime < now + 0.15) {
      var n = 0;
      for (var r = 0; r < R && n < D.maxPerStep; r++) {
        var amt = live.rows[r] || 0;
        if (amt > 0 && Math.random() < amt * D.density) { drop(R - 1 - r, nextTime + Math.random() * 0.03, amt); n++; }
      }
      nextTime += step;
    }
  }
  function run(on) {
    playing = on;
    if (on && !timer) { nextTime = 0; timer = setInterval(scheduler, 30); }
    if (!on && timer) { clearInterval(timer); timer = null; }
  }
  function recipe(d) {
    var rows = d.rows || [], now = ac.currentTime, s = 0, c = 0, r, G = gainAll(), P = V.pad, H = V.hiss;
    for (r = 0; r < R; r++) { var x = rows[r] || 0; if (x > 0) { s += x; c++; } }
    var mean = c ? s / c : 0;
    if (V.drive === "anomaly") mean = clamp01((d.anomaly || 0) / 0.4);
    else if (V.drive === "lat" && d.lat != null) mean = clamp01((d.lat + 90) / 180);
    live.rows = rows; live.mean = mean; live.rate = d.rate || 1;

    for (r = 0; r < R; r++) {                        // top row = highest voice
      var vo = voices[R - 1 - r];
      vo.g.gain.setTargetAtTime(P.on ? (rows[r] || 0) * P.gain * G : 0, now, 0.06);
      vo.b.detune.setTargetAtTime(lerp(P.detune, mean), now, 0.1);
    }
    lowpass.frequency.setTargetAtTime(lerp(P.cutoff, mean), now, 0.1);
    var hg = (H.on && c) ? H.gain * G * (H.floor + (1 - H.floor) * mean) : 0;
    noiseGain.gain.setTargetAtTime(hg, now, 0.15);
    if (H.on) bp.frequency.setTargetAtTime(lerp(H.freq, mean), now, 0.2);
    if (H.on && H.swell && c) {
      lfo.frequency.setTargetAtTime(lerp(H.swell, mean), now, 0.5);
      lfoAmt.gain.setTargetAtTime(hg * 0.6, now, 0.5);
    } else lfoAmt.gain.setTargetAtTime(0, now, 0.1);
    pans.forEach(function (p) { p.pan.setTargetAtTime(clamp(d.pan || 0), now, 0.05); });
    run(true);
  }
  function stopCustom() {
    Object.keys(inst).forEach(function (k) {
      try { if (inst[k] && inst[k].silence) inst[k].silence(); } catch (e) { warn(k, e); }
    });
  }

  /* ---- public ---- */
  E.has = function (name) { return !!(ac && SL().enabled !== false && (SL().layers || {})[name]); };
  E.describe = function (name) { return (SL().layers || {})[name] ? layer(name).describe : ""; };

  E.feed = function (name, d) {
    if (!E.has(name)) return;
    var L = layer(name);
    if (cur && cur !== name && inst[cur] && inst[cur].silence) { try { inst[cur].silence(); } catch (e) { warn(cur, e); } }
    cur = name;
    if (vName !== name) applyVoice(name);
    recipe(d);
    if (L.custom) {
      try {
        if (!inst[name]) inst[name] = L.custom(env, L.params) || {};
        if (inst[name].update) inst[name].update(d);
      } catch (e) { warn(name, e); }
    }
  };

  E.silence = function () {
    if (!ac) return;
    var now = ac.currentTime;
    voices.forEach(function (v) { v.g.gain.setTargetAtTime(0, now, 0.1); });
    noiseGain.gain.setTargetAtTime(0, now, 0.1);
    lfoAmt.gain.setTargetAtTime(0, now, 0.1);
    live.rows = []; live.mean = 0;
    run(false); stopCustom(); cur = null;
  };

  window.SceneLayers = E;
})();
