/* ============================================================
   EARTH JUKEBOX: app.js
   Regions: 1 state, 2 helpers, 3 legends, 4 video loading,
   5 frame analysis, 6 audio, 7 description, 8 drawing,
   9 playback, 10 menu + upload, 11 page controls

   THREE WAYS TO LISTEN (every one has a nature texture under its notes; all read the CURRENT video frame, so sound and picture always match):
   - One place: every 250 ms the colour at the spot drives a nature texture (rain, wind, ocean),
     and about once a second a note. Texture = what and how much, note = exact value.
   - Sweep: the video FREEZES, a west-to-east sweep reads that one frame (the strongest signal in each column steers the texture), then the video jumps
     forward and the next sweep begins. Every sweep describes one real moment.
   - Chord: the video plays, and once a second the strongest signal in each band sounds as a chord.
   ============================================================ */
(function () {
"use strict";
var C = window.CONFIG, A = C.analysis;
var $ = function (id) { return document.getElementById(id); };

var NOTE_EVERY = C.noteEveryTicks || 2;
var NOTES_PER_TICK = C.notesPerTick || 1, NOTE_SPREAD = C.noteSpreadSteps || 2;
var NOTE_GAIN = C.noteGain || {};


var SWEEP_MS = C.sweepMs || 4000;
var SWEEP_STEP = C.sweepStepSec || 1.5;
var CHORD_MS = C.chordMs || 1000;
var MAX_PER_COL = C.maxNotesPerColumn || 2;
var LOW_MIDI = C.lowMidi || 48;
var OCTAVES = C.octaves || 3;
var ANNOUNCE = C.announceEveryBeats || 4;
var LI = C.listen || {};
var FLIP = LI.flipPan ? -1 : 1;
var PAN = LI.panWidth != null ? LI.panWidth : 0.9;
var LOUD = LI.loudness || [0.1, 0.45];
var REVERB = LI.reverb != null ? LI.reverb : 0.12;
var SPOT_MS = C.spotMs || 250, SPOT_DEG = C.spotDeg || 12, SPOT_STEP = C.spotStep || 5;
var ANOMALY = C.anomalyThreshold != null ? C.anomalyThreshold : 0.12;
var SCENES = C.scenes || {};
var GAZ = C.gazetteer || [];
var PLACES = C.places || [];
var FULL = { x: 0, y: 0, w: 1, h: 1 };
var PLAY = '<svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor"><path d="M3 1.5v11l9-5.5z"/></svg> Play';
var PAUSE = '<svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor"><path d="M3 1.5h3v11H3zM8 1.5h3v11H8z"/></svg> Pause';
var ITEMS = C.presets.concat([C.upload || { name: "Upload your own", description: "", videoUrl: "", legends: [] }]);
var SCENE_TEXT = {
  rain: "Rain: more drops and a brighter wash mean heavier rain. Distant thunder means extreme rain. Silence means no rain.",
  heat: "Wind: cold is low, big and breathy. Hot is a thin, dry, high shimmer.",
  ocean: "Ocean swell: warmer water means faster, brighter waves.",
  none: ""
};

/* ===== REGION 1: STATE ===== */
var S = {
  video: $("video"), legends: [], crop: FULL,
  ac: null, ax: null, aw: 0, ah: 0, data: null,
  ctx: null, master: null, bus: null, sceneBus: null, noise: null, layers: null, drone: null, lastThunder: -99,
  timer: null, beat: 0, col: 0, ticks: 0, series: [], tiles: null, sample: null, loaded: false,
  base: [], storyIdx: 0,
  wetMin: A.wetMin, active: null, mode: String(LI.mode || "cycle"), invert: !!LI.invertPitch,
  target: LI.view === "map" ? "map" : LI.view === "chord" ? "chord" : "spot", spot: null,
  view: "menu", idx: 0, accent: null, busy: false, formOpen: false, warn: ""
};

/* ===== REGION 2: HELPERS ===== */
var duckT = null;
/* Lower the music while a screen reader speaks. The length of speech is estimated from the word count. */
function duck(text) {
  var box = $("duck");
  if (!S.master || !S.ctx || !box || !box.checked) return;
  var ms = Math.min(12000, 800 + text.split(/\s+/).length * 400);
  S.master.gain.setTargetAtTime(parseFloat($("volume").value) * 0.2, S.ctx.currentTime, 0.05);
  clearTimeout(duckT);
  duckT = setTimeout(function () {
    S.master.gain.setTargetAtTime(parseFloat($("volume").value), S.ctx.currentTime, 0.3);
  }, ms);
}
function say(t, noDuck) { $("live").textContent = t; $("liveVis").textContent = t; if (!noDuck) duck(t); }
window.spotSay = say;      // ui.js uses this so its announcements duck the music too
function proxied(url) { return C.proxyPath + encodeURIComponent(url); }
function midiToHz(m) { return 440 * Math.pow(2, (m - 69) / 12); }
function dist2(r, g, b, c) { var x = r - c[0], y = g - c[1], z = b - c[2]; return x * x + y * y + z * z; }
function isUpload() { return S.idx === ITEMS.length - 1; }
function wetTile(t) { return t.value !== null && t.norm !== undefined; }
function fmt(v) { return String(+v.toFixed(Math.abs(v) < 10 ? 2 : 1)); }
function colorAt(en, t) { var e = en[Math.min(en.length - 1, Math.round(t * (en.length - 1)))]; return "rgb(" + e.r + "," + e.g + "," + e.b + ")"; }
function placeCopy(i) { var p = PLACES[i] || { name: "Equator", lat: 0, lon: 0 }; return { name: p.name, lat: p.lat, lon: p.lon }; }
S.spot = placeCopy(0);
function lonText(col) {
  var lon = -180 + (col + 0.5) / C.grid.cols * 360;
  return Math.round(Math.abs(lon)) + " degrees " + (lon < 0 ? "west" : "east");
}
function spotWhere() {
  var s = S.spot;
  return Math.abs(Math.round(s.lat)) + " degrees " + (s.lat < 0 ? "south" : "north") + ", " + Math.abs(Math.round(s.lon)) + " degrees " + (s.lon < 0 ? "west" : "east");
}
function legendFor(t) { return S.legends.filter(function (L) { return L.spec.type === t.type; })[0] || S.legends[0]; }
function sceneOf(L) { return (L && L.spec.scene) || (L && SCENES[L.spec.type]) || SCENES["default"] || "none"; }
function mapLike() { return S.target !== "spot"; }

/* Place names for any spot: nearest gazetteer entry, judged against its own size. */
function km(a, b, c, d) {
  var R = 6371, x = Math.PI / 180, dl = (d - b) * x, p1 = a * x, p2 = c * x;
  return R * Math.acos(Math.min(1, Math.sin(p1) * Math.sin(p2) + Math.cos(p1) * Math.cos(p2) * Math.cos(dl)));
}
function nameFor(lat, lon) {
  var best = null, bs = 1e9;
  GAZ.forEach(function (g) { var s = km(lat, lon, g.lat, g.lon) / g.r; if (s < bs) { bs = s; best = g; } });
  if (!best) return "Custom spot";
  if (bs < 1) return best.n.charAt(0).toUpperCase() + best.n.slice(1);
  return "Near " + best.n;
}

/* ===== REGION 3: LEGENDS (colour bar image -> list of colour/value pairs) ===== */
function loadImage(url, viaProxy) {
  return new Promise(function (ok, no) {
    var im = new Image();
    im.crossOrigin = "anonymous";
    im.onload = function () { ok(im); };
    im.onerror = function () { no(new Error("Legend image failed: " + url)); };
    im.src = viaProxy ? proxied(url) : url;
  });
}
function findBar(d, w, h) {
  var rc = new Array(h).fill(0), cc = new Array(w).fill(0), x, y, p, mx, mn;
  for (y = 0; y < h; y++) for (x = 0; x < w; x++) {
    p = (y * w + x) * 4; if (d[p + 3] < 200) continue;
    mx = Math.max(d[p], d[p + 1], d[p + 2]); mn = Math.min(d[p], d[p + 1], d[p + 2]);
    if (mx - mn > 30) { rc[y]++; cc[x]++; }
  }
  var rm = Math.max.apply(null, rc), cm = Math.max.apply(null, cc);
  if (!rm) return null;
  var bb = { x0: w, x1: 0, y0: h, y1: 0 };
  for (y = 0; y < h; y++) if (rc[y] >= rm * 0.3) { bb.y0 = Math.min(bb.y0, y); bb.y1 = Math.max(bb.y1, y); }
  for (x = 0; x < w; x++) if (cc[x] >= cm * 0.3) { bb.x0 = Math.min(bb.x0, x); bb.x1 = Math.max(bb.x1, x); }
  return bb;
}
async function decodeLegend(spec) {
  var im;
  try { im = await loadImage(spec.url, false); } catch (e) { im = await loadImage(spec.url, true); }
  var cr = spec.crop || FULL;
  var w = Math.max(1, Math.round(cr.w * im.naturalWidth)), h = Math.max(1, Math.round(cr.h * im.naturalHeight));
  var cv = document.createElement("canvas"); cv.width = w; cv.height = h;
  var cx = cv.getContext("2d", { willReadFrequently: true });
  cx.drawImage(im, cr.x * im.naturalWidth, cr.y * im.naturalHeight, w, h, 0, 0, w, h);
  var d = cx.getImageData(0, 0, w, h).data;
  var vertical = spec.orientation.indexOf("vertical") === 0;
  var flip = /lowright|lowtop/.test(spec.orientation);
  var bb = findBar(d, w, h) || { x0: 0, x1: w - 1, y0: 0, y1: h - 1 }, entries = [], N = 128;
  for (var i = 0; i < N; i++) {
    var t = i / (N - 1), x, y;
    if (vertical) { x = Math.floor((bb.x0 + bb.x1) / 2); y = Math.round(bb.y0 + (flip ? t : 1 - t) * (bb.y1 - bb.y0)); }
    else { y = Math.floor((bb.y0 + bb.y1) / 2); x = Math.round(bb.x0 + (flip ? 1 - t : t) * (bb.x1 - bb.x0)); }
    var p = (y * w + x) * 4;
    if (d[p + 3] < 200) continue;
    var value = spec.scale === "log" ? spec.min * Math.pow(spec.max / spec.min, t) : spec.min + (spec.max - spec.min) * t;
    entries.push({ r: d[p], g: d[p + 1], b: d[p + 2], t: t, value: value });
  }
  entries = entries.filter(function (e, i) {
    var a = entries[i - 1], b = entries[i + 1], far = function (o) { return !o || dist2(e.r, e.g, e.b, [o.r, o.g, o.b]) > 2500; };
    return !(far(a) && far(b));
  });
  if (!entries.length) throw new Error("No color found in legend: " + spec.label);
  return { spec: spec, entries: entries, src: im.src };
}
function showLegends() {
  var box = $("legendView"); box.innerHTML = "";
  S.legends.forEach(function (L) {
    var p = document.createElement("p");
    p.textContent = L.spec.label + ": " + L.spec.min + " to " + L.spec.max + ", " + L.spec.scale + " scale.";
    var cv = document.createElement("canvas"); cv.className = "strip"; cv.width = 512; cv.height = 24;
    cv.setAttribute("role", "img"); cv.setAttribute("aria-label", "Decoded color bar for " + L.spec.label);
    var g = cv.getContext("2d");
    L.entries.forEach(function (e) { g.fillStyle = "rgb(" + e.r + "," + e.g + "," + e.b + ")"; g.fillRect(e.t * 508, 0, 6, 24); });
    var img = document.createElement("img"); img.className = "orig"; img.src = L.src; img.alt = "Original legend image for " + L.spec.label;
    box.appendChild(p); box.appendChild(img); box.appendChild(cv);
  });
  if (S.warn) { var w = document.createElement("p"); w.textContent = S.warn; box.appendChild(w); }
}
function legendOverlap() {
  var out = [];
  for (var i = 1; i < S.legends.length; i++) for (var j = 0; j < i; j++) {
    var a = S.legends[j].entries, n = 0, b = S.legends[i].entries;
    b.forEach(function (e) { for (var k = 0; k < a.length; k++) if (dist2(e.r, e.g, e.b, [a[k].r, a[k].g, a[k].b]) < 225) { n++; break; } });
    if (n / b.length > 0.3) out.push("Warning: " + Math.round(n / b.length * 100) + " percent of the colors in " + S.legends[i].spec.label + " are almost the same as " + S.legends[j].spec.label + ", so those pixels count as " + S.legends[j].spec.label + ".");
  }
  return out.join(" ");
}

/* ===== REGION 4: VIDEO LOADING ===== */
function tryVideo(src, cors) {
  return new Promise(function (ok, no) {
    var v = S.video;
    function clean() { v.removeEventListener("loadeddata", good); v.removeEventListener("error", bad); }
    function good() { clean(); ok(); }
    function bad() { clean(); no(new Error("video failed")); }
    v.addEventListener("loadeddata", good); v.addEventListener("error", bad);
    if (cors) v.crossOrigin = "anonymous"; else v.removeAttribute("crossorigin");
    v.src = src; v.load();
  });
}
function probe() {
  var c = document.createElement("canvas"); c.width = c.height = 1;
  var x = c.getContext("2d"); x.drawImage(S.video, 0, 0, 1, 1); x.getImageData(0, 0, 1, 1);
}
async function loadVideo(url, isLocal) {
  if (isLocal) { await tryVideo(url, false); return; }
  try { await tryVideo(url, true); probe(); }
  catch (e) { await tryVideo(proxied(url), true); probe(); }
}

/* ===== REGION 5: FRAME ANALYSIS =====
   Tile value: null = no data, {value:0, no norm} = dry, otherwise a value from the legend. */
function matchColor(r, g, b) {
  for (var i = 0; i < S.legends.length; i++) {
    var L = S.legends[i], tol = L.spec.tolerance || A.maxColorDistance, bd = tol * tol, best = null;
    for (var k = 0; k < L.entries.length; k++) {
      var e = L.entries[k], d = dist2(r, g, b, [e.r, e.g, e.b]);
      if (d <= bd) { bd = d; best = e; }
    }
    if (best) return { e: best, type: L.spec.type };
  }
  return null;
}
function prepAnalysis() {
  var v = S.video, cr = S.crop;
  S.aw = A.width;
  S.ah = Math.max(1, Math.round(A.width * (v.videoHeight * cr.h) / (v.videoWidth * cr.w)));
  S.ac = document.createElement("canvas"); S.ac.width = S.aw; S.ac.height = S.ah;
  S.ax = S.ac.getContext("2d", { willReadFrequently: true });
}
/* Read one rectangle of the analysed frame (x0,y0,w,h in analysis pixels) with an n x n sample grid. */
function measure(d, x0, y0, w, h, n) {
  var wet = 0, dry = 0, sv = 0, st = 0, sr = 0, sg = 0, sb = 0, types = {};
  for (var j = 0; j < n; j++) for (var i = 0; i < n; i++) {
    var x = Math.min(S.aw - 1, Math.max(0, Math.floor(x0 + (i + 0.5) / n * w)));
    var y = Math.min(S.ah - 1, Math.max(0, Math.floor(y0 + (j + 0.5) / n * h)));
    var p = (y * S.aw + x) * 4, R = d[p], G = d[p + 1], B = d[p + 2];
    if (d[p + 3] < 10) continue;
    if (A.noDataColor && dist2(R, G, B, A.noDataColor) < A.dryTolerance * A.dryTolerance) continue;
    if (A.dryColor && dist2(R, G, B, A.dryColor) < A.dryTolerance * A.dryTolerance) { dry++; continue; }
    var m = matchColor(R, G, B);
    if (!m) continue;
    if (m.e.value < S.wetMin) { dry++; continue; }
    wet++; sv += m.e.value; st += m.e.t; sr += m.e.r; sg += m.e.g; sb += m.e.b;
    types[m.type] = (types[m.type] || 0) + 1;
  }
  var valid = wet + dry;
  if (valid / (n * n) < A.minCoverage) return { value: null };
  if (!wet) return { value: 0 };
  var top = Object.keys(types).sort(function (a, b) { return types[b] - types[a]; })[0];
  return { value: sv / wet, norm: st / wet, type: top, wetFrac: wet / valid,
           color: [Math.round(sr / wet), Math.round(sg / wet), Math.round(sb / wet)] };
}
function analyze() {
  var v = S.video, cr = S.crop, cols = C.grid.cols, rows = C.grid.rows, n = A.samplesPerTile;
  S.ax.drawImage(v, cr.x * v.videoWidth, cr.y * v.videoHeight, cr.w * v.videoWidth, cr.h * v.videoHeight, 0, 0, S.aw, S.ah);
  var d = S.data = S.ax.getImageData(0, 0, S.aw, S.ah).data, tw = S.aw / cols, th = S.ah / rows, tiles = [];
  for (var r = 0; r < rows; r++) for (var c = 0; c < cols; c++) {
    var tile = measure(d, c * tw, r * th, tw, th, n);
    tile.col = c; tile.row = r; tiles.push(tile);
  }
  return tiles;
}
/* The listening spot, read at full detail from the frame analyze() just drew. */
function sampleSpot() {
  var s = S.spot, pw = SPOT_DEG / 360 * S.aw, ph = SPOT_DEG / 180 * S.ah;
  var cx = (s.lon + 180) / 360 * S.aw, cy = (90 - s.lat) / 180 * S.ah;
  return measure(S.data, cx - pw / 2, cy - ph / 2, pw, ph, 8);
}
/* Mean position on the legend over every tile with signal, or null. This feeds the planet drone. */
function planetMean(tiles) {
  var n = 0, sum = 0;
  tiles.forEach(function (t) { if (wetTile(t)) { n++; sum += t.norm; } });
  return n ? sum / n : null;
}

/* ===== REGION 6: AUDIO ===== */
function initAudio() {
  if (S.ctx) { S.ctx.resume(); return; }
  var ctx = S.ctx = new (window.AudioContext || window.webkitAudioContext)();
  var comp = ctx.createDynamicsCompressor();
  S.master = ctx.createGain(); S.master.gain.value = parseFloat($("volume").value);
  S.master.connect(comp); comp.connect(ctx.destination);
  var conv = ctx.createConvolver(), len = ctx.sampleRate * 1.2, buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (var ch = 0; ch < 2; ch++) { var a = buf.getChannelData(ch); for (var k = 0; k < len; k++) a[k] = (Math.random() * 2 - 1) * Math.pow(1 - k / len, 3); }
  conv.buffer = buf; var wet = ctx.createGain(); wet.gain.value = REVERB;
  S.conv = conv; conv.connect(wet); wet.connect(S.master); newBus();
  /* The scene bus carries the long-running nature layers and the drone. It is never swapped out. */
  S.sceneBus = ctx.createGain(); S.sceneBus.connect(S.master); S.sceneBus.connect(S.conv);
  var dro = ctx.createOscillator(), dg = ctx.createGain();
  dro.type = "sine"; dro.frequency.value = midiToHz(36); dg.gain.value = 0;
  dro.connect(dg); dg.connect(S.sceneBus); dro.start();
  S.drone = { o: dro, g: dg };

    /* The sustained voice: two slightly detuned oscillators that glide to each new pitch. */
  var po = ctx.createOscillator(), po2 = ctx.createOscillator(), pf = ctx.createBiquadFilter(),
      pg = ctx.createGain(), pp = ctx.createStereoPanner();
  po.type = "triangle"; po2.type = "sine"; po2.detune.value = 7;
  pf.type = "lowpass"; pf.frequency.value = 1200; pg.gain.value = 0;
  po.connect(pf); po2.connect(pf); pf.connect(pg); pg.connect(pp); pp.connect(S.sceneBus);
  po.start(); po2.start();
  S.pad = { o: po, o2: po2, f: pf, g: pg, p: pp };
}
function newBus() {
  var old = S.bus;
  if (old) { old.gain.setTargetAtTime(0, S.ctx.currentTime, 0.02); setTimeout(function () { old.disconnect(); }, 250); }
  S.bus = S.ctx.createGain(); S.bus.connect(S.master); S.bus.connect(S.conv);
}
function envelope(g, t, peak, dur) {
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
}

function tone(type, f, amp, t, dur, dest, detune) {      // one decaying partial
  var o = S.ctx.createOscillator(), pg = S.ctx.createGain();
  o.type = type; o.frequency.value = f; if (detune) o.detune.value = detune;
  pg.gain.setValueAtTime(amp, t); pg.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(pg); pg.connect(dest); o.start(t); o.stop(t + dur + 0.05);
}
function ksBuf(f) {                                      // Karplus-Strong plucked string, cached per pitch
  var key = Math.round(f * 10); S.ks = S.ks || {};
  if (S.ks[key]) return S.ks[key];
  var sr = S.ctx.sampleRate, n = Math.floor(sr * 1.6), N = Math.max(2, Math.round(sr / f)),
      b = S.ctx.createBuffer(1, n, sr), a = b.getChannelData(0), i;
  for (i = 0; i < N; i++) a[i] = Math.random() * 2 - 1;
  for (i = N; i < n; i++) a[i] = 0.996 * 0.5 * (a[i - N] + a[i - N + 1]);
  return (S.ks[key] = b);
}
/* Each instrument gets: frequency, start time, volume, and a gain node to shape. */
var INSTR = {
  harp: function (f, t, v, g) {
    var c = S.ctx, fl = c.createBiquadFilter(), send = c.createGain();
    fl.type = "lowpass";
    fl.frequency.setValueAtTime(f * 6, t);
    fl.frequency.exponentialRampToValueAtTime(f * 1.8, t + 2.5);   // gets darker as it fades
    fl.connect(g);
    tone("sine", f, 1, t, 3.2, fl, -4);                            // two detuned strings
    tone("sine", f, 0.8, t, 3.2, fl, 5);
    tone("triangle", f * 2, 0.25, t, 2, fl);
    tone("sine", f * 4, 0.08, t + 0.02, 1.6, fl);                  // shimmer
    tone("sine", f * 2, 0.18, t + 0.28, 2.2, fl);                  // ghost echo, an octave up
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(v * 0.8, t + 0.03);        // soft attack
    g.gain.exponentialRampToValueAtTime(0.0001, t + 3.4);
    send.gain.value = 0.9; g.connect(send); send.connect(S.conv);  // extra reverb
  },
  windchime: function (f, t, v, g) {                      // a quick scatter of metal tubes, notes from your scale
  var c = S.ctx, n = 4 + Math.floor(Math.random() * 3), k, send = c.createGain();
  for (k = 0; k < n; k++) {
    var w = t + Math.random() * 0.9, p = c.createStereoPanner(), a = 0.5 + Math.random() * 0.5,
        fq = f * 2 * Math.pow(2, C.scale[Math.floor(Math.random() * C.scale.length)] / 12);
    p.pan.value = Math.random() * 1.6 - 0.8; p.connect(g);
    tone("sine", fq, a, w, 2.4, p);
    tone("sine", fq * 2.76, a * 0.4, w, 1.2, p);          // tube-like inharmonic partials
    tone("sine", fq * 5.4, a * 0.2, w, 0.6, p);
  }
  g.gain.setValueAtTime(v * 0.7, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 3.3);
  send.gain.value = 0.7; g.connect(send); send.connect(S.conv);
},
piano: function (f, t, v, g) {
  var c = S.ctx, fl = c.createBiquadFilter(), amps = [1, 0.55, 0.35, 0.22, 0.14, 0.08], n;
  fl.type = "lowpass";
  fl.frequency.setValueAtTime(Math.min(9000, f * 10), t);
  fl.frequency.exponentialRampToValueAtTime(f * 2.5, t + 1.2);   // bright hit, mellow decay
  fl.connect(g);
  for (n = 1; n <= 6; n++)                                       // slightly stretched partials, like real strings
    tone("sine", f * n * Math.sqrt(1 + 0.0004 * n * n), amps[n - 1], t, 2.8 / Math.sqrt(n), fl, n === 1 ? -2 : 0);
  tone("sine", f, 0.5, t, 2.8, fl, 3);                           // second string
  var h = c.createBufferSource(), hf = c.createBiquadFilter(), hg = c.createGain();   // hammer thump
  h.buffer = noiseBuf(); hf.type = "lowpass"; hf.frequency.value = Math.min(4000, f * 4);
  hg.gain.setValueAtTime(0.25, t); hg.gain.exponentialRampToValueAtTime(0.0001, t + 0.04);
  h.connect(hf); hf.connect(hg); hg.connect(g); h.start(t, Math.random(), 0.05);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(v * 0.55, t + 0.005);
  g.gain.exponentialRampToValueAtTime(v * 0.17, t + 0.5);        // quick drop, then a long tail
  g.gain.exponentialRampToValueAtTime(0.0001, t + 2.8);
},
  lyre: function (f, t, v, g) {
    var fl = S.ctx.createBiquadFilter(); fl.type = "lowpass"; fl.frequency.value = f * 4; fl.connect(g);
    tone("triangle", f, 1, t, 1.5, fl, -5); tone("triangle", f, 1, t, 1.5, fl, 6); tone("sine", f * 2.01, 0.3, t, 0.8, fl);
    envelope(g, t, v * 0.7, 1.5);
  },
  flute: function (f, t, v, g) {
    var c = S.ctx, F = f * 2, o = c.createOscillator(), lfo = c.createOscillator(), la = c.createGain(),
        n = c.createBufferSource(), nf = c.createBiquadFilter(), ng = c.createGain();
    o.type = "sine"; o.frequency.value = F;
    lfo.frequency.value = 5; la.gain.value = F * 0.006; lfo.connect(la); la.connect(o.frequency);   // vibrato
    n.buffer = noiseBuf(); nf.type = "bandpass"; nf.frequency.value = F * 2; nf.Q.value = 6; ng.gain.value = 0.25;  // breath
    n.connect(nf); nf.connect(ng); ng.connect(g); o.connect(g);
    o.start(t); lfo.start(t); n.start(t); o.stop(t + 0.9); lfo.stop(t + 0.9); n.stop(t + 0.9);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + 0.12);
    g.gain.setValueAtTime(v, t + 0.45); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.85);
  },
  rainstick: function (f, t, v, g) {                     // a shower of tiny pebbles; pitch only nudges the brightness
    var c = S.ctx, hi = 2500 + f * 3, k;
    for (k = 0; k < 16; k++) {
      var w = t + Math.random(), s = c.createBufferSource(), bf = c.createBiquadFilter(), pg = c.createGain();
      s.buffer = noiseBuf(); bf.type = "bandpass"; bf.frequency.value = hi * (0.5 + Math.random() * 0.9); bf.Q.value = 5;
      pg.gain.setValueAtTime(0.0001, w); pg.gain.exponentialRampToValueAtTime(0.5 * (1 - (w - t) * 0.6), w + 0.004);
      pg.gain.exponentialRampToValueAtTime(0.0001, w + 0.07);
      s.connect(bf); bf.connect(pg); pg.connect(g); s.start(w, Math.random(), 0.1);
    }
    envelope(g, t, v * 2, 1.2);
  },
  guitar: function (f, t, v, g) {
    var s = S.ctx.createBufferSource(); s.buffer = ksBuf(f); s.connect(g); s.start(t); s.stop(t + 1.6);
    g.gain.setValueAtTime(v * 1.5, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.5);
  }
};
function timbreOf(t) {                                   // legend override, then type, then default
  var L = legendFor(t);
  return (L && L.spec.timbre) || C.timbres[t.type] || C.timbres["default"];
}
function voice(freq, t, kind, vol, pan) {
  var NOTES_ON = C.notes !== false;
  var ctx = S.ctx, g = ctx.createGain(), pn = ctx.createStereoPanner();
  pn.pan.value = pan; g.connect(pn); pn.connect(S.bus);
  if (INSTR[kind]) { INSTR[kind](freq, t, vol, g); return; }
  if (kind === "bell") {
    [[1, 1], [2.76, 0.35], [5.4, 0.15]].forEach(function (pr) {
      var o = ctx.createOscillator(), pg = ctx.createGain();
      o.type = "sine"; o.frequency.value = freq * pr[0]; pg.gain.value = pr[1];
      o.connect(pg); pg.connect(g); o.start(t); o.stop(t + 1.2);
    });
    envelope(g, t, vol, 1.0);
  } else {
    var o = ctx.createOscillator(), f = ctx.createBiquadFilter();
    o.type = "triangle"; o.frequency.value = freq; f.type = "lowpass";
    f.frequency.setValueAtTime(freq * 6, t); f.frequency.exponentialRampToValueAtTime(freq * 1.5, t + 0.3);
    o.connect(f); f.connect(g); o.start(t); o.stop(t + 0.5);
    envelope(g, t, vol, 0.4);
  }
}

/* --- Nature sound engine: synthesised, so no sample files, licences or hosting.
   Persistent layers are steered every tick with setTargetAtTime, so values glide and nothing clicks. --- */
function noiseBuf() {
  if (S.noise) return S.noise;
  var c = S.ctx, n = c.sampleRate * 2, b = c.createBuffer(1, n, c.sampleRate), a = b.getChannelData(0);
  for (var i = 0; i < n; i++) a[i] = Math.random() * 2 - 1;
  return (S.noise = b);
}
function layer(type, freq, q) {                    // a looping filtered-noise bed
  var c = S.ctx, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
  s.buffer = noiseBuf(); s.loop = true; f.type = type; f.frequency.value = freq; f.Q.value = q || 0.7; g.gain.value = 0;
  s.connect(f); f.connect(g); g.connect(S.sceneBus); s.start();
  return { f: f, g: g };
}
function steer(p, gain, freq) {
  var t = S.ctx.currentTime; p.g.gain.setTargetAtTime(gain, t, 0.25);
  if (freq) p.f.frequency.setTargetAtTime(freq, t, 0.25);
}
function drop(when, n, pan) {                      // one raindrop
  var c = S.ctx, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain(), p = c.createStereoPanner();
  s.buffer = noiseBuf(); f.type = "bandpass"; f.frequency.value = 1500 + Math.random() * 4500; f.Q.value = 6;
  p.pan.value = Math.max(-1, Math.min(1, pan + (Math.random() - 0.5) * 0.4));
  g.gain.setValueAtTime(0.0001, when);
  g.gain.exponentialRampToValueAtTime(0.05 + 0.12 * n, when + 0.003);
  g.gain.exponentialRampToValueAtTime(0.0001, when + 0.06);
  s.connect(f); f.connect(g); g.connect(p); p.connect(S.sceneBus); s.start(when, Math.random(), 0.08);
}
function thunder(when) {
  var c = S.ctx, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
  s.buffer = noiseBuf(); s.loop = true; f.type = "lowpass";
  f.frequency.setValueAtTime(220, when); f.frequency.exponentialRampToValueAtTime(40, when + 3);
  g.gain.setValueAtTime(0.0001, when); g.gain.exponentialRampToValueAtTime(0.6, when + 0.15);
  g.gain.exponentialRampToValueAtTime(0.0001, when + 3.5);
  s.connect(f); f.connect(g); g.connect(S.sceneBus); s.start(when); s.stop(when + 4);
}


/* kind: "rain" | "heat" | "ocean" | "none".  n: 0..1 position on the legend. */
function scene(kind, n, pan, ms) {
  if (kind === "none") return;
  ms = ms || SPOT_MS;                              // how long this tick lasts, so drops spread across it
  var L = S.layers = S.layers || {}, t = S.ctx.currentTime + 0.02;
  if (kind === "rain") {
    L.rain = L.rain || layer("highpass", 1800);
    steer(L.rain, n < 0.05 ? 0 : 0.03 + 0.22 * n * n, 1500 + 2500 * n);
    for (var i = 0, k = Math.round(n * n * 12 * ms / 250); i < k; i++) drop(t + Math.random() * ms / 1000, n, pan);
    if (n > 0.85 && t - S.lastThunder > 8) { S.lastThunder = t; thunder(t); }
  } else if (kind === "heat") {                    // cold = big low wind, hot = thin dry shimmer
    L.wind = L.wind || layer("bandpass", 500, 0.8); L.hiss = L.hiss || layer("highpass", 5000, 1);
    steer(L.wind, 0.03 + 0.25 * (1 - n), 250 + 500 * (1 - n));
    steer(L.hiss, 0.02 + 0.1 * n * n, 4000 + 3000 * n);
  } else if (kind === "ocean") {                   // slow swell; warmer = faster and brighter
    if (!L.sea) {
      L.sea = layer("lowpass", 500, 0.5);
      L.lfo = S.ctx.createOscillator(); L.lfoAmt = S.ctx.createGain(); L.lfoAmt.gain.value = 0;
      L.lfo.connect(L.lfoAmt); L.lfoAmt.connect(L.sea.g.gain); L.lfo.start();
    }
    L.lfo.frequency.setTargetAtTime(0.08 + 0.25 * n, t, 0.5);
    L.lfoAmt.gain.setTargetAtTime(0.1, t, 0.5);
    steer(L.sea, 0.12, 350 + 900 * n);
  }
}


function silenceScene() {
    padOff();
  var L = S.layers; if (!L || !S.ctx) return;
  Object.keys(L).forEach(function (k) { if (L[k].g && L[k].f) steer(L[k], 0); });
  if (L.lfoAmt) L.lfoAmt.gain.setTargetAtTime(0, S.ctx.currentTime, 0.1);
}
/* Texture for any tile in any view: picks the scene from the tile's own legend. No tile = silence. */
function texture(tile, pan, ms) {
  if (!tile || !wetTile(tile)) { silenceScene(); return; }
  scene(sceneOf(legendFor(tile)), tile.norm, pan, ms);
}
/* The planet drone: one low tone that rises a little as the mean value of the whole map rises. */
function drone(mean) {
  if (!C.drone || !S.drone || !S.ctx) return;
  var t = S.ctx.currentTime;
  S.drone.g.gain.setTargetAtTime(mean === null ? 0 : 0.05, t, 0.5);
  if (mean !== null) S.drone.o.frequency.setTargetAtTime(midiToHz(36 + 8 * mean), t, 0.8);
}
/* How far this value sits above this place's own early baseline (first 8 readings). */
function anomaly(norm) {
  if (S.base.length < 8) { S.base.push(norm); return 0; }
  return norm - S.base.reduce(function (a, b) { return a + b; }, 0) / S.base.length;
}

function noteFor(k) {
  var len = C.scale.length * OCTAVES; k = Math.max(0, Math.min(len - 1, k));
  return LOW_MIDI + 12 * Math.floor(k / C.scale.length) + C.scale[k % C.scale.length];
}
/* Whole-map view: row -> pitch (north high). */
function pitchFor(row) {
  var rows = C.grid.rows, len = C.scale.length * OCTAVES;
  return noteFor(Math.round((S.invert ? row : rows - 1 - row) / (rows - 1) * (len - 1)));
}
/* One-place view: value position on the legend (0..1) -> pitch. */
function pitchForNorm(t) {
  if (S.invert) t = 1 - t;
  return noteFor(Math.round(t * (C.scale.length * OCTAVES - 1)));
}
function indexForNorm(t) {
  if (S.invert) t = 1 - t;
  return Math.round(t * (C.scale.length * OCTAVES - 1));
}
/* Sustained voice: only glides and fades, never stops or disconnects. */
function pad(m, norm, pan) {
  if (!S.pad || !S.ctx) return;
  var t = S.ctx.currentTime, f = midiToHz(m - 12);
  S.pad.o.frequency.setTargetAtTime(f, t, 0.15);
  S.pad.o2.frequency.setTargetAtTime(f, t, 0.15);
  S.pad.f.frequency.setTargetAtTime(600 + 2000 * norm, t, 0.2);
  S.pad.g.gain.setTargetAtTime(0.04 + 0.08 * norm, t, 0.2);
  S.pad.p.pan.setTargetAtTime(Math.max(-1, Math.min(1, pan)), t, 0.2);
}
function padOff() {
  if (S.pad && S.ctx) S.pad.g.gain.setTargetAtTime(0, S.ctx.currentTime, 0.15);
}
function inBand(r) { var b = S.active; return !b || (r >= b.rowStart && r < b.rowEnd); }
function glow(t) {
  var s = document.documentElement.style;
  if (t && t.color) { s.setProperty("--pulse", "rgb(" + t.color.join(",") + ")"); s.setProperty("--pi", Math.max(0.25, t.norm)); }
  else s.setProperty("--pi", 0);
}
function pulseOff() { glow(null); }
/* One reading becomes: a texture (every tick), a sparse note (about once a second), and a quiet
   semitone clash when the value is above this place's usual. preview = a single note only, no texture. */
function playSample(t, when, preview) {
  if (!t || !wetTile(t)) { if (!preview) silenceScene(); return; }
  var L = legendFor(t), kind = sceneOf(L), pan = FLIP * S.spot.lon / 180 * PAN, a = preview ? 0 : anomaly(t.norm);
  var base = indexForNorm(t.norm), m = noteFor(base);
  if (!preview) { scene(kind, t.norm, pan); pad(m, t.norm, pan); }
  var noteNow = preview || kind === "none" || (S.ticks - 1) % NOTE_EVERY === 0;
  if (!noteNow) return;
  // playSample:
  var timbre = timbreOf(t);
  var vol = (LOUD[0] + (LOUD[1] - LOUD[0]) * t.norm) * (NOTE_GAIN[t.type] || NOTE_GAIN["default"] || 1);
  // ...and use `vol` in the voice() call(s) from the previous answer.

  // colTick:   C.timbres[n.type] || C.timbres["default"]    ->  timbreOf(n)
  // chordTick: C.timbres[best.type] || C.timbres["default"] ->  timbreOf(best)
  
  var rate = parseFloat($("rate").value) || 1;
  var gap = SPOT_MS / 1000 / NOTES_PER_TICK / rate;      // spread the notes across the tick
  for (var i = 0; i < NOTES_PER_TICK; i++) {
    var mi = noteFor(base + i * NOTE_SPREAD * (S.invert ? -1 : 1));
    voice(midiToHz(mi), when + i * gap, timbre, vol * (1 - i * 0.15), pan);
  }
  if (a > ANOMALY) voice(midiToHz(m + 1), when, "bell", Math.min(0.3, a), pan);
}


var KEY_GAP = { harp: 0.6, windchime: 1.0, piano: 0.45, flute: 0.6, lyre: 0.5, rainstick: 1.5, guitar: 0.5, bell: 0.45 };
var INSTR_NAME = { harp: "dreamy harp", windchime: "wind chime", piano: "piano", flute: "flute", lyre: "lyre",
                   rainstick: "rainstick", guitar: "guitar", bell: "bell", pluck: "plucked note" };
function soundKey() {
  initAudio();
  var L = S.legends[0], kt = timbreOf({ type: L.spec.type }), gap = KEY_GAP[kt] || 0.3,
      ng = NOTE_GAIN[L.spec.type] || NOTE_GAIN["default"] || 1, nm = INSTR_NAME[kt] || kt,
      t = S.ctx.currentTime + 0.05, i, n = 8, sc = SCENE_TEXT[sceneOf(L)] || "",
      unp = kt === "rainstick" ? " The rainstick has no clear pitch, so the notes change in brightness more than in height." : "";
  if (S.target === "spot") {
    for (i = 0; i < n; i++) voice(midiToHz(pitchForNorm(i / (n - 1))), t + i * gap, kt, 0.25 * ng, 0);
    var t2 = t + n * gap + 0.6;
    voice(midiToHz(pitchForNorm(0.5)), t2, kt, 0.1 * ng, 0);
    voice(midiToHz(pitchForNorm(0.5)), t2 + gap * 2, kt, 0.45 * ng, 0);
    say("Sound key. The instrument is a " + nm + ". Eight notes from the lowest value on the legend to the highest." +
      (S.invert ? " Pitch is flipped: higher values are lower notes." : " Higher values are higher notes.") +
      " Then a quiet and a loud note: louder means a stronger value." + unp + " " + sc +
      " A second, slightly clashing note means warmer or wetter than this place usually is. A silence means no data or no signal. Sound in your left ear is west, right ear is east.", true);
  } else {
    for (i = C.grid.rows - 1; i >= 0; i--) voice(midiToHz(pitchFor(i)), t + (C.grid.rows - 1 - i) * gap, kt, 0.25 * ng, 0);
    var t3 = t + C.grid.rows * gap + 0.6;
    voice(midiToHz(pitchFor(4)), t3, kt, 0.1 * ng, 0);
    voice(midiToHz(pitchFor(4)), t3 + gap * 2, kt, 0.45 * ng, 0);
    voice(midiToHz(pitchFor(4)), t3 + gap * 4, "bell", 0.3, 0);
    say("Sound key. The instrument is a " + nm + ". First, notes rising from south to north, low to high. Then a quiet note for a weak value, a loud note for a strong value, and a bell for snow." +
      unp + " " + sc + " Under the notes, the strongest signal sets the texture." +
      (S.target === "chord" ? " In chord view, one note sounds for each band, the strongest place in that band, panned to where it is." : ""), true);
  }
}
/* ===== REGION 7: DESCRIPTION ===== */
function bandText(b, tiles) {
  var cols = C.grid.cols, valid = 0, wet = [], types = {};
  for (var r = b.rowStart; r < b.rowEnd; r++) for (var c = 0; c < cols; c++) {
    var t = tiles[r * cols + c];
    if (t.value === null) continue; valid++;
    if (wetTile(t)) { wet.push(t); types[t.type] = (types[t.type] || 0) + 1; }
  }
  if (!valid) return "no data";
  if (!wet.length) return "dry";
  var top = wet.reduce(function (a, t) { return t.norm > a.norm ? t : a; });
  var kind = Object.keys(types).sort(function (a, b2) { return types[b2] - types[a]; })[0];
  var level = top.norm < 0.33 ? "low" : top.norm < 0.66 ? "middle" : "high";
  return Math.round(wet.length / valid * 100) + " percent has signal, mostly " + kind + ", strongest is " + level + " near " + lonText(top.col);
}
function describe(tiles) {
  return "At " + S.video.currentTime.toFixed(0) + " seconds. " + C.bands.map(function (b) { return b.name + ": " + bandText(b, tiles) + "."; }).join(" ");
}
function spotLine(t) {
  var where = S.spot.name + ", " + spotWhere();
  if (!t || t.value === null) return where + ": no data here. It may be land, or outside the map.";
  if (!wetTile(t)) return where + ": no signal here at this moment.";
  var L = legendFor(t);
  return where + ": " + (L ? L.spec.label : "value") + " about " + fmt(t.value) + ".";
}
function updateTable(tiles) {
  $("bandTable").innerHTML = C.bands.map(function (b) { return "<tr><th scope='row'>" + b.name + "</th><td>" + bandText(b, tiles) + "</td></tr>"; }).join("");
  var wet = 0, nodata = 0;
  tiles.forEach(function (t) { if (t.value === null) nodata++; else if (wetTile(t)) wet++; });
  $("stats").textContent = "Tiles with signal: " + wet + " of " + tiles.length + ". No-data tiles: " + nodata + ".";
}
/* Spoken summary when the video ends: what the sound did at this place. */
function finishText() {
  var base = "Finished. ";
  if (S.target !== "spot") return base + "Press Play to hear it again.";
  var s = S.series;
  if (!s.length) return base + "There was no data at " + S.spot.name + ". Move the spot and try again.";
  var L = S.legends[0], k = Math.max(1, Math.floor(s.length / 5));
  var mean = function (a) { return a.reduce(function (x, y) { return x + y; }, 0) / a.length; };
  var first = mean(s.slice(0, k)), last = mean(s.slice(-k));
  var lo = Math.min.apply(null, s), hi = Math.max.apply(null, s), span = Math.abs(L.spec.max - L.spec.min);
  var move = Math.abs(last - first) < 0.05 * span ? "stayed about the same" : last > first ? "rose" : "fell";
  var quiet = Math.round((1 - s.length / Math.max(1, S.ticks)) * 100);
  return base + "At " + S.spot.name + ", " + L.spec.label + " started near " + fmt(first) + " and ended near " + fmt(last) + ", so it " + move +
    ". Lowest " + fmt(lo) + ", highest " + fmt(hi) + "." + (quiet > 5 ? " It was silent " + quiet + " percent of the time." : "") + " Press Play to hear it again.";
}

/* ===== REGION 8: DRAWING ===== */
function label(g, text, x, y, align) {
  g.font = "bold 28px sans-serif"; g.textAlign = align; g.textBaseline = "middle";
  var w = g.measureText(text).width;
  var bx = align === "center" ? x - w / 2 : align === "left" ? x : x - w;
  g.fillStyle = "rgba(0,0,0,0.75)"; g.fillRect(bx - 6, y - 18, w + 12, 36);
  g.fillStyle = "#fff"; g.fillText(text, x, y);
}
function spotBox() {
  var s = S.spot;
  return { x: (s.lon + 180) / 360 - SPOT_DEG / 720, y: (90 - s.lat) / 180 - SPOT_DEG / 360, w: SPOT_DEG / 360, h: SPOT_DEG / 180 };
}
function markVideo(hc) {
  var cr = S.crop, cols = C.grid.cols, rows = C.grid.rows, b = S.active;
  function put(id, x, y, w, h, on) {
    var el = $(id); el.style.display = on ? "block" : "none";
    el.style.left = x * 100 + "%"; el.style.top = y * 100 + "%"; el.style.width = w * 100 + "%"; el.style.height = h * 100 + "%";
  }
  if (S.target === "spot") {
    var sb = spotBox();
    put("vcol", cr.x + sb.x * cr.w, cr.y + sb.y * cr.h, sb.w * cr.w, sb.h * cr.h, true);
    put("vtop", 0, 0, 0, 0, false); put("vbot", 0, 0, 0, 0, false);
    return;
  }
  put("vcol", cr.x + (hc || 0) / cols * cr.w, cr.y, cr.w / cols, cr.h, hc !== undefined);
  put("vtop", cr.x, cr.y, cr.w, b ? b.rowStart / rows * cr.h : 0, !!b && b.rowStart > 0);
  put("vbot", cr.x, cr.y + (b ? b.rowEnd / rows : 1) * cr.h, cr.w, b ? (1 - b.rowEnd / rows) * cr.h : 0, !!b && b.rowEnd < rows);
}
function drawMap(tiles, hc) {
  var cv = $("map"), cs = 64, cols = C.grid.cols, rows = C.grid.rows, mapMode = mapLike();
  cv.width = cols * cs; cv.height = rows * cs;
  var g = cv.getContext("2d"); g.fillStyle = "#000"; g.fillRect(0, 0, cv.width, cv.height);
  tiles.forEach(function (t) {
    var x = t.col * cs, y = t.row * cs;
    if (t.value === null) return;
    if (t.norm === undefined) { g.strokeStyle = "#444"; g.strokeRect(x + 0.5, y + 0.5, cs - 1, cs - 1); return; }
    g.fillStyle = "rgb(" + t.color.join(",") + ")"; g.fillRect(x, y, cs, cs);
    if (S.legends.length > 1 && t.type !== S.legends[0].spec.type) { g.fillStyle = "#fff"; g.fillRect(x + cs / 2 - 3, y + cs / 2 - 3, 6, 6); }
  });
  if (mapMode && S.active) {
    g.fillStyle = "rgba(0,0,0,0.65)"; g.fillRect(0, 0, cv.width, S.active.rowStart * cs);
    g.fillRect(0, S.active.rowEnd * cs, cv.width, cv.height - S.active.rowEnd * cs);
  }
  if (mapMode) {
    g.strokeStyle = "#fff"; g.lineWidth = 3;
    C.bands.forEach(function (b) { g.beginPath(); g.moveTo(0, b.rowStart * cs); g.lineTo(cv.width, b.rowStart * cs); g.stroke(); });
    if (hc !== undefined) { g.strokeStyle = S.accent || "#fff"; g.lineWidth = 5; g.strokeRect(hc * cs + 1.5, 1.5, cs - 3, cv.height - 3); }
    label(g, "NORTH (high notes)", cv.width / 2, 24, "center");
    label(g, "SOUTH (low notes)", cv.width / 2, cv.height - 24, "center");
    label(g, "WEST", 8, cv.height / 2, "left");
    label(g, "EAST", cv.width - 8, cv.height / 2, "right");
  } else {
    var b = spotBox(), px = (b.x + b.w / 2) * cv.width, py = (b.y + b.h / 2) * cv.height;
    g.lineWidth = 11; g.strokeStyle = "#000"; g.beginPath(); g.arc(px, py, 26, 0, 7); g.stroke();
    g.lineWidth = 5; g.strokeStyle = S.accent || "#fff"; g.beginPath(); g.arc(px, py, 26, 0, 7); g.stroke();
    label(g, S.spot.name, cv.width / 2, 24, "center");
  }
  markVideo(hc);
}

/* ===== REGION 9: PLAYBACK =====
   Every tick reads the frame that is on screen at this moment. Nothing is queued ahead.
   In sweep view the video is frozen during each sweep and only jumps between sweeps. */

/* Guided tour: announce each cue once as the video passes its time, and move the spot. */
function storyList() { return (C.storyTour && ITEMS[S.idx] && ITEMS[S.idx].story) || []; }
function syncStory() {
  var st = storyList(), t = S.video.currentTime, n = 0;
  while (n < st.length && st[n].t < t - 0.01) n++;
  S.storyIdx = n;
}
function storyCheck() {
  var st = storyList(), t = S.video.currentTime;
  while (S.storyIdx < st.length && st[S.storyIdx].t <= t) {
    var cue = st[S.storyIdx++];
    if (cue.place && S.target === "spot") {
      var k = PLACES.map(function (x) { return x.name; }).indexOf(cue.place);
      if (k >= 0) { S.spot = placeCopy(k); $("place").value = k; S.base.length = 0; }
    }
    say(cue.text);
  }
}
function spotTick() {
  if (S.video.readyState < 2) return;
  S.ticks++;
  S.tiles = analyze();
  var t = S.sample = sampleSpot();
  if (wetTile(t)) S.series.push(t.value);
  playSample(t, S.ctx.currentTime + 0.02);
  drone(planetMean(S.tiles));
  drawMap(S.tiles); glow(wetTile(t) ? t : null);
  $("now").textContent = spotLine(t);
  updateTable(S.tiles);
  storyCheck();
}
function colTick() {
  if (S.video.readyState < 2 || S.video.seeking) return;
  var cols = C.grid.cols, rows = C.grid.rows, c = S.col, r, col = [];
  if (c === 0) {
    S.active = S.mode === "all" ? null : S.mode === "cycle" ? C.bands[S.beat % C.bands.length] : C.bands[+S.mode];
    $("now").textContent = "Listening to: " + (S.active ? S.active.name : "all bands") + " at " + S.video.currentTime.toFixed(0) + " seconds";
    storyCheck();
  }
  S.tiles = analyze();
  for (r = 0; r < rows; r++) { var tl = S.tiles[r * cols + c]; if (wetTile(tl) && inBand(r)) col.push(tl); }
  col.sort(function (a, b) { return b.norm - a.norm; });
  var pan = FLIP * ((c + 0.5) / cols * 2 - 1) * PAN, when = S.ctx.currentTime + 0.02;
  col.slice(0, MAX_PER_COL).forEach(function (n) {
    voice(midiToHz(pitchFor(n.row)), when, C.timbres[n.type] || C.timbres["default"], LOUD[0] + (LOUD[1] - LOUD[0]) * n.norm, pan);
  });
  texture(col[0], pan, SWEEP_MS / cols);           // the strongest signal in this column also drives the nature texture
  drawMap(S.tiles, c); glow(col[0]);
  if (c === 0) { drone(planetMean(S.tiles)); updateTable(S.tiles); if (S.beat % ANNOUNCE === 0) say(describe(S.tiles)); }
  S.col = (c + 1) % cols;
  if (!S.col) {                                    // sweep finished: jump the video forward to the next moment
    S.beat++;
    var next = S.video.currentTime + SWEEP_STEP;
    if (next >= S.video.duration - 0.05) { stop(finishText(), true); return; }
    S.video.currentTime = next;
  }
}
/* Chord view: once a second, the strongest signal in each band sounds together. */
function chordTick() {
  if (S.video.readyState < 2) return;
  var cols = C.grid.cols, when = S.ctx.currentTime + 0.02, heard = [], strongest = null;
  S.ticks++;
  S.tiles = analyze();
  S.active = null;
  C.bands.forEach(function (b) {
    var best = null;
    for (var r = b.rowStart; r < b.rowEnd; r++) for (var c = 0; c < cols; c++) {
      var tl = S.tiles[r * cols + c];
      if (wetTile(tl) && (!best || tl.norm > best.norm)) best = tl;
    }
    if (!best) return;
    heard.push(best);
    if (!strongest || best.norm > strongest.norm) strongest = best;
    voice(midiToHz(pitchFor(best.row)), when, C.timbres[best.type] || C.timbres["default"],
      LOUD[0] + (LOUD[1] - LOUD[0]) * best.norm, ((best.col + 0.5) / cols * 2 - 1) * PAN);
  });
  /* texture: the strongest signal anywhere sets the nature sound, panned to where it is */
  texture(strongest, strongest ? FLIP * ((strongest.col + 0.5) / cols * 2 - 1) * PAN : 0, CHORD_MS);
  drone(planetMean(S.tiles));
  drawMap(S.tiles); glow(strongest);
  $("now").textContent = heard.length ? "Chord: " + heard.length + " of " + C.bands.length + " bands have signal." : "Silence: no signal anywhere.";
  updateTable(S.tiles);
  if ((S.ticks - 1) % ANNOUNCE === 0) say(describe(S.tiles));
  storyCheck();
}
function start() {
  initAudio();
  var rate = parseFloat($("rate").value), mode = S.target, spot = mode === "spot";
  S.video.playbackRate = rate;
  if (mode === "map") {                            // freeze-sweep: the video stays still while a sweep reads it
    S.video.pause();
    if (S.video.duration && S.video.currentTime >= S.video.duration - 0.1) S.video.currentTime = 0;
  } else {
    var pr = S.video.play(); if (pr && pr.catch) pr.catch(function () {});
  }
  if (S.video.currentTime < 0.5) { S.series = []; S.ticks = 0; S.beat = 0; S.base.length = 0; S.storyIdx = 0; }
  S.col = 0; clearInterval(S.timer);
  var tick = spot ? spotTick : mode === "chord" ? chordTick : colTick;
  var ms = spot ? SPOT_MS : mode === "chord" ? CHORD_MS : SWEEP_MS / C.grid.cols;
  tick();
  S.timer = setInterval(tick, ms / rate);
  $("play").innerHTML = PAUSE; document.body.classList.add("running");
  if (spot) say("Playing. Listening to " + S.spot.name + ".");
}
/* soft = let the last notes ring out (used when the video ends) */
function stop(msg, soft) {
  clearInterval(S.timer); S.timer = null;
  if (S.ctx && !soft) newBus();
  if (S.ctx) { silenceScene(); drone(null); }
  pulseOff(); S.video.pause(); $("play").innerHTML = PLAY; document.body.classList.remove("running");
  if (S.tiles) drawMap(S.tiles);
  if (msg) say(msg);
}
S.video.addEventListener("ended", function () { var m = finishText(); stop(m, true); });
S.video.addEventListener("seeked", syncStory);

/* ===== REGION 10: MENU (coverflow) AND UPLOAD ===== */
function layoutFlow() {
  document.querySelectorAll(".cf").forEach(function (el, i) {
    el.classList.toggle("on", i === S.idx);
    el.setAttribute("aria-current", i === S.idx ? "true" : "false");
  });
}
/* Paint a card with the real colours of its legend. */
function paintCover(i, entries) {
  var stops = [], k, n = 7, cv = document.querySelectorAll(".cf .cover")[i];
  if (!cv) return;
  for (k = 0; k < n; k++) stops.push(colorAt(entries, k / (n - 1)));
  cv.style.background = "radial-gradient(circle at 30% 20%,rgba(255,255,255,.3),transparent 45%),linear-gradient(135deg," + stops.join(",") + ")";
}
function buildFlow() {
  var fl = $("flow");
  ITEMS.forEach(function (p, i) {
    var b = document.createElement("button"); b.type = "button"; b.className = "cf"; b.tabIndex = -1;   // never takes focus, so Enter always means Play
    b.setAttribute("aria-label", p.name + ", " + (i + 1) + " of " + ITEMS.length);
    b.innerHTML = '<span class="cover"></span><span class="lab"><strong></strong><small></small></span>';
    b.querySelector("strong").textContent = p.name;
    b.querySelector("small").textContent = (i + 1) + " / " + ITEMS.length;
    b.addEventListener("mousedown", function (e) { e.preventDefault(); });
    b.addEventListener("click", function () { if (S.view !== "menu") return; if (i === S.idx) enter(); else showItem(i); });
    fl.appendChild(b);
    var c = (p.theme && p.theme.colors) || ["#737373", "#404040", "#262626"];
    b.querySelector(".cover").style.background = "linear-gradient(135deg," + c.join(",") + ")";
    if (p.legends && p.legends.length) {
      decodeLegend(p.legends[0]).then(function (L) {
        p.cols = [colorAt(L.entries, 0.85), colorAt(L.entries, 0.55), colorAt(L.entries, 0.25)];
        paintCover(i, L.entries);
        if (S.idx === i && !(p.theme && p.theme.fixed)) setTheme(p.cols);
      }).catch(function () {});
    }
  });

  window.addEventListener("resize", layoutFlow);
}
function openForm() {
  S.formOpen = true; document.body.classList.add("form");
  say("Upload form. Step one, choose your MP4 video. Step two, choose the legend picture. Then type the lowest and highest value and press Load and continue. Escape cancels.");
  setTimeout(function () { $("file").focus(); }, 60);
}
function closeForm(quiet) {
  S.formOpen = false; document.body.classList.remove("form");
  if (!quiet) { say("Form closed."); $("start").focus(); }
}
function applyPreset(i) {
  var p = ITEMS[i];
  S.wetMin = p.wetMin !== undefined ? p.wetMin : A.wetMin; S.crop = p.mapCrop || FULL;
  S.base.length = 0; S.storyIdx = 0;
  if (p.place) {
    var k = PLACES.map(function (x) { return x.name; }).indexOf(p.place);
    if (k >= 0) { S.spot = placeCopy(k); $("place").value = k; }
  }
}
function setTheme(c) {
  c = c || ["#38bdf8", "#6366f1", "#a855f7"]; S.accent = c[0];
  var r = document.documentElement.style; r.setProperty("--a", c[0]); r.setProperty("--b", c[1]); r.setProperty("--c", c[2]);
}
function showItem(i, now) {
  var p = ITEMS[i], b = $("top"); S.idx = i; $("preset").value = i;
  document.body.classList.toggle("upload", i === ITEMS.length - 1);
  closeForm(true);
  stop(); applyPreset(i); S.loaded = false; $("play").disabled = true;
  $("startLabel").textContent = isUpload() ? "Choose files" : "Play";
  function text() { $("pTitle").textContent = p.name; $("pDesc").textContent = p.description || ""; $("pIdx").textContent = (i + 1) + " / " + ITEMS.length; b.classList.remove("swap"); }
  if (now) text(); else { b.classList.add("swap"); setTimeout(text, 250); }
  setTheme((p.cols && !(p.theme && p.theme.fixed)) ? p.cols : (p.theme && p.theme.colors));
  say(p.name + ". " + (isUpload() ? "Press Enter to choose your files." : "Press Enter to start.") + " Use the left and right arrow keys to change.");
  layoutFlow();
}
function resetPlayback(msg) {
  stop(); S.video.currentTime = 0; S.beat = 0; S.col = 0; S.series = []; S.ticks = 0; S.tiles = null; S.sample = null; S.active = null; S.base.length = 0; S.storyIdx = 0; $("seek").value = 0;
  var cv = $("map"); cv.getContext("2d").clearRect(0, 0, cv.width, cv.height); markVideo();
  $("stats").textContent = "Not analysed yet."; $("bandTable").innerHTML = ""; $("now").textContent = "Nothing yet";
  var m = typeof msg === "string" ? msg : "Back at the start. Press Play.";
  if (S.loaded && S.view === "play") preview(m); else say(m);
}
/* Shows the first frame without sound. Playback starts only when Play is pressed. */
function preview(msg) {
  function go() {
    try { S.tiles = analyze(); S.sample = sampleSpot(); drawMap(S.tiles); updateTable(S.tiles); } catch (e) {}
    $("now").textContent = S.target === "spot" ? "Listening to: " + S.spot.name : "Paused. Press Play to listen.";
    say(msg || ("Ready and paused." + (S.target === "spot" ? " Listening to " + S.spot.name + "." : "") + " Press Play to listen." + (S.warn ? " " + S.warn : "")));
  }
  if (S.video.seeking) S.video.addEventListener("seeked", go, { once: true }); else go();
}
async function enter() {
  initAudio();   /* inside the key press, before any await, or the browser keeps sound muted */
  if (S.busy) return;
  if (isUpload() && !S.formOpen) { openForm(); return; }   // upload card: Play opens the form first
  S.busy = true;
  try {
    if (!S.loaded) await onLoad();
    if (!S.loaded) return;
    document.body.classList.add("playing"); S.view = "play"; preview(); $("play").focus();
  } finally { S.busy = false; }
}
function leave() {
  resetPlayback("Back to the menu. Press Enter to play again."); document.body.classList.remove("playing"); S.view = "menu";
  if (S.formOpen) $("file").focus(); else $("start").focus();
}
async function onLoad() {
  stop(); S.loaded = false; $("play").disabled = true;
  var P = ITEMS[S.idx], file = null, url = P.videoUrl, specs;
  if (isUpload()) {
    file = $("file").files[0]; var lf = $("legendFile").files[0];
    if (!file) return say("Choose your video first. It must be an MP4.");
    if (!lf) return say("Choose the legend picture, the image of the color bar.");
    var mn = parseFloat($("upMin").value), mx = parseFloat($("upMax").value);
    if (!isFinite(mn) || !isFinite(mx) || mn === mx) return say("Type the lowest and the highest value shown on the legend.");
    specs = [{ label: $("upLabel").value.trim() || "Legend", type: "default", url: URL.createObjectURL(lf), min: mn, max: mx,
      scale: ($("upScale").value === "log" && mn > 0 && mx > 0) ? "log" : "linear", orientation: $("upDir").value, crop: FULL }];
    S.wetMin = -1e9; S.crop = FULL;
  } else specs = P.legends;
  if (!file && !url) return say("This preset has no video.");
  if (!specs || !specs.length) return say("No usable legend.");
  try {
    say("Loading legend.");
    S.legends = []; for (var i = 0; i < specs.length; i++) S.legends.push(await decodeLegend(specs[i]));
    S.warn = legendOverlap();
    showLegends();
    var en = S.legends[0].entries;
    if (isUpload()) paintCover(S.idx, en);
    if (!(P.theme && P.theme.fixed)) setTheme([colorAt(en, 0.85), colorAt(en, 0.55), colorAt(en, 0.25)]);
    say("Loading video.");
    await loadVideo(file ? URL.createObjectURL(file) : url, !!file);
    prepAnalysis(); S.loaded = true; $("play").disabled = false; S.storyIdx = 0;
    say("Ready. Press Play.");
  } catch (e) {
    say("Could not load: " + e.message + ". If the file is not an MP4 or the legend is not a picture, choose another. If you host the site, run server.py or check the file paths.");
  }
}

/* ===== REGION 11: PAGE CONTROLS ===== */
function setTargetUI() { $("spotOpts").hidden = S.target !== "spot"; $("mapOpts").hidden = S.target !== "map"; }
/* The spot changed. While paused: redraw and play one note so you hear what is there. While playing: next tick uses it. */
function moveSpot() {
  S.base.length = 0;                               // a new place gets a new baseline
  if (S.timer) { say(S.spot.name + ", " + spotWhere()); return; }
  if (S.loaded && S.data) {
    try {
      S.tiles = analyze(); S.sample = sampleSpot(); drawMap(S.tiles);
      if (S.ctx) playSample(S.sample, S.ctx.currentTime + 0.02, true);
    } catch (e) {}
    say(spotLine(S.sample));
  } else say(S.spot.name + ", " + spotWhere());
}
function setSpot(lat, lon) {
  lat = Math.round(Math.max(-85, Math.min(85, lat))); lon = Math.round(((lon + 180) % 360 + 360) % 360 - 180);
  S.spot = { name: nameFor(lat, lon), lat: lat, lon: lon };
  var pl = $("place"); pl.value = "custom";
  var o = pl.querySelector("option[value=custom]"); if (o) o.textContent = "Moved: " + S.spot.name;
  moveSpot();
}
function pickAt(ev, el, isVideo) {
  if (S.target !== "spot" || !S.loaded) return;
  var r = el.getBoundingClientRect(), fx = (ev.clientX - r.left) / r.width, fy = (ev.clientY - r.top) / r.height;
  if (isVideo) { fx = (fx - S.crop.x) / S.crop.w; fy = (fy - S.crop.y) / S.crop.h; }
  if (fx < 0 || fx > 1 || fy < 0 || fy > 1) return;
  setSpot(90 - fy * 180, -180 + fx * 360);
}
(function wire() {
  ITEMS.forEach(function (p, i) { var o = document.createElement("option"); o.value = i; o.textContent = p.name; $("preset").appendChild(o); });
  $("preset").addEventListener("change", function () { showItem(+this.value); });

  var pl = $("place");
  PLACES.forEach(function (p, i) { var o = document.createElement("option"); o.value = i; o.textContent = p.name; pl.appendChild(o); });
  var oc = document.createElement("option"); oc.value = "custom"; oc.textContent = "Custom spot (moved)"; pl.appendChild(oc);
  pl.addEventListener("change", function () { if (this.value === "custom") return; S.spot = placeCopy(+this.value); moveSpot(); });

  buildFlow();
  showItem(0, true);

  function go(d) { if (S.view === "menu") showItem((S.idx + d + ITEMS.length) % ITEMS.length); }
  $("start").addEventListener("click", enter);
  $("cancelForm").addEventListener("click", function () { closeForm(); });
  $("back").addEventListener("click", function () { if (S.view === "play") leave(); });
  var sx = null, sy = 0;
  document.addEventListener("touchstart", function (e) { var t = e.touches[0]; sx = t.clientX; sy = t.clientY; }, { passive: true });
  document.addEventListener("touchend", function (e) {
    if (S.view !== "menu" || sx === null) return;
    if (e.target.closest && e.target.closest("#source")) { sx = null; return; }
    var t = e.changedTouches[0], dx = t.clientX - sx, dy = t.clientY - sy; sx = null;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) go(dx < 0 ? 1 : -1);
  }, { passive: true });
  $("source").addEventListener("input", function () { S.loaded = false; $("play").disabled = true; });
  Object.keys(C.info || {}).forEach(function (k) { var el = $("info-" + k); if (el && C.info[k] === false) el.hidden = true; });

  var ms = $("mode");
  ms.innerHTML = "<option value='cycle'>One band at a time (cycle)</option><option value='all'>All bands together</option>" +
    C.bands.map(function (b, i) { return "<option value='" + i + "'>" + b.name + " only</option>"; }).join("");
  ms.value = S.mode; ms.addEventListener("change", function () { S.mode = this.value; resetPlayback(); });
  $("target").value = S.target; setTargetUI();
  $("target").addEventListener("change", function () { S.target = this.value; setTargetUI(); resetPlayback(); });
  $("invert").checked = S.invert; $("invert").addEventListener("change", function () { S.invert = this.checked; resetPlayback(); });
  $("notes").value = MAX_PER_COL; $("notes").addEventListener("change", function () { MAX_PER_COL = Math.max(1, +this.value || 1); resetPlayback(); });
  var sk = $("seek");
  S.video.addEventListener("timeupdate", function () { if (S.video.duration) sk.value = S.video.currentTime / S.video.duration * 1000; });
  sk.addEventListener("input", function () { if (S.loaded) S.video.currentTime = sk.value / 1000 * S.video.duration; });
  $("load").addEventListener("click", enter);
  $("play").addEventListener("click", function () { if (S.timer) stop("Paused."); else start(); });
  $("key").addEventListener("click", soundKey);
  $("describe").addEventListener("click", function () {
    if (!S.tiles) return say("Nothing analysed yet. Press Play.");
    say(S.target === "spot" ? spotLine(S.sample) : describe(S.tiles));
  });
  $("volume").addEventListener("input", function () { if (S.master) S.master.gain.value = parseFloat(this.value); });
  $("rate").addEventListener("change", function () { resetPlayback(); });

  /* choose the spot: click the map or the video, or focus the map and use the arrow keys */
  $("map").addEventListener("click", function (e) { pickAt(e, this, false); });
  S.video.addEventListener("click", function (e) { pickAt(e, this, true); });
  /* Sliders are for the mouse and touch. Let go of focus afterwards so keys never change them by accident. */
  ["seek", "volume"].forEach(function (id) { $(id).addEventListener("change", function () { this.blur(); }); });

  document.addEventListener("keydown", function (e) {
    var tg = e.target.tagName, typing = /SELECT|TEXTAREA/.test(tg) || (tg === "INPUT" && e.target.type !== "range" && e.target.type !== "checkbox");
    if (e.key === "Escape") { if (S.view === "play") leave(); else if (S.formOpen) closeForm(); return; }
    /* In the player the four arrow keys ALWAYS move the marker, whatever has focus (sliders included). */
    if (S.view === "play" && e.key.indexOf("Arrow") === 0 && !typing) {
      e.preventDefault();
      if (S.target === "spot" && S.loaded) {
        var dx = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0, dy = e.key === "ArrowUp" ? 1 : e.key === "ArrowDown" ? -1 : 0;
        setSpot(S.spot.lat + dy * SPOT_STEP, S.spot.lon + dx * SPOT_STEP);
      }
      return;
    }
    if (tg === "INPUT" || typing) return;
    if (S.view === "play" && (e.key === "," || e.key === ".")) {      // seeking moved here from the arrows
      if (S.loaded) { S.video.currentTime = Math.max(0, Math.min(S.video.duration, S.video.currentTime + (e.key === "." ? 5 : -5))); }
      return;
    }
    var onBtn = tg === "BUTTON";
    if (e.key === " ") { if (onBtn) return; e.preventDefault(); if (S.view === "play") $("play").click(); else enter(); }
    else if (e.key === "Enter" && S.view === "menu") { if (!onBtn) enter(); }
    else if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      var d = e.key === "ArrowRight" ? 1 : -1;
      if (S.view === "menu") showItem((S.idx + d + ITEMS.length) % ITEMS.length);
    }
  });
})();
})();