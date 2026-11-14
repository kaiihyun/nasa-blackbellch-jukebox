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

   SCENE LAYERS (nature texture): add or change them ONLY in scene-layers.js. scene-engine.js is the shared engine.
   Notes and instruments: config.js.
   ============================================================ */
(function () {
  "use strict";
  var C = window.CONFIG,
    A = C.analysis;
  var $ = function (id) {
    return document.getElementById(id);
  };

  var NOTE_EVERY = C.noteEveryTicks > 0 ? C.noteEveryTicks : 1; // anything below 1 = a note on every reading
  var NOTES_PER_TICK = C.notesPerTick || 1,
    NOTE_SPREAD = C.noteSpreadSteps || 2;
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
  var SPOT_MS = C.spotMs || 250,
    SPOT_DEG = C.spotDeg || 12,
    SPOT_STEP = C.spotStep || 5;
  var ANOMALY = C.anomalyThreshold != null ? C.anomalyThreshold : 0.12;
  var GAZ = C.gazetteer || [];
  var PLACES = C.places || [];
  var FULL = { x: 0, y: 0, w: 1, h: 1 };
  var PLAY =
    '<svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor"><path d="M3 1.5v11l9-5.5z"/></svg> Play';
  var PAUSE =
    '<svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor"><path d="M3 1.5h3v11H3zM8 1.5h3v11H8z"/></svg> Pause';
  var ITEMS = C.presets.concat([
    C.upload || {
      name: "Upload your own",
      description: "",
      videoUrl: "",
      legends: [],
    },
  ]);

  /* ===== REGION 1: STATE ===== */
  var S = {
    video: $("video"),
    legends: [],
    crop: FULL,
    ac: null,
    ax: null,
    aw: 0,
    ah: 0,
    data: null,
    ctx: null,
    master: null,
    bus: null,
    sceneBus: null,
    noise: null,
    layers: null,
    drone: null,
    lastThunder: -99,
    timer: null,
    beat: 0,
    col: 0,
    ticks: 0,
    series: [],
    tiles: null,
    sample: null,
    loaded: false,
    base: [],
    storyIdx: 0,
    wetMin: A.wetMin,
    active: null,
    mode: String(LI.mode || "cycle"),
    invert: !!LI.invertPitch,
    target: LI.view === "map" ? "map" : LI.view === "chord" ? "chord" : "spot",
    spot: null,
    view: "menu",
    idx: 0,
    accent: null,
    busy: false,
    formOpen: false,
    warn: "",
    instr: null, // instrument chosen with the I key; null = the preset's own instrument
    mood: 1, // 1 = major (bright), 0 = minor (dark): set from the data before each chord note
    keyBusy: false, // true while the sound key is playing
  };

  /* ===== REGION 2: HELPERS ===== */
  var duckT = null;
  /* Lower the music while a screen reader speaks. The length of speech is estimated from the word count. */
  function duck(text) {
    var box = $("duck");
    if (!S.master || !S.ctx || !box || !box.checked) return;
    var ms = Math.min(12000, 800 + text.split(/\s+/).length * 400);
    S.master.gain.setTargetAtTime(
      parseFloat($("volume").value) * 0.2,
      S.ctx.currentTime,
      0.05,
    );
    clearTimeout(duckT);
    duckT = setTimeout(function () {
      S.master.gain.setTargetAtTime(
        parseFloat($("volume").value),
        S.ctx.currentTime,
        0.3,
      );
    }, ms);
  }
  function say(t, noDuck) {
    $("live").textContent = t;
    $("liveVis").textContent = t;
    if (!noDuck) duck(t);
  }
  window.spotSay = say; // ui.js uses this so its announcements duck the music too
  function proxied(url) {
    return C.proxyPath + encodeURIComponent(url);
  }
  function midiToHz(m) {
    return 440 * Math.pow(2, (m - 69) / 12);
  }
  function dist2(r, g, b, c) {
    var x = r - c[0],
      y = g - c[1],
      z = b - c[2];
    return x * x + y * y + z * z;
  }
  function isUpload() {
    return S.idx === ITEMS.length - 1;
  }
  function wetTile(t) {
    return t.value !== null && t.norm !== undefined;
  }
  function fmt(v) {
    return String(+v.toFixed(Math.abs(v) < 10 ? 2 : 1));
  }
  function colorAt(en, t) {
    var e = en[Math.min(en.length - 1, Math.round(t * (en.length - 1)))];
    return "rgb(" + e.r + "," + e.g + "," + e.b + ")";
  }
  function placeCopy(i) {
    var p = PLACES[i] || { name: "Equator", lat: 0, lon: 0 };
    return { name: p.name, lat: p.lat, lon: p.lon };
  }
  S.spot = placeCopy(0);
  function lonText(col) {
    var lon = -180 + ((col + 0.5) / C.grid.cols) * 360;
    return (
      Math.round(Math.abs(lon)) + " degrees " + (lon < 0 ? "west" : "east")
    );
  }
  function spotWhere() {
    var s = S.spot;
    return (
      Math.abs(Math.round(s.lat)) +
      " degrees " +
      (s.lat < 0 ? "south" : "north") +
      ", " +
      Math.abs(Math.round(s.lon)) +
      " degrees " +
      (s.lon < 0 ? "west" : "east")
    );
  }
  function legendFor(t) {
    return (
      S.legends.filter(function (L) {
        return L.spec.type === t.type;
      })[0] || S.legends[0]
    );
  }
  /* Which scene layer a legend uses: its own scene, then byType in scene-layers.js. */
  function sceneOf(L) {
    var SL = window.SCENE_LAYERS || {},
      by = SL.byType || {};
    return (
      (L && L.spec.scene) || (L && by[L.spec.type]) || by["default"] || "none"
    );
  }
  function mapLike() {
    return S.target !== "spot";
  }

  /* Place names for any spot: nearest gazetteer entry, judged against its own size. */
  function km(a, b, c, d) {
    var R = 6371,
      x = Math.PI / 180,
      dl = (d - b) * x,
      p1 = a * x,
      p2 = c * x;
    return (
      R *
      Math.acos(
        Math.min(
          1,
          Math.sin(p1) * Math.sin(p2) +
            Math.cos(p1) * Math.cos(p2) * Math.cos(dl),
        ),
      )
    );
  }
  function nameFor(lat, lon) {
    var best = null,
      bs = 1e9;
    GAZ.forEach(function (g) {
      var s = km(lat, lon, g.lat, g.lon) / g.r;
      if (s < bs) {
        bs = s;
        best = g;
      }
    });
    if (!best) return "Custom spot";
    if (bs < 1) return best.n.charAt(0).toUpperCase() + best.n.slice(1);
    return "Near " + best.n;
  }

  /* ===== REGION 3: LEGENDS (colour bar image -> list of colour/value pairs) ===== */
  function loadImage(url, viaProxy) {
    return new Promise(function (ok, no) {
      var im = new Image();
      im.crossOrigin = "anonymous";
      im.onload = function () {
        ok(im);
      };
      im.onerror = function () {
        no(new Error("Legend image failed: " + url));
      };
      im.src = viaProxy ? proxied(url) : url;
    });
  }
  function findBar(d, w, h) {
    var rc = new Array(h).fill(0),
      cc = new Array(w).fill(0),
      x,
      y,
      p,
      mx,
      mn;
    for (y = 0; y < h; y++)
      for (x = 0; x < w; x++) {
        p = (y * w + x) * 4;
        if (d[p + 3] < 200) continue;
        mx = Math.max(d[p], d[p + 1], d[p + 2]);
        mn = Math.min(d[p], d[p + 1], d[p + 2]);
        if (mx - mn > 30) {
          rc[y]++;
          cc[x]++;
        }
      }
    var rm = Math.max.apply(null, rc),
      cm = Math.max.apply(null, cc);
    if (!rm) return null;
    var bb = { x0: w, x1: 0, y0: h, y1: 0 };
    for (y = 0; y < h; y++)
      if (rc[y] >= rm * 0.3) {
        bb.y0 = Math.min(bb.y0, y);
        bb.y1 = Math.max(bb.y1, y);
      }
    for (x = 0; x < w; x++)
      if (cc[x] >= cm * 0.3) {
        bb.x0 = Math.min(bb.x0, x);
        bb.x1 = Math.max(bb.x1, x);
      }
    return bb;
  }
  async function decodeLegend(spec) {
    var im;
    try {
      im = await loadImage(spec.url, false);
    } catch (e) {
      im = await loadImage(spec.url, true);
    }
    var cr = spec.crop || FULL;
    var w = Math.max(1, Math.round(cr.w * im.naturalWidth)),
      h = Math.max(1, Math.round(cr.h * im.naturalHeight));
    var cv = document.createElement("canvas");
    cv.width = w;
    cv.height = h;
    var cx = cv.getContext("2d", { willReadFrequently: true });
    cx.drawImage(
      im,
      cr.x * im.naturalWidth,
      cr.y * im.naturalHeight,
      w,
      h,
      0,
      0,
      w,
      h,
    );
    var d = cx.getImageData(0, 0, w, h).data;
    var vertical = spec.orientation.indexOf("vertical") === 0;
    var flip = /lowright|lowtop/.test(spec.orientation);
    var bb = findBar(d, w, h) || { x0: 0, x1: w - 1, y0: 0, y1: h - 1 },
      entries = [],
      N = 128;
    for (var i = 0; i < N; i++) {
      var t = i / (N - 1),
        x,
        y;
      if (vertical) {
        x = Math.floor((bb.x0 + bb.x1) / 2);
        y = Math.round(bb.y0 + (flip ? t : 1 - t) * (bb.y1 - bb.y0));
      } else {
        y = Math.floor((bb.y0 + bb.y1) / 2);
        x = Math.round(bb.x0 + (flip ? 1 - t : t) * (bb.x1 - bb.x0));
      }
      var p = (y * w + x) * 4;
      if (d[p + 3] < 200) continue;
      var value =
        spec.scale === "log"
          ? spec.min * Math.pow(spec.max / spec.min, t)
          : spec.min + (spec.max - spec.min) * t;
      entries.push({ r: d[p], g: d[p + 1], b: d[p + 2], t: t, value: value });
    }
    entries = entries.filter(function (e, i) {
      var a = entries[i - 1],
        b = entries[i + 1],
        far = function (o) {
          return !o || dist2(e.r, e.g, e.b, [o.r, o.g, o.b]) > 2500;
        };
      return !(far(a) && far(b));
    });
    if (!entries.length)
      throw new Error("No color found in legend: " + spec.label);
    return { spec: spec, entries: entries, src: im.src };
  }
  function showLegends() {
    var box = $("legendView");
    box.innerHTML = "";
    S.legends.forEach(function (L) {
      var p = document.createElement("p");
      p.textContent =
        L.spec.label +
        ": " +
        L.spec.min +
        " to " +
        L.spec.max +
        ", " +
        L.spec.scale +
        " scale.";
      var cv = document.createElement("canvas");
      cv.className = "strip";
      cv.width = 512;
      cv.height = 24;
      cv.setAttribute("role", "img");
      cv.setAttribute("aria-label", "Decoded color bar for " + L.spec.label);
      var g = cv.getContext("2d");
      L.entries.forEach(function (e) {
        g.fillStyle = "rgb(" + e.r + "," + e.g + "," + e.b + ")";
        g.fillRect(e.t * 508, 0, 6, 24);
      });
      var img = document.createElement("img");
      img.className = "orig";
      img.src = L.src;
      img.alt = "Original legend image for " + L.spec.label;
      box.appendChild(p);
      box.appendChild(img);
      box.appendChild(cv);
    });
    if (S.warn) {
      var w = document.createElement("p");
      w.textContent = S.warn;
      box.appendChild(w);
    }
  }
  function legendOverlap() {
    var out = [];
    for (var i = 1; i < S.legends.length; i++)
      for (var j = 0; j < i; j++) {
        var a = S.legends[j].entries,
          n = 0,
          b = S.legends[i].entries;
        b.forEach(function (e) {
          for (var k = 0; k < a.length; k++)
            if (dist2(e.r, e.g, e.b, [a[k].r, a[k].g, a[k].b]) < 225) {
              n++;
              break;
            }
        });
        if (n / b.length > 0.3)
          out.push(
            "Warning: " +
              Math.round((n / b.length) * 100) +
              " percent of the colors in " +
              S.legends[i].spec.label +
              " are almost the same as " +
              S.legends[j].spec.label +
              ", so those pixels count as " +
              S.legends[j].spec.label +
              ".",
          );
      }
    return out.join(" ");
  }

  /* ===== REGION 4: VIDEO LOADING ===== */
  function tryVideo(src, cors) {
    return new Promise(function (ok, no) {
      var v = S.video;
      function clean() {
        v.removeEventListener("loadeddata", good);
        v.removeEventListener("error", bad);
      }
      function good() {
        clean();
        ok();
      }
      function bad() {
        clean();
        no(new Error("video failed"));
      }
      v.addEventListener("loadeddata", good);
      v.addEventListener("error", bad);
      if (cors) v.crossOrigin = "anonymous";
      else v.removeAttribute("crossorigin");
      v.src = src;
      v.load();
    });
  }
  function probe() {
    var c = document.createElement("canvas");
    c.width = c.height = 1;
    var x = c.getContext("2d");
    x.drawImage(S.video, 0, 0, 1, 1);
    x.getImageData(0, 0, 1, 1);
  }
  async function loadVideo(url, isLocal) {
    if (isLocal) {
      await tryVideo(url, false);
      return;
    }
    try {
      await tryVideo(url, true);
      probe();
    } catch (e) {
      await tryVideo(proxied(url), true);
      probe();
    }
  }

  /* ===== REGION 5: FRAME ANALYSIS =====
   Tile value: null = no data, {value:0, no norm} = dry, otherwise a value from the legend. */
  function matchColor(r, g, b) {
    for (var i = 0; i < S.legends.length; i++) {
      var L = S.legends[i],
        tol = L.spec.tolerance || A.maxColorDistance,
        bd = tol * tol,
        best = null;
      for (var k = 0; k < L.entries.length; k++) {
        var e = L.entries[k],
          d = dist2(r, g, b, [e.r, e.g, e.b]);
        if (d <= bd) {
          bd = d;
          best = e;
        }
      }
      if (best) return { e: best, type: L.spec.type };
    }
    return null;
  }
  function prepAnalysis() {
    var v = S.video,
      cr = S.crop;
    S.aw = A.width;
    S.ah = Math.max(
      1,
      Math.round((A.width * (v.videoHeight * cr.h)) / (v.videoWidth * cr.w)),
    );
    S.ac = document.createElement("canvas");
    S.ac.width = S.aw;
    S.ac.height = S.ah;
    S.ax = S.ac.getContext("2d", { willReadFrequently: true });
  }
  /* Read one rectangle of the analysed frame (x0,y0,w,h in analysis pixels) with an n x n sample grid. */
  function measure(d, x0, y0, w, h, n) {
    var wet = 0,
      dry = 0,
      sv = 0,
      st = 0,
      sr = 0,
      sg = 0,
      sb = 0,
      types = {};
    for (var j = 0; j < n; j++)
      for (var i = 0; i < n; i++) {
        var x = Math.min(
          S.aw - 1,
          Math.max(0, Math.floor(x0 + ((i + 0.5) / n) * w)),
        );
        var y = Math.min(
          S.ah - 1,
          Math.max(0, Math.floor(y0 + ((j + 0.5) / n) * h)),
        );
        var p = (y * S.aw + x) * 4,
          R = d[p],
          G = d[p + 1],
          B = d[p + 2];
        if (d[p + 3] < 10) continue;
        if (
          A.noDataColor &&
          dist2(R, G, B, A.noDataColor) < A.dryTolerance * A.dryTolerance
        )
          continue;
        if (
          A.dryColor &&
          dist2(R, G, B, A.dryColor) < A.dryTolerance * A.dryTolerance
        ) {
          dry++;
          continue;
        }
        var m = matchColor(R, G, B);
        if (!m) continue;
        if (m.e.value < S.wetMin) {
          dry++;
          continue;
        }
        wet++;
        sv += m.e.value;
        st += m.e.t;
        sr += m.e.r;
        sg += m.e.g;
        sb += m.e.b;
        types[m.type] = (types[m.type] || 0) + 1;
      }
    var valid = wet + dry;
    if (valid / (n * n) < A.minCoverage) return { value: null };
    if (!wet) return { value: 0 };
    var top = Object.keys(types).sort(function (a, b) {
      return types[b] - types[a];
    })[0];
    return {
      value: sv / wet,
      norm: st / wet,
      type: top,
      wetFrac: wet / valid,
      color: [Math.round(sr / wet), Math.round(sg / wet), Math.round(sb / wet)],
    };
  }
  function analyze() {
    var v = S.video,
      cr = S.crop,
      cols = C.grid.cols,
      rows = C.grid.rows,
      n = A.samplesPerTile;
    S.ax.drawImage(
      v,
      cr.x * v.videoWidth,
      cr.y * v.videoHeight,
      cr.w * v.videoWidth,
      cr.h * v.videoHeight,
      0,
      0,
      S.aw,
      S.ah,
    );
    var d = (S.data = S.ax.getImageData(0, 0, S.aw, S.ah).data),
      tw = S.aw / cols,
      th = S.ah / rows,
      tiles = [];
    for (var r = 0; r < rows; r++)
      for (var c = 0; c < cols; c++) {
        var tile = measure(d, c * tw, r * th, tw, th, n);
        tile.col = c;
        tile.row = r;
        tiles.push(tile);
      }
    return tiles;
  }
  /* The listening spot, read at full detail from the frame analyze() just drew. */
  function sampleSpot() {
    var s = S.spot,
      pw = (SPOT_DEG / 360) * S.aw,
      ph = (SPOT_DEG / 180) * S.ah;
    var cx = ((s.lon + 180) / 360) * S.aw,
      cy = ((90 - s.lat) / 180) * S.ah;
    return measure(S.data, cx - pw / 2, cy - ph / 2, pw, ph, 8);
  }
  /* Mean position on the legend over every tile with signal, or null. This feeds the planet drone. */
  function planetMean(tiles) {
    var n = 0,
      sum = 0;
    tiles.forEach(function (t) {
      if (wetTile(t)) {
        n++;
        sum += t.norm;
      }
    });
    return n ? sum / n : null;
  }

  /* ===== REGION 6: AUDIO ===== */
  function initAudio() {
    if (S.ctx) {
      S.ctx.resume();
      return;
    }
    var ctx = (S.ctx = new (
      window.AudioContext || window.webkitAudioContext
    )());
    var comp = ctx.createDynamicsCompressor();
    S.master = ctx.createGain();
    S.master.gain.value = parseFloat($("volume").value);
    S.master.connect(comp);
    comp.connect(ctx.destination);
    var conv = ctx.createConvolver(),
      len = ctx.sampleRate * 1.2,
      buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (var ch = 0; ch < 2; ch++) {
      var a = buf.getChannelData(ch);
      for (var k = 0; k < len; k++)
        a[k] = (Math.random() * 2 - 1) * Math.pow(1 - k / len, 3);
    }
    conv.buffer = buf;
    var wet = ctx.createGain();
    wet.gain.value = REVERB;
    S.conv = conv;
    conv.connect(wet);
    wet.connect(S.master);
    newBus();
    /* The scene bus carries the long-running nature layers and the drone. It is never swapped out. */
    S.sceneBus = ctx.createGain();
    S.sceneBus.connect(S.master);
    S.sceneBus.connect(S.conv);
    /* Scene layers (scene-layers.js) plug into the scene bus, the reverb and the instruments. */
    if (window.SceneLayers)
      SceneLayers.attach({
        ctx: ctx,
        out: S.sceneBus,
        reverb: S.conv,
        rows: C.grid.rows,
        voice: voice,
      });
    var dro = ctx.createOscillator(),
      dg = ctx.createGain();
    dro.type = "sine";
    dro.frequency.value = midiToHz(36);
    dg.gain.value = 0;
    dro.connect(dg);
    dg.connect(S.sceneBus);
    dro.start();
    S.drone = { o: dro, g: dg };

    /* The sustained voice: two slightly detuned oscillators that glide to each new pitch. */
    var po = ctx.createOscillator(),
      po2 = ctx.createOscillator(),
      pf = ctx.createBiquadFilter(),
      pg = ctx.createGain(),
      pp = ctx.createStereoPanner();
    po.type = "triangle";
    po2.type = "sine";
    po2.detune.value = 7;
    pf.type = "lowpass";
    pf.frequency.value = 1200;
    pg.gain.value = 0;
    po.connect(pf);
    po2.connect(pf);
    pf.connect(pg);
    pg.connect(pp);
    pp.connect(S.sceneBus);
    po.start();
    po2.start();
    S.pad = { o: po, o2: po2, f: pf, g: pg, p: pp };
  }
  function newBus() {
    var old = S.bus;
    if (old) {
      old.gain.setTargetAtTime(0, S.ctx.currentTime, 0.02);
      setTimeout(function () {
        old.disconnect();
      }, 250);
    }
    S.bus = S.ctx.createGain();
    S.bus.connect(S.master);
    S.bus.connect(S.conv);
  }
  function envelope(g, t, peak, dur) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  }

  function tone(type, f, amp, t, dur, dest, detune) {
    // one decaying partial
    var o = S.ctx.createOscillator(),
      pg = S.ctx.createGain();
    o.type = type;
    o.frequency.value = f;
    if (detune) o.detune.value = detune;
    pg.gain.setValueAtTime(amp, t);
    pg.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(pg);
    pg.connect(dest);
    o.start(t);
    o.stop(t + dur + 0.05);
  }
  function ksBuf(f) {
    // Karplus-Strong plucked string, cached per pitch
    var key = Math.round(f * 10);
    S.ks = S.ks || {};
    if (S.ks[key]) return S.ks[key];
    var sr = S.ctx.sampleRate,
      n = Math.floor(sr * 3.4), // long tail: the acoustic strum rings on
      N = Math.max(2, Math.round(sr / f)),
      b = S.ctx.createBuffer(1, n, sr),
      a = b.getChannelData(0),
      i;
    for (i = 0; i < N; i++) a[i] = Math.random() * 2 - 1;
    for (i = N; i < n; i++) a[i] = 0.998 * 0.5 * (a[i - N] + a[i - N + 1]);
    return (S.ks[key] = b);
  }
  /* Each instrument gets: frequency, start time, volume, and a gain node to shape. */
  var INSTR = {
        /* Kenan's drop as a note: drip falls onto its pitch, ice rings steady with a glassy overtone */
    drip: function (f, t, v, g) {
      var o = S.ctx.createOscillator();
      o.type = "sine";
      o.frequency.setValueAtTime(f * 1.35, t);
      o.frequency.exponentialRampToValueAtTime(f, t + 0.07);
      o.connect(g);
      o.start(t);
      o.stop(t + 1.5);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(v * 0.8, t + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0008, t + 1.4);
    },
    ice: function (f, t, v, g) {
      tone("sine", f, 1, t, 1.4, g);
      tone("sine", f * 2.76, 0.4, t, 0.7, g); // inharmonic partial: rings like glass
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(v * 0.8, t + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0008, t + 1.4);
    },
    harp: function (f, t, v, g) {
      var c = S.ctx,
        fl = c.createBiquadFilter(),
        send = c.createGain();
      fl.type = "lowpass";
      fl.frequency.setValueAtTime(f * 6, t);
      fl.frequency.exponentialRampToValueAtTime(f * 1.8, t + 2.5); // gets darker as it fades
      fl.connect(g);
      tone("sine", f, 1, t, 3.2, fl, -4); // two detuned strings
      tone("sine", f, 0.8, t, 3.2, fl, 5);
      tone("triangle", f * 2, 0.25, t, 2, fl);
      tone("sine", f * 4, 0.08, t + 0.02, 1.6, fl); // shimmer
      tone("sine", f * 2, 0.18, t + 0.28, 2.2, fl); // ghost echo, an octave up
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(v * 0.8, t + 0.03); // soft attack
      g.gain.exponentialRampToValueAtTime(0.0001, t + 3.4);
      send.gain.value = 0.9;
      g.connect(send);
      send.connect(S.conv); // extra reverb
    },
    windchime: function (f, t, v, g) {
      // a quick scatter of metal tubes, notes from your scale
      var c = S.ctx,
        n = 4 + Math.floor(Math.random() * 3),
        k,
        send = c.createGain();
      for (k = 0; k < n; k++) {
        var w = t + Math.random() * 0.9,
          p = c.createStereoPanner(),
          a = 0.5 + Math.random() * 0.5,
          fq =
            f *
            2 *
            Math.pow(
              2,
              C.scale[Math.floor(Math.random() * C.scale.length)] / 12,
            );
        p.pan.value = Math.random() * 1.6 - 0.8;
        p.connect(g);
        tone("sine", fq, a, w, 2.4, p);
        tone("sine", fq * 2.76, a * 0.4, w, 1.2, p); // tube-like inharmonic partials
        tone("sine", fq * 5.4, a * 0.2, w, 0.6, p);
      }
      g.gain.setValueAtTime(v * 0.7, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 3.3);
      send.gain.value = 0.7;
      g.connect(send);
      send.connect(S.conv);
    },
    /* CREATIVE CHOICE: the piano never plays a lone note. Each note is prolonged into a
       triad (root, third, fifth) that is rolled like a hand spreading the chord, and it rings
       for about four seconds. The third carries the feeling: major (4 semitones) sounds open
       and bright, minor (3 semitones) sounds darker and inward. The data picks which one
       (see setMood): the upper half of the legend is major, the lower half minor. So the
       chord colour is a second, quiet reading of the value, on top of the pitch. */
    piano: function (f, t, v, g) {
      var c = S.ctx,
        steps = S.mood ? [0, 4, 7] : [0, 3, 7],
        fl = c.createBiquadFilter(),
        amps = [1, 0.55, 0.35, 0.22, 0.14];
      fl.type = "lowpass";
      fl.frequency.setValueAtTime(Math.min(9000, f * 10), t);
      fl.frequency.exponentialRampToValueAtTime(f * 2.5, t + 1.6); // bright hit, mellow decay
      fl.connect(g);
      steps.forEach(function (st, j) {
        var ff = f * Math.pow(2, st / 12),
          w = t + j * 0.018, // the roll: each chord tone lands a hair later
          k = j === 0 ? 1 : 0.7; // root leads, third and fifth sit behind it
        for (var n = 1; n <= 5; n++)
          tone(
            "sine",
            ff * n * Math.sqrt(1 + 0.0004 * n * n), // slightly stretched partials, like real strings
            amps[n - 1] * k * 0.5,
            w,
            4 / Math.sqrt(n),
            fl,
            n === 1 ? -2 : 0,
          );
        tone("sine", ff, 0.25 * k, w, 4, fl, 3); // second string
      });
      var h = c.createBufferSource(),
        hf = c.createBiquadFilter(),
        hg = c.createGain(); // hammer thump
      h.buffer = noiseBuf();
      hf.type = "lowpass";
      hf.frequency.value = Math.min(4000, f * 4);
      hg.gain.setValueAtTime(0.25, t);
      hg.gain.exponentialRampToValueAtTime(0.0001, t + 0.04);
      h.connect(hf);
      hf.connect(hg);
      hg.connect(g);
      h.start(t, Math.random(), 0.05);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(v * 0.45, t + 0.005);
      g.gain.exponentialRampToValueAtTime(v * 0.15, t + 0.6); // quick drop, then a long tail
      g.gain.exponentialRampToValueAtTime(0.0001, t + 4);
    },
    /* CREATIVE CHOICE: the xylophone replaces the old lyre. A xylophone bar is tuned so its
       overtones sit at 1 : 3 : 6 times the pitch, which is what gives it that hollow, woody
       "tok". Three short sine partials at those ratios, a hard mallet click, and a quiet
       longer fundamental (the resonator tube under the bar) are all it takes. Notes die in
       well under a second, so fast readings stay crisp and every pitch is easy to place. */
    xylophone: function (f, t, v, g) {
      var c = S.ctx,
        k = c.createBufferSource(),
        kf = c.createBiquadFilter(),
        kg = c.createGain();
      k.buffer = noiseBuf();
      kf.type = "bandpass";
      kf.frequency.value = 3500;
      kf.Q.value = 1;
      kg.gain.setValueAtTime(0.35, t);
      kg.gain.exponentialRampToValueAtTime(0.0001, t + 0.015); // the mallet
      k.connect(kf);
      kf.connect(kg);
      kg.connect(g);
      k.start(t, Math.random(), 0.03);
      tone("sine", f, 1, t, 0.55, g); // the bar
      tone("sine", f * 3, 0.5, t, 0.3, g);
      if (f * 6 < 15000) tone("sine", f * 6, 0.18, t, 0.15, g);
      tone("sine", f, 0.3, t, 0.9, g); // the resonator tube
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(v * 0.9, t + 0.002);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.95);
    },
    flute: function (f, t, v, g) {
      var c = S.ctx,
        F = f * 2,
        o = c.createOscillator(),
        lfo = c.createOscillator(),
        la = c.createGain(),
        n = c.createBufferSource(),
        nf = c.createBiquadFilter(),
        ng = c.createGain();
      o.type = "sine";
      o.frequency.value = F;
      lfo.frequency.value = 5;
      la.gain.value = F * 0.006;
      lfo.connect(la);
      la.connect(o.frequency); // vibrato
      n.buffer = noiseBuf();
      nf.type = "bandpass";
      nf.frequency.value = F * 2;
      nf.Q.value = 6;
      ng.gain.value = 0.25; // breath
      n.connect(nf);
      nf.connect(ng);
      ng.connect(g);
      o.connect(g);
      o.start(t);
      lfo.start(t);
      n.start(t);
      o.stop(t + 0.9);
      lfo.stop(t + 0.9);
      n.stop(t + 0.9);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(v, t + 0.12);
      g.gain.setValueAtTime(v, t + 0.45);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.85);
    },
    rainstick: function (f, t, v, g) {
      // a shower of tiny pebbles; pitch only nudges the brightness
      var c = S.ctx,
        hi = 2500 + f * 3,
        k;
      for (k = 0; k < 16; k++) {
        var w = t + Math.random(),
          s = c.createBufferSource(),
          bf = c.createBiquadFilter(),
          pg = c.createGain();
        s.buffer = noiseBuf();
        bf.type = "bandpass";
        bf.frequency.value = hi * (0.5 + Math.random() * 0.9);
        bf.Q.value = 5;
        pg.gain.setValueAtTime(0.0001, w);
        pg.gain.exponentialRampToValueAtTime(
          0.5 * (1 - (w - t) * 0.6),
          w + 0.004,
        );
        pg.gain.exponentialRampToValueAtTime(0.0001, w + 0.07);
        s.connect(bf);
        bf.connect(pg);
        pg.connect(g);
        s.start(w, Math.random(), 0.1);
      }
      envelope(g, t, v * 2, 1.2);
    },
    /* CREATIVE CHOICE: the guitar is a chord ladder, so a listener can name what they hear.
       Each of the 15 note steps maps onto 24 low chords, in the order of a guitarist's low
       E string: E Major, E Minor, F Major, F Minor, F sharp / G flat Major, F sharp / G flat
       Minor, and on up to D sharp / E flat Minor. The root sits between E2 and D sharp 3, so
       everything is low and warm. Each note is ONE acoustic strum: the root note is struck
       alone and a little louder (the thumb bass), then the other four strings sweep up from
       it. Root first, always (no alternating up-strums) so the ear catches the root and
       knows the pitch. The strings are long Karplus-Strong tails of about three seconds, a
       wooden body is faked with two low resonances (110 and 230 Hz), and a lowpass closes
       as the sound fades, like a real guitar going warm and dull. The chord name is shown
       on screen and read out in the sound key. */
    guitar: function (f, t, v, g) {
      var c = S.ctx,
        ch = chordForStep(stepOfFreq(f)),
        shape = [0, 7, 12, 12 + (ch.minor ? 3 : 4), 19], // root, fifth, octave, third, high fifth
        body = c.createBiquadFilter(),
        top = c.createBiquadFilter(),
        warm = c.createBiquadFilter(),
        pk = c.createBufferSource(),
        pf = c.createBiquadFilter(),
        pg = c.createGain();
      body.type = "peaking";
      body.frequency.value = 110;
      body.gain.value = 7;
      body.Q.value = 1.2;
      top.type = "peaking";
      top.frequency.value = 230;
      top.gain.value = 4;
      top.Q.value = 1.5;
      warm.type = "lowpass";
      warm.frequency.setValueAtTime(6000, t);
      warm.frequency.exponentialRampToValueAtTime(1800, t + 3);
      body.connect(top);
      top.connect(warm);
      warm.connect(g);
      pk.buffer = noiseBuf(); // the pick
      pf.type = "bandpass";
      pf.frequency.value = 2500;
      pf.Q.value = 1;
      pg.gain.setValueAtTime(0.15, t);
      pg.gain.exponentialRampToValueAtTime(0.0001, t + 0.025);
      pk.connect(pf);
      pf.connect(pg);
      pg.connect(g);
      pk.start(t, Math.random(), 0.05);
      shape.forEach(function (st, j) {
        var src = c.createBufferSource(),
          sg = c.createGain(),
          w = t + (j ? 0.07 + j * 0.05 + Math.random() * 0.008 : 0); // root first, then the sweep
        src.buffer = ksBuf(midiToHz(ch.midi + st));
        sg.gain.value = j === 0 ? 1.5 : 1 - j * 0.1; // the root note speaks loudest
        src.connect(sg);
        sg.connect(body);
        src.start(w);
        src.stop(w + 3.3);
      });
      g.gain.setValueAtTime(v * 0.75, t);
      g.gain.exponentialRampToValueAtTime(v * 0.4, t + 0.9);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 3.5);
      setTimeout(
        function () {
          chordLabel(ch); // show the chord at the moment it sounds
        },
        Math.max(0, (t - c.currentTime) * 1000),
      );
    },
    /* CREATIVE CHOICE: the violin is a bowed string, the only voice that swells. Two slightly
       detuned sawtooth strings, a bow that bites in over 90 ms, and a filter that opens as
       the bow catches. Vibrato arrives late (it starts at zero and grows over 0.4 s), because
       a real player lets the note settle before shaking it. A whisper of bow noise and a
       wooden body resonance near 550 Hz keep it from sounding like a synth. */
    violin: function (f, t, v, g) {
      var c = S.ctx,
        dur = 1.1,
        fl = c.createBiquadFilter(),
        bd = c.createBiquadFilter(),
        lfo = c.createOscillator(),
        la = c.createGain(),
        n = c.createBufferSource(),
        nf = c.createBiquadFilter(),
        ng = c.createGain();
      fl.type = "lowpass";
      fl.Q.value = 1.2;
      fl.frequency.setValueAtTime(f * 2, t);
      fl.frequency.linearRampToValueAtTime(Math.min(8000, f * 7), t + 0.15);
      bd.type = "peaking";
      bd.frequency.value = 550;
      bd.gain.value = 5;
      bd.Q.value = 1.4;
      fl.connect(bd);
      bd.connect(g);
      lfo.frequency.value = 5.5;
      la.gain.setValueAtTime(0, t);
      la.gain.linearRampToValueAtTime(14, t + 0.4); // vibrato depth in cents
      lfo.connect(la);
      [-6, 6].forEach(function (dt) {
        var o = c.createOscillator();
        o.type = "sawtooth";
        o.frequency.value = f;
        o.detune.value = dt;
        la.connect(o.detune);
        o.connect(fl);
        o.start(t);
        o.stop(t + dur + 0.1);
      });
      lfo.start(t);
      lfo.stop(t + dur + 0.1);
      n.buffer = noiseBuf(); // bow noise
      nf.type = "bandpass";
      nf.frequency.value = f * 3;
      nf.Q.value = 2;
      ng.gain.value = 0.05;
      n.connect(nf);
      nf.connect(ng);
      ng.connect(g);
      n.start(t, Math.random(), dur);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(v * 0.3, t + 0.09); // the bow catches
      g.gain.exponentialRampToValueAtTime(v * 0.24, t + 0.7);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    },
    /* CREATIVE CHOICE: the accordion is a reed organ, so it is built from reeds. Two square
       reeds detuned a few cents either side of the note (the "musette" shimmer that makes an
       accordion sound like an accordion), a sawtooth reed an octave up and one at pitch. A
       nasal peak near 1.2 kHz gives the reedy honk. The bellows are the envelope: a soft
       push in, a small swell, a slow release, plus a gentle 6.5 Hz bellows shake and a tiny
       key click as each note starts. */
    accordion: function (f, t, v, g) {
      var c = S.ctx,
        dur = 0.95,
        lp = c.createBiquadFilter(),
        nz = c.createBiquadFilter(),
        tg = c.createGain(),
        lfo = c.createOscillator(),
        la = c.createGain(),
        k = c.createBufferSource(),
        kf = c.createBiquadFilter(),
        kg = c.createGain();
      lp.type = "lowpass";
      lp.frequency.value = Math.min(9000, Math.max(900, f * 6));
      nz.type = "peaking";
      nz.frequency.value = 1200;
      nz.gain.value = 6;
      nz.Q.value = 2;
      tg.gain.value = 0.92;
      lfo.frequency.value = 6.5;
      la.gain.value = 0.08;
      lfo.connect(la);
      la.connect(tg.gain);
      lp.connect(nz);
      nz.connect(tg);
      tg.connect(g);
      [
        ["square", f, -7, 0.5],
        ["square", f, 7, 0.5],
        ["sawtooth", f * 2, 0, 0.25],
        ["sawtooth", f, 0, 0.35],
      ].forEach(function (r) {
        var o = c.createOscillator(),
          og = c.createGain();
        o.type = r[0];
        o.frequency.value = r[1];
        o.detune.value = r[2];
        og.gain.value = r[3];
        o.connect(og);
        og.connect(lp);
        o.start(t);
        o.stop(t + dur + 0.1);
      });
      lfo.start(t);
      lfo.stop(t + dur + 0.1);
      k.buffer = noiseBuf(); // key click
      kf.type = "highpass";
      kf.frequency.value = 2500;
      kg.gain.setValueAtTime(0.1, t);
      kg.gain.exponentialRampToValueAtTime(0.0001, t + 0.01);
      k.connect(kf);
      kf.connect(kg);
      kg.connect(g);
      k.start(t, Math.random(), 0.03);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(v * 0.3, t + 0.05); // bellows push in
      g.gain.exponentialRampToValueAtTime(v * 0.36, t + 0.4); // small swell
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    },
    /* CREATIVE CHOICE: the drum is for intense, clear beats, so it is short, dry and loud,
       and it stays a pitched instrument so the data is still readable. The note's height
       picks the part of the kit: low notes are a kick (a sine falling from 150 to 45 Hz),
       middle notes are a tom with a snare crack, high notes are a tom with a hi-hat tick.
       Inside each part the tom pitch still climbs with the value. Every hit starts with a
       stick click so each beat is clear even when the spot reads four times a second. */
    drum: function (f, t, v, g) {
      var c = S.ctx,
        m = 69 + 12 * Math.log2(f / 440),
        pos = Math.max(0, Math.min(1, (m - LOW_MIDI) / (12 * OCTAVES))),
        base = 60 + pos * 160;
      function sweep(f0, f1, sw, dur, amp) {
        var o = c.createOscillator(),
          og = c.createGain();
        o.type = "sine";
        o.frequency.setValueAtTime(f0, t);
        o.frequency.exponentialRampToValueAtTime(f1, t + sw);
        og.gain.setValueAtTime(amp, t);
        og.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(og);
        og.connect(g);
        o.start(t);
        o.stop(t + dur + 0.05);
      }
      function hit(type, hz, q, amp, dur) {
        var s2 = c.createBufferSource(),
          bf = c.createBiquadFilter(),
          hg = c.createGain();
        s2.buffer = noiseBuf();
        bf.type = type;
        bf.frequency.value = hz;
        bf.Q.value = q;
        hg.gain.setValueAtTime(amp, t);
        hg.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        s2.connect(bf);
        bf.connect(hg);
        hg.connect(g);
        s2.start(t, Math.random(), dur + 0.05);
      }
      hit("highpass", 3000, 0.7, 0.5, 0.012); // stick click
      if (pos < 0.34) {
        sweep(150, 45, 0.08, 0.4, 1); // kick
        sweep(base * 1.5, base, 0.05, 0.2, 0.4);
      } else if (pos < 0.67) {
        sweep(base * 1.8, base, 0.06, 0.3, 0.8); // tom
        hit("bandpass", 1800, 0.8, 0.6, 0.15); // snare crack
      } else {
        sweep(base * 1.8, base, 0.06, 0.25, 0.5); // small tom
        hit("highpass", 7000, 0.7, 0.5, 0.06); // hi-hat tick
      }
      g.gain.setValueAtTime(v * 1.4, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.55);
    },
  };
  /* Which instrument a tile plays: the legend's own timbre, then config.timbres[type], then default. */
  function timbreOf(t) {
    if (S.instr) return S.instr; // the I key overrides every preset and legend
    var L = legendFor(t);
    var k = (L && L.spec.timbre) || C.timbres[t.type] || C.timbres["default"];
    return k === "lyre" ? "xylophone" : k;
  }
  /* How loud a tile's note is: 0.1 to 0.45 by strength, times noteGain for its data type. Used by every view. */
  function noteLoud(t) {
    return (
      (LOUD[0] + (LOUD[1] - LOUD[0]) * t.norm) *
      (NOTE_GAIN[t.type] || NOTE_GAIN["default"] || 1)
    );
  }
  /* Chord colour for the piano and guitar: the upper half of the legend is major (bright),
     the lower half is minor (dark). Call it right before voice(). */
  function setMood(norm) {
    S.mood = norm === undefined || norm >= 0.5 ? 1 : 0;
  }
  /* The guitar's chord ladder: 12 roots from low E (E2) up by semitones, each as Major then
     Minor, 24 chords. A note step (0 to 14) is spread across the ladder. */
  var ROOT_SHOW = ["E", "F", "F\u266F/G\u266D", "G", "G\u266F/A\u266D", "A", "A\u266F/B\u266D", "B", "C", "C\u266F/D\u266D", "D", "D\u266F/E\u266D"];
  var ROOT_SAY = ["E", "F", "F sharp or G flat", "G", "G sharp or A flat", "A", "A sharp or B flat", "B", "C", "C sharp or D flat", "D", "D sharp or E flat"];
  var LOW_E = 40; // MIDI 40 = E2, the guitar's lowest string
  function stepOfFreq(f) {
    var m = 69 + 12 * Math.log2(f / 440),
      len = C.scale.length * OCTAVES,
      best = 0,
      bd = 1e9;
    for (var k = 0; k < len; k++) {
      var d = Math.abs(noteFor(k) - m);
      if (d < bd) {
        bd = d;
        best = k;
      }
    }
    return best;
  }
  function chordForStep(k) {
    var len = C.scale.length * OCTAVES,
      idx = Math.round((k / (len - 1)) * 23),
      root = idx >> 1,
      minor = idx % 2 === 1;
    return {
      idx: idx,
      root: root,
      minor: minor,
      midi: LOW_E + root,
      name: ROOT_SHOW[root] + (minor ? " Minor" : " Major"),
      say: ROOT_SAY[root] + (minor ? " minor" : " major"),
    };
  }
  function chordLabel(ch) {
    var el = $("chordName");
    if (el && currentInstr() === "guitar") el.textContent = "Chord: " + ch.name;
  }
  /* The eight chords of the sound key, read out for screen reader users. */
  function keyChordText(n) {
    if (S.target !== "spot") return "";
    var names = [];
    for (var q = 0; q < n; q++) names.push(chordForStep(indexForNorm(q / (n - 1))).say);
    return " The chords, from the lowest value to the highest: " + names.join(", ") + ".";
  }
  function notesOn() {
    return C.notes !== false;
  }
  function voice(freq, t, kind, vol, pan) {
    if (kind === "lyre") kind = "xylophone"; // the old name still comes from config.js and scene-layers.js
    var ctx = S.ctx,
      g = ctx.createGain(),
      pn = ctx.createStereoPanner();
    pn.pan.value = pan;
    g.connect(pn);
    pn.connect(S.bus);
    if (INSTR[kind]) {
      INSTR[kind](freq, t, vol, g);
      return;
    }
    if (kind === "bell") {
      [
        [1, 1],
        [2.76, 0.35],
        [5.4, 0.15],
      ].forEach(function (pr) {
        var o = ctx.createOscillator(),
          pg = ctx.createGain();
        o.type = "sine";
        o.frequency.value = freq * pr[0];
        pg.gain.value = pr[1];
        o.connect(pg);
        pg.connect(g);
        o.start(t);
        o.stop(t + 1.2);
      });
      envelope(g, t, vol, 1.0);
    } else {
      var o = ctx.createOscillator(),
        f = ctx.createBiquadFilter();
      o.type = "triangle";
      o.frequency.value = freq;
      f.type = "lowpass";
      f.frequency.setValueAtTime(freq * 6, t);
      f.frequency.exponentialRampToValueAtTime(freq * 1.5, t + 0.3);
      o.connect(f);
      f.connect(g);
      o.start(t);
      o.stop(t + 0.5);
      envelope(g, t, vol, 0.4);
    }
  }

  /* --- Scene layers (nature texture) ---
   Everything about them lives in scene-layers.js (settings, custom layers) and scene-engine.js (shared engine).
   app.js only hands each reading to SceneLayers.feed(). Adding a layer never touches this file. */
  function noiseBuf() {
    // shared noise, also used by the instruments
    if (S.noise) return S.noise;
    var c = S.ctx,
      n = c.sampleRate * 2,
      b = c.createBuffer(1, n, c.sampleRate),
      a = b.getChannelData(0);
    for (var i = 0; i < n; i++) a[i] = Math.random() * 2 - 1;
    return (S.noise = b);
  }
  /* Spot view: one value lights its pitch row, and the rows next to it at half strength. High value = high row. */
  function spotRows(n) {
    var R = C.grid.rows,
      a = new Array(R).fill(0),
      k = Math.round((S.invert ? n : 1 - n) * (R - 1));
    a[k] = n;
    if (k > 0) a[k - 1] = n * 0.5;
    if (k < R - 1) a[k + 1] = n * 0.5;
    return a;
  }
  /* Chord view: the mean strength of each latitude row. */
  function rowMeans(tiles) {
    var cols = C.grid.cols,
      R = C.grid.rows,
      out = [],
      r,
      c;
    for (r = 0; r < R; r++) {
      var s = 0,
        n = 0;
      for (c = 0; c < cols; c++) {
        var t = tiles[r * cols + c];
        if (wetTile(t)) {
          s += t.norm;
          n++;
        }
      }
      out.push(n ? s / n : 0);
    }
    return out;
  }
  /* Hand one reading to its scene layer. rows: per-latitude strengths (map views); a: anomaly (spot view). */
  function scene(kind, tile, pan, ms, rows, a) {
    if (!window.SceneLayers) return;
    if (kind === "none" || !SceneLayers.has(kind)) {
      SceneLayers.silence();
      return;
    }
    SceneLayers.feed(kind, {
      norm: tile.norm,
      value: tile.value,
      type: tile.type,
      rows: rows || spotRows(tile.norm),
      pan: pan,
      ms: ms || SPOT_MS,
      rate: parseFloat($("rate").value) || 1,
      anomaly: a || 0,
      lat: S.spot.lat,
      lon: S.spot.lon,
      view: S.target,
    });
  }
  function silenceScene() {
    padOff();
    if (window.SceneLayers) SceneLayers.silence();
  }
  /* Texture for any tile in any view: picks the layer from the tile's own legend. No tile = silence. */
  function texture(tile, pan, ms, rows) {
    if (!tile || !wetTile(tile)) {
      silenceScene();
      return;
    }
    scene(sceneOf(legendFor(tile)), tile, pan, ms, rows, 0);
  }
  /* The planet drone: one low tone that rises a little as the mean value of the whole map rises. */
  function drone(mean) {
    if (!C.drone || !S.drone || !S.ctx) return;
    var t = S.ctx.currentTime;
    S.drone.g.gain.setTargetAtTime(mean === null ? 0 : 0.05, t, 0.5);
    if (mean !== null)
      S.drone.o.frequency.setTargetAtTime(midiToHz(36 + 8 * mean), t, 0.8);
  }
  /* How far this value sits above this place's own early baseline (first 8 readings). */
  function anomaly(norm) {
    if (S.base.length < 8) {
      S.base.push(norm);
      return 0;
    }
    return (
      norm -
      S.base.reduce(function (a, b) {
        return a + b;
      }, 0) /
        S.base.length
    );
  }

  function noteFor(k) {
    var len = C.scale.length * OCTAVES;
    k = Math.max(0, Math.min(len - 1, k));
    return (
      LOW_MIDI +
      12 * Math.floor(k / C.scale.length) +
      C.scale[k % C.scale.length]
    );
  }
  /* Whole-map view: row -> pitch (north high). */
  function pitchFor(row) {
    var rows = C.grid.rows,
      len = C.scale.length * OCTAVES;
    return noteFor(
      Math.round(((S.invert ? row : rows - 1 - row) / (rows - 1)) * (len - 1)),
    );
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
  /* Sustained voice: only glides and fades, never stops or disconnects.
   Turn it off with  sustain: false  in config.js if it hides your instrument. */
  function pad(m, norm, pan) {
    if (!S.pad || !S.ctx || C.sustain === false) return;
    var t = S.ctx.currentTime,
      f = midiToHz(m - 12);
    S.pad.o.frequency.setTargetAtTime(f, t, 0.15);
    S.pad.o2.frequency.setTargetAtTime(f, t, 0.15);
    S.pad.f.frequency.setTargetAtTime(600 + 2000 * norm, t, 0.2);
    S.pad.g.gain.setTargetAtTime(0.04 + 0.08 * norm, t, 0.2);
    S.pad.p.pan.setTargetAtTime(Math.max(-1, Math.min(1, pan)), t, 0.2);
  }
  function padOff() {
    if (S.pad && S.ctx)
      S.pad.g.gain.setTargetAtTime(0, S.ctx.currentTime, 0.15);
  }
  function inBand(r) {
    var b = S.active;
    return !b || (r >= b.rowStart && r < b.rowEnd);
  }
  function glow(t) {
    var s = document.documentElement.style;
    if (t && t.color) {
      s.setProperty("--pulse", "rgb(" + t.color.join(",") + ")");
      s.setProperty("--pi", Math.max(0.25, t.norm));
    } else s.setProperty("--pi", 0);
  }
  function pulseOff() {
    glow(null);
  }
  /* One reading becomes: a texture (every tick), a note (every NOTE_EVERY ticks), and a quiet
   semitone clash when the value is above this place's usual. preview = a single note only, no texture. */
  function playSample(t, when, preview) {
    if (!t || !wetTile(t)) {
      if (!preview) silenceScene();
      return;
    }
    var L = legendFor(t),
      kind = sceneOf(L),
      pan = ((FLIP * S.spot.lon) / 180) * PAN,
      a = preview ? 0 : anomaly(t.norm);
    var base = indexForNorm(t.norm),
      m = noteFor(base);
    if (!preview) {
      scene(kind, t, pan, SPOT_MS, null, a);
      pad(m, t.norm, pan);
    }
    if (!notesOn()) return; // notes: false = texture and drone only
    var noteNow =
      preview || kind === "none" || (S.ticks - 1) % NOTE_EVERY === 0;
    if (!noteNow) return;

    var timbre = timbreOf(t),
      vol = noteLoud(t);
    setMood(t.norm);
    pitchGuide(t.norm);
    var rate = parseFloat($("rate").value) || 1;
    var gap = SPOT_MS / 1000 / NOTES_PER_TICK / rate; // spread the notes across the tick
    for (var i = 0; i < NOTES_PER_TICK; i++) {
      var mi = noteFor(base + i * NOTE_SPREAD * (S.invert ? -1 : 1));
      voice(midiToHz(mi), when + i * gap, timbre, vol * (1 - i * 0.15), pan);
    }
    if (a > ANOMALY)
      voice(midiToHz(m + 1), when, "bell", Math.min(0.3, a), pan);
  }

  var KEY_GAP = {
    drip: 0.5, ice: 0.5,
    harp: 0.6,
    windchime: 1.0,
    piano: 0.45,
    flute: 0.6,
    xylophone: 0.4,
    violin: 0.8,
    accordion: 0.8,
    rainstick: 1.5,
    guitar: 0.9, // the strum rings long, so the key leaves room
    drum: 0.3,
    bell: 0.45,
  };
  var INSTR_NAME = {
    drip: "water drip", ice: "ice chime",
    harp: "dreamy harp",
    windchime: "wind chime",
    piano: "piano",
    flute: "flute",
    xylophone: "xylophone",
    violin: "violin",
    accordion: "accordion",
    rainstick: "rainstick",
    guitar: "acoustic guitar",
    drum: "drum kit",
    bell: "bell",
    pluck: "plucked note",
  };
  function soundKey() {
    initAudio();
    if (S.keyBusy) return;
    /* CREATIVE CHOICE: the key is a listening lesson, so nothing may talk over it.
       Playback pauses while the key sounds, then resumes where it left off. */
    var wasRunning = !!S.timer;
    if (wasRunning) stop();
    var L = S.legends[0],
      kt = timbreOf({ type: L.spec.type }),
      gap = KEY_GAP[kt] || 0.3,
      ng = NOTE_GAIN[L.spec.type] || NOTE_GAIN["default"] || 1,
      nm = INSTR_NAME[kt] || kt,
      t = S.ctx.currentTime + 0.05,
      i,
      n = 8,
      end,
      sc = (window.SceneLayers && SceneLayers.describe(sceneOf(L))) || "",
      unp =
        kt === "rainstick"
          ? " The rainstick has no clear pitch, so the notes change in brightness more than in height."
          : kt === "drum"
            ? " The drum changes with height: low notes are a kick, middle notes are a tom with a snare crack, high notes are a tom with a hi-hat."
            : kt === "piano"
            ? " The piano plays chords: bright major for higher values, darker minor for lower values."
            : kt === "guitar"
              ? " The acoustic guitar plays low chords, one strum per note, with the root note first." + keyChordText(8)
              : "",
      pz = wasRunning ? " Playback is paused while the key plays." : "";
    function guide(when, norm) {
      // the pitch meter follows each key note
      setTimeout(
        function () {
          pitchGuide(norm);
        },
        Math.max(0, (when - S.ctx.currentTime) * 1000),
      );
    }
    if (S.target === "spot") {
      for (i = 0; i < n; i++) {
        setMood(i / (n - 1));
        voice(midiToHz(pitchForNorm(i / (n - 1))), t + i * gap, kt, 0.25 * ng, 0);
        guide(t + i * gap, i / (n - 1));
      }
      var t2 = t + n * gap + 0.6;
      setMood(0.5);
      voice(midiToHz(pitchForNorm(0.5)), t2, kt, 0.1 * ng, 0);
      voice(midiToHz(pitchForNorm(0.5)), t2 + gap * 2, kt, 0.45 * ng, 0);
      end = t2 + gap * 2;
      say(
        "Sound key. The instrument is a " +
          nm +
          ". Eight notes from the lowest value on the legend to the highest." +
          (S.invert
            ? " Pitch is flipped: higher values are lower notes."
            : " Higher values are higher notes.") +
          " Then a quiet and a loud note: louder means a stronger value." +
          unp +
          " " +
          sc +
          " A second, slightly clashing note means warmer or wetter than this place usually is. A silence means no data or no signal. Sound in your left ear is west, right ear is east." +
          pz,
        true,
      );
    } else {
      var R = C.grid.rows;
      for (i = R - 1; i >= 0; i--) {
        setMood((R - 1 - i) / (R - 1));
        voice(midiToHz(pitchFor(i)), t + (R - 1 - i) * gap, kt, 0.25 * ng, 0);
        guide(t + (R - 1 - i) * gap, (R - 1 - i) / (R - 1));
      }
      var t3 = t + R * gap + 0.6;
      setMood(0.5);
      voice(midiToHz(pitchFor(4)), t3, kt, 0.1 * ng, 0);
      voice(midiToHz(pitchFor(4)), t3 + gap * 2, kt, 0.45 * ng, 0);
      voice(midiToHz(pitchFor(4)), t3 + gap * 4, "bell", 0.3, 0);
      end = t3 + gap * 4;
      say(
        "Sound key. The instrument is a " +
          nm +
          ". First, notes rising from south to north, low to high. Then a quiet note for a weak value, a loud note for a strong value, and a bell for snow." +
          unp +
          " " +
          sc +
          " Under the notes, the strongest signal sets the texture." +
          (S.target === "chord"
            ? " In chord view, one note sounds for each band, the strongest place in that band, panned to where it is."
            : "") +
          pz,
        true,
      );
    }
    S.keyBusy = true;
    setTimeout(
      function () {
        S.keyBusy = false;
        if (wasRunning && S.view === "play" && S.loaded && !S.timer) start();
      },
      (end - S.ctx.currentTime + 0.8) * 1000,
    );
  }
  /* ===== REGION 7: DESCRIPTION ===== */
  function bandText(b, tiles) {
    var cols = C.grid.cols,
      valid = 0,
      wet = [],
      types = {};
    for (var r = b.rowStart; r < b.rowEnd; r++)
      for (var c = 0; c < cols; c++) {
        var t = tiles[r * cols + c];
        if (t.value === null) continue;
        valid++;
        if (wetTile(t)) {
          wet.push(t);
          types[t.type] = (types[t.type] || 0) + 1;
        }
      }
    if (!valid) return "no data";
    if (!wet.length) return "dry";
    var top = wet.reduce(function (a, t) {
      return t.norm > a.norm ? t : a;
    });
    var kind = Object.keys(types).sort(function (a, b2) {
      return types[b2] - types[a];
    })[0];
    var level = top.norm < 0.33 ? "low" : top.norm < 0.66 ? "middle" : "high";
    return (
      Math.round((wet.length / valid) * 100) +
      " percent has signal, mostly " +
      kind +
      ", strongest is " +
      level +
      " near " +
      lonText(top.col)
    );
  }
  function describe(tiles) {
    return (
      "At " +
      S.video.currentTime.toFixed(0) +
      " seconds. " +
      C.bands
        .map(function (b) {
          return b.name + ": " + bandText(b, tiles) + ".";
        })
        .join(" ")
    );
  }
  function spotLine(t) {
    var where = S.spot.name + ", " + spotWhere();
    if (!t || t.value === null)
      return where + ": no data here. It may be land, or outside the map.";
    if (!wetTile(t)) return where + ": no signal here at this moment.";
    var L = legendFor(t);
    return (
      where +
      ": " +
      (L ? L.spec.label : "value") +
      " about " +
      fmt(t.value) +
      "." +
      (currentInstr() === "guitar"
        ? " Guitar chord: " + chordForStep(indexForNorm(t.norm)).say + "."
        : "")
    );
  }
  function updateTable(tiles) {
    $("bandTable").innerHTML = C.bands
      .map(function (b) {
        return (
          "<tr><th scope='row'>" +
          b.name +
          "</th><td>" +
          bandText(b, tiles) +
          "</td></tr>"
        );
      })
      .join("");
    var wet = 0,
      nodata = 0;
    tiles.forEach(function (t) {
      if (t.value === null) nodata++;
      else if (wetTile(t)) wet++;
    });
    $("stats").textContent =
      "Tiles with signal: " +
      wet +
      " of " +
      tiles.length +
      ". No-data tiles: " +
      nodata +
      ".";
  }
  /* Spoken summary when the video ends: what the sound did at this place. */
  function finishText() {
    var base = "Finished. ";
    if (S.target !== "spot") return base + "Press Play to hear it again.";
    var s = S.series;
    if (!s.length)
      return (
        base +
        "There was no data at " +
        S.spot.name +
        ". Move the spot and try again."
      );
    var L = S.legends[0],
      k = Math.max(1, Math.floor(s.length / 5));
    var mean = function (a) {
      return (
        a.reduce(function (x, y) {
          return x + y;
        }, 0) / a.length
      );
    };
    var first = mean(s.slice(0, k)),
      last = mean(s.slice(-k));
    var lo = Math.min.apply(null, s),
      hi = Math.max.apply(null, s),
      span = Math.abs(L.spec.max - L.spec.min);
    var move =
      Math.abs(last - first) < 0.05 * span
        ? "stayed about the same"
        : last > first
          ? "rose"
          : "fell";
    var quiet = Math.round((1 - s.length / Math.max(1, S.ticks)) * 100);
    return (
      base +
      "At " +
      S.spot.name +
      ", " +
      L.spec.label +
      " started near " +
      fmt(first) +
      " and ended near " +
      fmt(last) +
      ", so it " +
      move +
      ". Lowest " +
      fmt(lo) +
      ", highest " +
      fmt(hi) +
      "." +
      (quiet > 5 ? " It was silent " + quiet + " percent of the time." : "") +
      " Press Play to hear it again."
    );
  }

  /* ===== REGION 8: DRAWING ===== */
  function label(g, text, x, y, align) {
    g.font = "bold 28px sans-serif";
    g.textAlign = align;
    g.textBaseline = "middle";
    var w = g.measureText(text).width;
    var bx = align === "center" ? x - w / 2 : align === "left" ? x : x - w;
    g.fillStyle = "rgba(0,0,0,0.75)";
    g.fillRect(bx - 6, y - 18, w + 12, 36);
    g.fillStyle = "#fff";
    g.fillText(text, x, y);
  }
  function spotBox() {
    var s = S.spot;
    return {
      x: (s.lon + 180) / 360 - SPOT_DEG / 720,
      y: (90 - s.lat) / 180 - SPOT_DEG / 360,
      w: SPOT_DEG / 360,
      h: SPOT_DEG / 180,
    };
  }
  function markVideo(hc) {
    var cr = S.crop,
      cols = C.grid.cols,
      rows = C.grid.rows,
      b = S.active;
    function put(id, x, y, w, h, on) {
      var el = $(id);
      el.style.display = on ? "block" : "none";
      el.style.left = x * 100 + "%";
      el.style.top = y * 100 + "%";
      el.style.width = w * 100 + "%";
      el.style.height = h * 100 + "%";
    }
    if (S.target === "spot") {
      var sb = spotBox();
      put(
        "vcol",
        cr.x + sb.x * cr.w,
        cr.y + sb.y * cr.h,
        sb.w * cr.w,
        sb.h * cr.h,
        true,
      );
      put("vtop", 0, 0, 0, 0, false);
      put("vbot", 0, 0, 0, 0, false);
      return;
    }
    put(
      "vcol",
      cr.x + ((hc || 0) / cols) * cr.w,
      cr.y,
      cr.w / cols,
      cr.h,
      hc !== undefined,
    );
    put(
      "vtop",
      cr.x,
      cr.y,
      cr.w,
      b ? (b.rowStart / rows) * cr.h : 0,
      !!b && b.rowStart > 0,
    );
    put(
      "vbot",
      cr.x,
      cr.y + (b ? b.rowEnd / rows : 1) * cr.h,
      cr.w,
      b ? (1 - b.rowEnd / rows) * cr.h : 0,
      !!b && b.rowEnd < rows,
    );
  }
  function drawMap(tiles, hc) {
    var cv = $("map"),
      cs = 64,
      cols = C.grid.cols,
      rows = C.grid.rows,
      mapMode = mapLike();
    cv.width = cols * cs;
    cv.height = rows * cs;
    var g = cv.getContext("2d");
    g.fillStyle = "#000";
    g.fillRect(0, 0, cv.width, cv.height);
    tiles.forEach(function (t) {
      var x = t.col * cs,
        y = t.row * cs;
      if (t.value === null) return;
      if (t.norm === undefined) {
        g.strokeStyle = "#444";
        g.strokeRect(x + 0.5, y + 0.5, cs - 1, cs - 1);
        return;
      }
      g.fillStyle = "rgb(" + t.color.join(",") + ")";
      g.fillRect(x, y, cs, cs);
      if (S.legends.length > 1 && t.type !== S.legends[0].spec.type) {
        g.fillStyle = "#fff";
        g.fillRect(x + cs / 2 - 3, y + cs / 2 - 3, 6, 6);
      }
    });
    if (mapMode && S.active) {
      g.fillStyle = "rgba(0,0,0,0.65)";
      g.fillRect(0, 0, cv.width, S.active.rowStart * cs);
      g.fillRect(
        0,
        S.active.rowEnd * cs,
        cv.width,
        cv.height - S.active.rowEnd * cs,
      );
    }
    if (mapMode) {
      g.strokeStyle = "#fff";
      g.lineWidth = 3;
      C.bands.forEach(function (b) {
        g.beginPath();
        g.moveTo(0, b.rowStart * cs);
        g.lineTo(cv.width, b.rowStart * cs);
        g.stroke();
      });
      if (hc !== undefined) {
        g.strokeStyle = S.accent || "#fff";
        g.lineWidth = 5;
        g.strokeRect(hc * cs + 1.5, 1.5, cs - 3, cv.height - 3);
      }
      label(g, "NORTH (high notes)", cv.width / 2, 24, "center");
      label(g, "SOUTH (low notes)", cv.width / 2, cv.height - 24, "center");
      label(g, "WEST", 8, cv.height / 2, "left");
      label(g, "EAST", cv.width - 8, cv.height / 2, "right");
    } else {
      var b = spotBox(),
        px = (b.x + b.w / 2) * cv.width,
        py = (b.y + b.h / 2) * cv.height;
      g.lineWidth = 11;
      g.strokeStyle = "#000";
      g.beginPath();
      g.arc(px, py, 26, 0, 7);
      g.stroke();
      g.lineWidth = 5;
      g.strokeStyle = S.accent || "#fff";
      g.beginPath();
      g.arc(px, py, 26, 0, 7);
      g.stroke();
      label(g, S.spot.name, cv.width / 2, 24, "center");
    }
    markVideo(hc);
  }

  /* ===== REGION 9: PLAYBACK =====
   Every tick reads the frame that is on screen at this moment. Nothing is queued ahead.
   In sweep view the video is frozen during each sweep and only jumps between sweeps. */

  /* Guided tour: announce each cue once as the video passes its time, and move the spot. */
  function storyList() {
    return (C.storyTour && ITEMS[S.idx] && ITEMS[S.idx].story) || [];
  }
  function syncStory() {
    var st = storyList(),
      t = S.video.currentTime,
      n = 0;
    while (n < st.length && st[n].t < t - 0.01) n++;
    S.storyIdx = n;
  }
  function storyCheck() {
    var st = storyList(),
      t = S.video.currentTime;
    while (S.storyIdx < st.length && st[S.storyIdx].t <= t) {
      var cue = st[S.storyIdx++];
      if (cue.place && S.target === "spot") {
        var k = PLACES.map(function (x) {
          return x.name;
        }).indexOf(cue.place);
        if (k >= 0) {
          S.spot = placeCopy(k);
          $("place").value = k;
          S.base.length = 0;
        }
      }
      say(cue.text);
    }
  }
  function spotTick() {
    if (S.video.readyState < 2) return;
    S.ticks++;
    S.tiles = analyze();
    var t = (S.sample = sampleSpot());
    if (wetTile(t)) S.series.push(t.value);
    playSample(t, S.ctx.currentTime + 0.02);
    drone(planetMean(S.tiles));
    drawMap(S.tiles);
    glow(wetTile(t) ? t : null);
    $("now").textContent = spotLine(t);
    updateTable(S.tiles);
    storyCheck();
  }
  function colTick() {
    if (S.video.readyState < 2 || S.video.seeking) return;
    var cols = C.grid.cols,
      rows = C.grid.rows,
      c = S.col,
      r,
      col = [];
    if (c === 0) {
      S.active =
        S.mode === "all"
          ? null
          : S.mode === "cycle"
            ? C.bands[S.beat % C.bands.length]
            : C.bands[+S.mode];
      $("now").textContent =
        "Listening to: " +
        (S.active ? S.active.name : "all bands") +
        " at " +
        S.video.currentTime.toFixed(0) +
        " seconds";
      storyCheck();
    }
    S.tiles = analyze();
    for (r = 0; r < rows; r++) {
      var tl = S.tiles[r * cols + c];
      if (wetTile(tl) && inBand(r)) col.push(tl);
    }
    col.sort(function (a, b) {
      return b.norm - a.norm;
    });
    var pan = FLIP * (((c + 0.5) / cols) * 2 - 1) * PAN,
      when = S.ctx.currentTime + 0.02;
    if (notesOn())
      col.slice(0, MAX_PER_COL).forEach(function (n) {
        setMood(n.norm);
        voice(midiToHz(pitchFor(n.row)), when, timbreOf(n), noteLoud(n), pan);
      });
    if (col.length) pitchGuide(col[0].norm);
    /* the strongest signal in this column also drives the nature texture; rows = this column, one strength per latitude row */
    var rr = new Array(rows).fill(0);
    col.forEach(function (n) {
      rr[n.row] = n.norm;
    });
    texture(col[0], pan, SWEEP_MS / cols, rr);
    drawMap(S.tiles, c);
    glow(col[0]);
    if (c === 0) {
      drone(planetMean(S.tiles));
      updateTable(S.tiles);
      if (S.beat % ANNOUNCE === 0) say(describe(S.tiles));
    }
    S.col = (c + 1) % cols;
    if (!S.col) {
      // sweep finished: jump the video forward to the next moment
      S.beat++;
      var next = S.video.currentTime + SWEEP_STEP;
      if (next >= S.video.duration - 0.05) {
        stop(finishText(), true);
        return;
      }
      S.video.currentTime = next;
    }
  }
  /* Chord view: once a second, the strongest signal in each band sounds together. */
  function chordTick() {
    if (S.video.readyState < 2) return;
    var cols = C.grid.cols,
      when = S.ctx.currentTime + 0.02,
      heard = [],
      strongest = null;
    S.ticks++;
    S.tiles = analyze();
    S.active = null;
    C.bands.forEach(function (b) {
      var best = null;
      for (var r = b.rowStart; r < b.rowEnd; r++)
        for (var c = 0; c < cols; c++) {
          var tl = S.tiles[r * cols + c];
          if (wetTile(tl) && (!best || tl.norm > best.norm)) best = tl;
        }
      if (!best) return;
      heard.push(best);
      setMood(best.norm);
      if (!strongest || best.norm > strongest.norm) strongest = best;
      if (notesOn())
        voice(
          midiToHz(pitchFor(best.row)),
          when,
          timbreOf(best),
          noteLoud(best),
          FLIP * (((best.col + 0.5) / cols) * 2 - 1) * PAN,
        );
    });
    /* texture: the strongest signal anywhere sets the nature sound, panned to where it is; rows = mean of each latitude row */
    texture(
      strongest,
      strongest ? FLIP * (((strongest.col + 0.5) / cols) * 2 - 1) * PAN : 0,
      CHORD_MS,
      rowMeans(S.tiles),
    );
    drone(planetMean(S.tiles));
    drawMap(S.tiles);
    if (strongest) pitchGuide(strongest.norm);
    glow(strongest);
    $("now").textContent = heard.length
      ? "Chord: " +
        heard.length +
        " of " +
        C.bands.length +
        " bands have signal."
      : "Silence: no signal anywhere.";
    updateTable(S.tiles);
    if ((S.ticks - 1) % ANNOUNCE === 0) say(describe(S.tiles));
    storyCheck();
  }
  function start() {
    initAudio();
    var rate = parseFloat($("rate").value),
      mode = S.target,
      spot = mode === "spot";
    S.video.playbackRate = rate;
    if (mode === "map") {
      // freeze-sweep: the video stays still while a sweep reads it
      S.video.pause();
      if (S.video.duration && S.video.currentTime >= S.video.duration - 0.1)
        S.video.currentTime = 0;
    } else {
      var pr = S.video.play();
      if (pr && pr.catch) pr.catch(function () {});
    }
    if (S.video.currentTime < 0.5) {
      S.series = [];
      S.ticks = 0;
      S.beat = 0;
      S.base.length = 0;
      S.storyIdx = 0;
    }
    S.col = 0;
    clearInterval(S.timer);
    var tick = spot ? spotTick : mode === "chord" ? chordTick : colTick;
    var ms = spot
      ? SPOT_MS
      : mode === "chord"
        ? CHORD_MS
        : SWEEP_MS / C.grid.cols;
    tick();
    S.timer = setInterval(tick, ms / rate);
    $("play").innerHTML = PAUSE;
    document.body.classList.add("running");
    if (spot) say("Playing. Listening to " + S.spot.name + ".");
  }
  /* soft = let the last notes ring out (used when the video ends) */
  function stop(msg, soft) {
    clearInterval(S.timer);
    S.timer = null;
    if (S.ctx && !soft) newBus();
    if (S.ctx) {
      silenceScene();
      drone(null);
    }
    pulseOff();
    S.video.pause();
    $("play").innerHTML = PLAY;
    document.body.classList.remove("running");
    if (S.tiles) drawMap(S.tiles);
    if (msg) say(msg);
  }
  S.video.addEventListener("ended", function () {
    var m = finishText();
    stop(m, true);
  });
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
    var stops = [],
      k,
      n = 7,
      cv = document.querySelectorAll(".cf .cover")[i];
    if (!cv) return;
    for (k = 0; k < n; k++) stops.push(colorAt(entries, k / (n - 1)));
    cv.style.background =
      "radial-gradient(circle at 30% 20%,rgba(255,255,255,.3),transparent 45%),linear-gradient(135deg," +
      stops.join(",") +
      ")";
  }
  function buildFlow() {
    var fl = $("flow");
    ITEMS.forEach(function (p, i) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "cf";
      b.tabIndex = -1; // never takes focus, so Enter always means Play
      b.setAttribute(
        "aria-label",
        p.name + ", " + (i + 1) + " of " + ITEMS.length,
      );
      b.innerHTML =
        '<span class="cover"></span><span class="lab"><strong></strong><small></small></span>';
      b.querySelector("strong").textContent = p.name;
      b.querySelector("small").textContent = i + 1 + " / " + ITEMS.length;
      b.addEventListener("mousedown", function (e) {
        e.preventDefault();
      });
      b.addEventListener("click", function () {
        if (S.view !== "menu") return;
        if (i === S.idx) enter();
        else showItem(i);
      });
      fl.appendChild(b);
      var c = (p.theme && p.theme.colors) || ["#737373", "#404040", "#262626"];
      b.querySelector(".cover").style.background =
        "linear-gradient(135deg," + c.join(",") + ")";
      if (p.legends && p.legends.length) {
        decodeLegend(p.legends[0])
          .then(function (L) {
            p.cols = [
              colorAt(L.entries, 0.85),
              colorAt(L.entries, 0.55),
              colorAt(L.entries, 0.25),
            ];
            paintCover(i, L.entries);
            if (S.idx === i && !(p.theme && p.theme.fixed)) setTheme(p.cols);
          })
          .catch(function () {});
      }
    });

    window.addEventListener("resize", layoutFlow);
  }
  function openForm() {
    S.formOpen = true;
    document.body.classList.add("form");
    say(
      "Upload form. Step one, choose your MP4 video. Step two, choose the legend picture. Then type the lowest and highest value and press Load and continue. Escape cancels.",
    );
    setTimeout(function () {
      $("file").focus();
    }, 60);
  }
  function closeForm(quiet) {
    S.formOpen = false;
    document.body.classList.remove("form");
    if (!quiet) {
      say("Form closed.");
      $("start").focus();
    }
  }
  function applyPreset(i) {
    var p = ITEMS[i];
    S.wetMin = p.wetMin !== undefined ? p.wetMin : A.wetMin;
    S.crop = p.mapCrop || FULL;
    S.base.length = 0;
    S.storyIdx = 0;
    if (p.place) {
      var k = PLACES.map(function (x) {
        return x.name;
      }).indexOf(p.place);
      if (k >= 0) {
        S.spot = placeCopy(k);
        $("place").value = k;
      }
    }
  }
  function setTheme(c) {
    c = c || ["#38bdf8", "#6366f1", "#a855f7"];
    S.accent = c[0];
    var r = document.documentElement.style;
    r.setProperty("--a", c[0]);
    r.setProperty("--b", c[1]);
    r.setProperty("--c", c[2]);
  }
  function showItem(i, now) {
    var p = ITEMS[i],
      b = $("top");
    S.idx = i;
    $("preset").value = i;
    document.body.classList.toggle("upload", i === ITEMS.length - 1);
    closeForm(true);
    stop();
    S.instr = null; // each dataset starts with its own instrument again
    refreshInstrument();
    applyPreset(i);
    S.loaded = false;
    $("play").disabled = true;
    $("startLabel").textContent = isUpload() ? "Choose files" : "Play";
    function text() {
      $("pTitle").textContent = p.name;
      $("pDesc").textContent = p.description || "";
      $("pIdx").textContent = i + 1 + " / " + ITEMS.length;
      b.classList.remove("swap");
    }
    if (now) text();
    else {
      b.classList.add("swap");
      setTimeout(text, 250);
    }
    setTheme(
      p.cols && !(p.theme && p.theme.fixed)
        ? p.cols
        : p.theme && p.theme.colors,
    );
    say(
      p.name +
        ". " +
        (isUpload()
          ? "Press Enter to choose your files."
          : "Press Enter to start.") +
        " Use the left and right arrow keys to change.",
    );
    layoutFlow();
  }
  function resetPlayback(msg) {
    stop();
    S.video.currentTime = 0;
    S.beat = 0;
    S.col = 0;
    S.series = [];
    S.ticks = 0;
    S.tiles = null;
    S.sample = null;
    S.active = null;
    S.base.length = 0;
    S.storyIdx = 0;
    $("seek").value = 0;
    var cv = $("map");
    cv.getContext("2d").clearRect(0, 0, cv.width, cv.height);
    markVideo();
    $("stats").textContent = "Not analysed yet.";
    $("bandTable").innerHTML = "";
    $("now").textContent = "Nothing yet";
    var m = typeof msg === "string" ? msg : "Back at the start. Press Play.";
    if (S.loaded && S.view === "play") preview(m);
    else say(m);
  }
  /* Shows the first frame without sound. Playback starts only when Play is pressed. */
  function preview(msg) {
    function go() {
      try {
        S.tiles = analyze();
        S.sample = sampleSpot();
        drawMap(S.tiles);
        updateTable(S.tiles);
      } catch (e) {}
      $("now").textContent =
        S.target === "spot"
          ? "Listening to: " + S.spot.name
          : "Paused. Press Play to listen.";
      say(
        msg ||
          "Ready and paused." +
            (S.target === "spot" ? " Listening to " + S.spot.name + "." : "") +
            " Press Play to listen." +
            (S.warn ? " " + S.warn : ""),
      );
    }
    if (S.video.seeking) S.video.addEventListener("seeked", go, { once: true });
    else go();
  }
  async function enter() {
    initAudio(); /* inside the key press, before any await, or the browser keeps sound muted */
    if (S.busy) return;
    if (isUpload() && !S.formOpen) {
      openForm();
      return;
    } // upload card: Play opens the form first
    S.busy = true;
    try {
      if (!S.loaded) await onLoad();
      if (!S.loaded) return;
      document.body.classList.add("playing");
      S.view = "play";
      preview();
      $("play").focus();
    } finally {
      S.busy = false;
    }
  }
  function leave() {
    resetPlayback("Back to the menu. Press Enter to play again.");
    document.body.classList.remove("playing");
    S.view = "menu";
    if (S.formOpen) $("file").focus();
    else $("start").focus();
  }
  async function onLoad() {
    stop();
    S.loaded = false;
    $("play").disabled = true;
    var P = ITEMS[S.idx],
      file = null,
      url = P.videoUrl,
      specs;
    if (isUpload()) {
      file = $("file").files[0];
      var lf = $("legendFile").files[0];
      if (!file) return say("Choose your video first. It must be an MP4.");
      if (!lf)
        return say("Choose the legend picture, the image of the color bar.");
      var mn = parseFloat($("upMin").value),
        mx = parseFloat($("upMax").value);
      var mn = parseFloat($("upMin").value),
        mx = parseFloat($("upMax").value),
        pct = false;
      if (!isFinite(mn) || !isFinite(mx) || mn === mx) {
        mn = 0;
        mx = 100;
        pct = true;
      }
      specs = [
        {
          label:
            $("upLabel").value.trim() ||
            (pct ? "Position on the color bar, percent" : "Legend"),
          type: "default",
          timbre: $("upInstr").value,
          scene: $("upScene").value,
          url: URL.createObjectURL(lf),
          min: mn,
          max: mx,
          scale:
            $("upScale").value === "log" && mn > 0 && mx > 0 ? "log" : "linear",
          orientation: $("upDir").value,
          crop: FULL,
        },
      ];
      S.wetMin = -1e9;
      S.crop = FULL;
      S.wetMin = -1e9;
      S.crop = FULL;
    } else specs = P.legends;
    if (!file && !url) return say("This preset has no video.");
    if (!specs || !specs.length) return say("No usable legend.");
    try {
      say("Loading legend.");
      S.legends = [];
      for (var i = 0; i < specs.length; i++)
        S.legends.push(await decodeLegend(specs[i]));
      S.warn = legendOverlap();
      showLegends();
      var en = S.legends[0].entries;
      if (isUpload()) paintCover(S.idx, en);
      if (!(P.theme && P.theme.fixed))
        setTheme([colorAt(en, 0.85), colorAt(en, 0.55), colorAt(en, 0.25)]);
      say("Loading video.");
      await loadVideo(file ? URL.createObjectURL(file) : url, !!file);
      prepAnalysis();
      S.loaded = true;
      refreshInstrument();
      $("play").disabled = false;
      S.storyIdx = 0;
      say("Ready. Press Play.");
    } catch (e) {
      say(
        "Could not load: " +
          e.message +
          ". If the file is not an MP4 or the legend is not a picture, choose another. If you host the site, run server.py or check the file paths.",
      );
    }
  }

  /* ===== REGION 10b: INSTRUMENT SWITCHER =====
     Press I (or click an icon) to change instrument during play. Each switch sounds the
     middle note of the range, so you hear the new voice at once. */
  var ORDER = ["pluck", "bell", "harp", "xylophone", "flute", "piano", "guitar", "violin", "accordion", "drum", "windchime", "rainstick"];
  var INSTR_LABEL = {
    pluck: "Pluck", bell: "Bell", harp: "Harp", xylophone: "Xylophone", flute: "Flute",
    piano: "Piano", guitar: "Guitar", violin: "Violin", accordion: "Accordion", drum: "Drum", windchime: "Wind chime", rainstick: "Rainstick",
    drip: "Drip", ice: "Ice chime",
  };
  /* Read out for screen reader users on every switch. */
  var INSTR_DESC = {
    pluck: "A short, dry plucked note.",
    bell: "A clear ringing tone.",
    harp: "Soft, dreamy notes that ring on.",
    xylophone: "Bright, hollow wooden bars struck with a mallet.",
    flute: "Breathy, with a gentle vibrato.",
    piano: "Each note blooms into a chord: bright major for higher values, darker minor for lower values.",
    guitar: "An acoustic guitar playing low chords, one strum per note. Higher values climb from E through F, F sharp and on up, each as major then minor. You hear the root note first, and the chord name is shown on screen.",
    violin: "A bowed string that swells in, with a gentle vibrato.",
    accordion: "A reedy, shimmering squeezebox with a soft swell.",
    drum: "Intense, clear beats. Low notes are kick, middle notes are tom and snare, high notes are tom and hi-hat.",
    windchime: "A quick scatter of metal tubes.",
    rainstick: "A shower of pebbles. Pitch changes brightness more than height.",
    drip: "A short water drop that falls onto its pitch.",
ice: "A clear, glassy chime with a high shimmer.",
  };
  /* CREATIVE CHOICE: filled, single-colour silhouettes. They take the text colour, so they
     stay readable in high contrast, and the active one turns the accent yellow. */
  function svg(inner) {
    return '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">' + inner + "</svg>";
  }
  var ICONS = {
    pluck: svg('<path d="M12 2C7.5 2 4.5 5 5 9.5 5.6 15 9.5 22 12 22s6.4-7 7-12.5C19.5 5 16.5 2 12 2z"/>'),
    bell: svg('<path d="M12 2a1.5 1.5 0 0 1 1.5 1.5v.6A6 6 0 0 1 18 10v4l2 3v1H4v-1l2-3v-4a6 6 0 0 1 4.5-5.9v-.6A1.5 1.5 0 0 1 12 2zM9.5 19h5a2.5 2.5 0 0 1-5 0z"/>'),
    harp: svg('<path d="M5 2h3c6 0 11 3.5 11 9 0 3.5-1.5 7-3 11h-3c1.5-3.8 3-7 3-10.5C16 7.5 12.5 5 8 5v17H5z"/><rect x="10" y="9" width="1.4" height="9" rx=".7"/><rect x="13" y="12" width="1.4" height="6" rx=".7"/>'),
    xylophone: svg('<rect x="1.5" y="3.5" width="3" height="17" rx="1.2"/><rect x="6" y="5" width="3" height="14" rx="1.2"/><rect x="10.5" y="6.5" width="3" height="11" rx="1.2"/><rect x="15" y="8" width="3" height="8" rx="1.2"/><rect x="19.5" y="9.5" width="3" height="5" rx="1.2"/>'),
    violin: svg('<g transform="rotate(-35 12 12)"><rect x="11.2" y="1.5" width="1.6" height="9"/><circle cx="12" cy="1.8" r="1.4"/><circle cx="12" cy="12.6" r="3.1"/><circle cx="12" cy="18.2" r="4"/><rect x="10" y="12.5" width="4" height="6"/></g>'),
    accordion: svg('<rect x="1" y="5" width="5" height="14" rx="1.2"/><rect x="18" y="5" width="5" height="14" rx="1.2"/><rect x="7.4" y="6.5" width="1.6" height="11" rx=".8"/><rect x="9.8" y="6.5" width="1.6" height="11" rx=".8"/><rect x="12.2" y="6.5" width="1.6" height="11" rx=".8"/><rect x="14.6" y="6.5" width="1.6" height="11" rx=".8"/>'),
    flute: svg('<path fill-rule="evenodd" d="M3 9h18a2 2 0 0 1 0 6H3a2 2 0 0 1 0-6zM7 12m-1 0a1 1 0 1 0 2 0a1 1 0 1 0-2 0zM11 12m-1 0a1 1 0 1 0 2 0a1 1 0 1 0-2 0zM15 12m-1 0a1 1 0 1 0 2 0a1 1 0 1 0-2 0z"/>'),
    piano: svg('<path fill-rule="evenodd" d="M3 5h18a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zM6.5 11h1v8h-1zM10.5 11h1v8h-1zM14.5 11h1v8h-1zM18.5 11h1v8h-1z"/>'),
    guitar: svg('<g transform="rotate(40 12 12)"><path d="M11 3h2v8h-2z"/><path d="M10.2 1h3.6v2.2h-3.6z"/><path fill-rule="evenodd" d="M12 10c-2.8 0-4.6 1.8-4.6 3.7 0 .9.4 1.5.9 1.8-.5.6-.9 1.3-.9 2.2 0 1.9 2 3.3 4.6 3.3s4.6-1.4 4.6-3.3c0-.9-.4-1.6-.9-2.2.5-.3.9-.9.9-1.8C16.6 11.8 14.8 10 12 10zM12 14.2m-1.4 0a1.4 1.4 0 1 0 2.8 0a1.4 1.4 0 1 0-2.8 0z"/></g>'),
    drum: svg('<path fill-rule="evenodd" d="M12 8c-5 0-9 1.3-9 3v6c0 1.7 4 3 9 3s9-1.3 9-3v-6c0-1.7-4-3-9-3zm0 1.5c4.1 0 7 .9 7 1.5s-2.9 1.5-7 1.5S5 11.6 5 11s2.9-1.5 7-1.5z"/><path d="M4 2.4 5.2 1.4 11.2 6.6 10 7.6zM20 2.4 18.8 1.4 12.8 6.6 14 7.6z"/>'),
    windchime: svg('<path d="M3 2h18v2H3z"/><rect x="5" y="6" width="3" height="10" rx="1.5"/><rect x="10.5" y="6" width="3" height="14" rx="1.5"/><rect x="16" y="6" width="3" height="8" rx="1.5"/>'),
    rainstick: svg('<g transform="rotate(-35 12 12)"><rect x="1" y="8.5" width="22" height="6" rx="3"/></g><circle cx="7" cy="21.2" r="1.3"/><circle cx="12" cy="22" r="1.3"/><circle cx="17" cy="20.5" r="1.3"/>'),
    drip: svg('<path d="M12 2s-7 8-7 13a7 7 0 0 0 14 0c0-5-7-13-7-13z"/>'),
ice: svg('<path d="M12 2l8 10-8 10-8-10z"/>'),
  };
  function defaultInstr() {
    var sp = isUpload() ? S.legends[0] && S.legends[0].spec : (ITEMS[S.idx].legends || [])[0];
    var k = (sp && (sp.timbre || C.timbres[sp.type])) || C.timbres["default"];
    return k === "lyre" ? "xylophone" : k;
  }
  function currentInstr() {
    return S.instr || defaultInstr();
  }
  function refreshInstrument() {
    var cur = currentInstr(),
      nm = $("instName"),
      cn = $("chordName");
    if (cn && cur !== "guitar") cn.textContent = "";
    document.querySelectorAll("#instBar .inst").forEach(function (b) {
      var on = b.dataset.k === cur;
      b.classList.toggle("on", on);
      b.setAttribute("aria-pressed", on ? "true" : "false");
    });
    if (nm) nm.textContent = "Instrument: " + (INSTR_LABEL[cur] || cur) + ". Press I for the next one, Shift and I for the previous.";
  }
  /* CREATIVE CHOICE: the pitch guide. The active icon rises as the note rises (and pulses on
     every hit) and a dot slides along a Low to High track. Sighted listeners can see the
     pitch the ear is hearing. The dot follows pitch, so Flip pitch reverses it too. */
  function pitchGuide(norm) {
    var dot = $("pitchDot"),
      on = document.querySelector("#instBar .inst.on");
    if (!dot) return;
    var n = Math.max(0, Math.min(1, S.invert ? 1 - norm : norm));
    dot.style.left = n * 100 + "%";
    if (on) {
      on.style.setProperty("--lift", n);
      on.classList.remove("hit");
      void on.offsetWidth; // restart the pulse animation
      on.classList.add("hit");
    }
  }
  function setInstrument(k) {
    initAudio();
    S.instr = k;
    refreshInstrument();
    var L = S.legends[0],
      ng = (L && (NOTE_GAIN[L.spec.type] || NOTE_GAIN["default"])) || 1,
      mid = S.target === "spot" ? pitchForNorm(0.5) : pitchFor(4);
    setMood(0.5);
    voice(midiToHz(mid), S.ctx.currentTime + 0.03, k, 0.3 * ng, 0); // the middle note
    pitchGuide(0.5);
    say(
      "Instrument: " + INSTR_LABEL[k] + ", " + (ORDER.indexOf(k) + 1) + " of " + ORDER.length + ". " + INSTR_DESC[k],
    );
  }
  function nextInstrument() {
    if (S.view !== "play") return;
    setInstrument(ORDER[(ORDER.indexOf(currentInstr()) + 1) % ORDER.length]);
  }
  /* CREATIVE CHOICE: Shift+I walks the same ring backwards, wrapping at both ends, so any
     instrument is at most five presses away. */
  function prevInstrument() {
    if (S.view !== "play") return;
    var i = ORDER.indexOf(currentInstr());
    setInstrument(ORDER[(i <= 0 ? ORDER.length : i) - 1]);
  }
  window.spotPrevInstrument = prevInstrument;
  window.spotNextInstrument = nextInstrument; // ui.js calls this from the I key
  function buildInstrumentBar() {
    var bar = $("instBar");
    if (!bar) return;
    ORDER.forEach(function (k) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "inst";
      b.dataset.k = k;
      b.tabIndex = -1; // keyboard users have the I key
      b.setAttribute("aria-label", INSTR_LABEL[k]);
      b.innerHTML = ICONS[k] + "<span>" + INSTR_LABEL[k] + "</span>";
      b.addEventListener("mousedown", function (e) {
        e.preventDefault();
      });
      b.addEventListener("click", function () {
        setInstrument(k);
      });
      bar.appendChild(b);
    });
    refreshInstrument();
  }

  /* ===== REGION 11: PAGE CONTROLS ===== */
  function setTargetUI() {
    $("spotOpts").hidden = S.target !== "spot";
    $("mapOpts").hidden = S.target !== "map";
  }
  /* The spot changed. While paused: redraw and play one note so you hear what is there. While playing: next tick uses it. */
  function moveSpot() {
    S.base.length = 0; // a new place gets a new baseline
    if (S.timer) {
      say(S.spot.name + ", " + spotWhere());
      return;
    }
    if (S.loaded && S.data) {
      try {
        S.tiles = analyze();
        S.sample = sampleSpot();
        drawMap(S.tiles);
        if (S.ctx) playSample(S.sample, S.ctx.currentTime + 0.02, true);
      } catch (e) {}
      say(spotLine(S.sample));
    } else say(S.spot.name + ", " + spotWhere());
  }
  function setSpot(lat, lon) {
    lat = Math.round(Math.max(-85, Math.min(85, lat)));
    lon = Math.round(((((lon + 180) % 360) + 360) % 360) - 180);
    S.spot = { name: nameFor(lat, lon), lat: lat, lon: lon };
    var pl = $("place");
    pl.value = "custom";
    var o = pl.querySelector("option[value=custom]");
    if (o) o.textContent = "Moved: " + S.spot.name;
    moveSpot();
  }
  function pickAt(ev, el, isVideo) {
    if (S.target !== "spot" || !S.loaded) return;
    var r = el.getBoundingClientRect(),
      fx = (ev.clientX - r.left) / r.width,
      fy = (ev.clientY - r.top) / r.height;
    if (isVideo) {
      fx = (fx - S.crop.x) / S.crop.w;
      fy = (fy - S.crop.y) / S.crop.h;
    }
    if (fx < 0 || fx > 1 || fy < 0 || fy > 1) return;
    setSpot(90 - fy * 180, -180 + fx * 360);
  }
  (function wire() {
    ITEMS.forEach(function (p, i) {
      var o = document.createElement("option");
      o.value = i;
      o.textContent = p.name;
      $("preset").appendChild(o);
    });
    $("preset").addEventListener("change", function () {
      showItem(+this.value);
    });

    var pl = $("place");
    PLACES.forEach(function (p, i) {
      var o = document.createElement("option");
      o.value = i;
      o.textContent = p.name;
      pl.appendChild(o);
    });
    var oc = document.createElement("option");
    oc.value = "custom";
    oc.textContent = "Custom spot (moved)";
    pl.appendChild(oc);
    pl.addEventListener("change", function () {
      if (this.value === "custom") return;
      S.spot = placeCopy(+this.value);
      moveSpot();
    });

    buildInstrumentBar();
    buildFlow();
    showItem(0, true);

    function go(d) {
      if (S.view === "menu")
        showItem((S.idx + d + ITEMS.length) % ITEMS.length);
    }
    $("start").addEventListener("click", enter);
    $("cancelForm").addEventListener("click", function () {
      closeForm();
    });
    $("back").addEventListener("click", function () {
      if (S.view === "play") leave();
    });
    var sx = null,
      sy = 0;
    document.addEventListener(
      "touchstart",
      function (e) {
        var t = e.touches[0];
        sx = t.clientX;
        sy = t.clientY;
      },
      { passive: true },
    );
    document.addEventListener(
      "touchend",
      function (e) {
        if (S.view !== "menu" || sx === null) return;
        if (e.target.closest && e.target.closest("#source")) {
          sx = null;
          return;
        }
        var t = e.changedTouches[0],
          dx = t.clientX - sx,
          dy = t.clientY - sy;
        sx = null;
        if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5)
          go(dx < 0 ? 1 : -1);
      },
      { passive: true },
    );
    $("source").addEventListener("input", function () {
      S.loaded = false;
      $("play").disabled = true;
    });
    Object.keys(C.info || {}).forEach(function (k) {
      var el = $("info-" + k);
      if (el && C.info[k] === false) el.hidden = true;
    });

    var ms = $("mode");
    ms.innerHTML =
      "<option value='cycle'>One band at a time (cycle)</option><option value='all'>All bands together</option>" +
      C.bands
        .map(function (b, i) {
          return "<option value='" + i + "'>" + b.name + " only</option>";
        })
        .join("");
    ms.value = S.mode;
    ms.addEventListener("change", function () {
      S.mode = this.value;
      resetPlayback();
    });
    $("target").value = S.target;
    setTargetUI();
    $("target").addEventListener("change", function () {
      S.target = this.value;
      setTargetUI();
      resetPlayback();
    });
    $("invert").checked = S.invert;
    $("invert").addEventListener("change", function () {
      S.invert = this.checked;
      resetPlayback();
    });
    $("notes").value = MAX_PER_COL;
    $("notes").addEventListener("change", function () {
      MAX_PER_COL = Math.max(1, +this.value || 1);
      resetPlayback();
    });
    var sk = $("seek");
    S.video.addEventListener("timeupdate", function () {
      if (S.video.duration)
        sk.value = (S.video.currentTime / S.video.duration) * 1000;
    });
    sk.addEventListener("input", function () {
      if (S.loaded) S.video.currentTime = (sk.value / 1000) * S.video.duration;
    });
    $("load").addEventListener("click", enter);
    $("play").addEventListener("click", function () {
      if (S.timer) stop("Paused.");
      else start();
    });
    $("key").addEventListener("click", soundKey);
    $("describe").addEventListener("click", function () {
      if (!S.tiles) return say("Nothing analysed yet. Press Play.");
      say(S.target === "spot" ? spotLine(S.sample) : describe(S.tiles));
    });
    $("volume").addEventListener("input", function () {
      if (S.master) S.master.gain.value = parseFloat(this.value);
    });
    $("rate").addEventListener("change", function () {
      resetPlayback();
    });

    /* choose the spot: click the map or the video, or focus the map and use the arrow keys */
    $("map").addEventListener("click", function (e) {
      pickAt(e, this, false);
    });
    S.video.addEventListener("click", function (e) {
      pickAt(e, this, true);
    });
    /* Sliders are for the mouse and touch. Let go of focus afterwards so keys never change them by accident. */
    ["seek", "volume"].forEach(function (id) {
      $(id).addEventListener("change", function () {
        this.blur();
      });
    });

    document.addEventListener("keydown", function (e) {
      var tg = e.target.tagName,
        typing =
          /SELECT|TEXTAREA/.test(tg) ||
          (tg === "INPUT" &&
            e.target.type !== "range" &&
            e.target.type !== "checkbox");
      if (e.key === "Escape") {
        if (S.view === "play") leave();
        else if (S.formOpen) closeForm();
        return;
      }
      /* In the player the four arrow keys ALWAYS move the marker, whatever has focus (sliders included). */
      if (S.view === "play" && e.key.indexOf("Arrow") === 0 && !typing) {
        e.preventDefault();
        if (S.target === "spot" && S.loaded) {
          var dx = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0,
            dy = e.key === "ArrowUp" ? 1 : e.key === "ArrowDown" ? -1 : 0;
          setSpot(S.spot.lat + dy * SPOT_STEP, S.spot.lon + dx * SPOT_STEP);
        }
        return;
      }
      if (tg === "INPUT" || typing) return;
      if (S.view === "play" && (e.key === "," || e.key === ".")) {
        // seeking moved here from the arrows
        if (S.loaded) {
          S.video.currentTime = Math.max(
            0,
            Math.min(
              S.video.duration,
              S.video.currentTime + (e.key === "." ? 5 : -5),
            ),
          );
        }
        return;
      }
      var onBtn = tg === "BUTTON";
      if (e.key === " ") {
        if (onBtn) return;
        e.preventDefault();
        if (S.view === "play") $("play").click();
        else enter();
      } else if (e.key === "Enter" && S.view === "menu") {
        if (!onBtn) enter();
      } else if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
        var d = e.key === "ArrowRight" ? 1 : -1;
        if (S.view === "menu")
          showItem((S.idx + d + ITEMS.length) % ITEMS.length);
      }
    });
  })();
})();
