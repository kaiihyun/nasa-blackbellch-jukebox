/* ============================================================
   EARTH JUKEBOX: app.js
   Regions: 1 state, 2 helpers, 3 legends, 4 video loading,
   5 frame analysis, 6 audio, 7 description, 8 drawing,
   9 playback, 10 menu + upload, 11 page controls

   LISTENING: pick a place (click the map or the video, arrow keys, or N for named places).
   Every 250 ms the colour at the spot drives a nature texture (rain, wind, ocean) and a note.
   Everything reads the CURRENT video frame, so sound and picture always match.

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

  var LOW_MIDI = C.lowMidi || 48;
  var OCTAVES = C.octaves || 3;
  var UI = C.ui || {};
  var SHOW_MIXER = UI.showMixer !== false; // config.js ui.showMixer: the "Playing now" spectrum list
  var SHOW_SCENE = UI.showScenePicker !== false; // config.js ui.showScenePicker: the scene layer button
  var DUCK = !!UI.duckWhileSpeaking; // config.js ui.duckWhileSpeaking
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
    target: "spot", // the one and only listening mode: pick a place
    placeIdx: 0, // which named place N cycles from
    spot: null,
    view: "menu",
    idx: 0,
    accent: null,
    busy: false,
    formOpen: false,
    warn: "",
    instr: null, // instrument chosen with the I key; null = the preset's own instrument
    scene: null, // scene layer chosen with the U key; null = the preset's own layer
    mood: 1, // 1 = major (bright), 0 = minor (dark): set from the data before each chord note
    keyBusy: false, // true while the sound key is playing
  };

  /* ===== MIXER: one channel per sound layer, each with a spectrum tap and a mute ===== */
  var CH = {}, LABELS = {};
  var MIX_ORDER = ["notes", "sustain", "scene-pad", "scene-drops", "scene-hiss", "scene-custom", "drone"];
  function chan(id, label) {
    if (CH[id]) return CH[id];
    var c = S.ctx, inp = c.createGain(), mute = c.createGain(), an = c.createAnalyser();
    an.fftSize = 512; an.smoothingTimeConstant = 0.6; an.minDecibels = -90; an.maxDecibels = -25;
    inp.connect(an);              // spectrum taps BEFORE the mute, so you can still see a muted layer
    inp.connect(mute); mute.connect(S.master); mute.connect(S.conv);
    CH[id] = { id: id, label: LABELS[id] || label, in: inp, mute: mute, an: an,
               data: new Uint8Array(an.frequencyBinCount), muted: false, last: -99, row: null };
    return CH[id];
  }
  function chanLabel(id, text) { LABELS[id] = text; if (CH[id]) CH[id].label = text; }
  var BARS = 28, EDGES = null;
  function makeEdges(n) {
    EDGES = [1];
    for (var i = 1; i <= BARS; i++)
      EDGES.push(Math.min(n, Math.max(EDGES[i - 1] + 1, Math.round(Math.pow(n - 1, i / BARS)))));
  }
  function buildRow(c) {
    var li = document.createElement("li"), nm = document.createElement("span"),
        cv = document.createElement("canvas"), bt = document.createElement("button");
    li.className = "mixrow"; li.style.order = Math.max(0, MIX_ORDER.indexOf(c.id));
    nm.className = "mixname";
    cv.className = "mixspec"; cv.width = 240; cv.height = 32; cv.setAttribute("aria-hidden", "true");
    bt.type = "button"; bt.className = "btn sm mixmute"; bt.setAttribute("aria-pressed", "false");
    bt.addEventListener("click", function () {
      c.muted = !c.muted;
      c.mute.gain.setTargetAtTime(c.muted ? 0 : 1, S.ctx.currentTime, 0.03);
      say(c.label + (c.muted ? " muted." : " unmuted."), true);
    });
    li.appendChild(nm); li.appendChild(cv); li.appendChild(bt);
    $("mixList").appendChild(li);
    c.row = { el: li, name: nm, cv: cv, g: cv.getContext("2d"), btn: bt };
  }
  function mixLoop() {
    requestAnimationFrame(mixLoop);
    if (!S.ctx || !document.body.classList.contains("playing")) return;
    var now = performance.now(), any = false,
        col = getComputedStyle(document.documentElement).getPropertyValue("--pulse").trim() || "#ffd60a";
    Object.keys(CH).forEach(function (id) {
      var c = CH[id], i, mx = 0;
      c.an.getByteFrequencyData(c.data);
      if (!EDGES) makeEdges(c.data.length);
      for (i = 0; i < c.data.length; i++) if (c.data[i] > mx) mx = c.data[i];
      if (mx > 8) c.last = now;
      var show = c.muted || now - c.last < 1500;
      if (show && !c.row) buildRow(c);
      if (!c.row) return;
      var r = c.row;
      r.el.hidden = !show;
      if (!show) return;
      any = true;
      if (r.name.textContent !== c.label) r.name.textContent = c.label;
      r.el.classList.toggle("muted", c.muted);
      r.btn.textContent = c.muted ? "Unmute" : "Mute";
      r.btn.setAttribute("aria-pressed", c.muted ? "true" : "false");
      r.btn.setAttribute("aria-label", (c.muted ? "Unmute " : "Mute ") + c.label);
      var g = r.g, W = r.cv.width, H = r.cv.height, bw = W / BARS;
      g.clearRect(0, 0, W, H);
      g.fillStyle = c.muted ? "#777" : col;
      for (var b = 0; b < BARS; b++) {
        var m = 0;
        for (i = EDGES[b]; i < Math.max(EDGES[b] + 1, EDGES[b + 1]); i++) if (c.data[i] > m) m = c.data[i];
        var h = Math.max(1, (m / 255) * H);
        g.fillRect(b * bw + 1, H - h, bw - 2, h);
      }
    });
    $("mixEmpty").hidden = any;
  }

  /* ===== REGION 2: HELPERS ===== */
  var duckT = null;
  /* Lower the music while a screen reader speaks. The length of speech is estimated from the word count. */
  function duck(text) {
    if (!DUCK || !S.master || !S.ctx) return;
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
    if (S.scene) return S.scene; // the U key overrides every preset and legend
    var SL = window.SCENE_LAYERS || {},
      by = SL.byType || {};
    return (
      (L && L.spec.scene) || (L && by[L.spec.type]) || by["default"] || "none"
    );
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
      p.textContent = L.spec.label + ": " + L.spec.min + " to " + L.spec.max + ", " + L.spec.scale + " scale.";
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
      box.appendChild(p);
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
        channel: function (id, label) { return chan(id, label).in; },
        label: chanLabel,
      });
    var dro = ctx.createOscillator(),
      dg = ctx.createGain();
    dro.type = "sine";
    dro.frequency.value = midiToHz(36);
    dg.gain.value = 0;
    dro.connect(dg);
    dg.connect(chan("drone", "Planet drone").in);
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
    pp.connect(chan("sustain", "Sustained voice").in);
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
    S.bus.connect(chan("notes", "Notes").in);
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
    /* CREATIVE CHOICE: sparkle is a glass celesta. Soft bell-like partials (1x, 2x, 4x), a faint
       glassy overtone, and two tiny grace-note twinkles taken from YOUR current scale, so
       major sparkles brightly and minor sparkles wistfully. A long reverb send lets it shimmer. */
    sparkle: function (f, t, v, g) {
      var c = S.ctx, send = c.createGain(), F = f * 2, j;
      while (F > 4200) F /= 2;
      tone("sine", F, 1, t, 2.2, g);
      tone("sine", F * 2, 0.45, t, 1.4, g);
      tone("sine", F * 4.01, 0.18, t, 0.8, g);
      tone("sine", F * 2.76, 0.12, t, 0.5, g);
      for (j = 0; j < 2; j++) {
        var fq = F * 2 * Math.pow(2, C.scale[Math.floor(Math.random() * C.scale.length)] / 12);
        while (fq > 9000) fq /= 2;
        tone("sine", fq, 0.2 - j * 0.08, t + 0.08 + j * 0.1, 0.6, g);
      }
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(v * 0.5, t + 0.003);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 2.4);
      send.gain.value = 0.9;
      g.connect(send);
      send.connect(S.conv);
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
  /* Chord colour for the piano: the upper half of the legend is major (bright),
     the lower half is minor (dark). Call it right before voice(). */
  function setMood(norm) {
    S.mood = norm === undefined || norm >= 0.5 ? 1 : 0;
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
    drip: 0.5, ice: 0.5, sparkle: 0.5,
    harp: 0.6,
    piano: 0.45,
    flute: 0.6,
    xylophone: 0.4,
    accordion: 0.8,
    bell: 0.45,
  };
  var INSTR_NAME = {
    drip: "water drip", ice: "ice chime", sparkle: "glass sparkle",
    harp: "dreamy harp",
    piano: "piano",
    flute: "flute",
    xylophone: "xylophone",
    accordion: "accordion",
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
        kt === "piano"
          ? " The piano plays chords: bright major for higher values, darker minor for lower values."
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
  function spotLine(t) {
    var where = S.spot.name + ", " + spotWhere();
    if (!t || t.value === null)
      return where + ": no data here. It may be land, or outside the map.";
    if (!wetTile(t)) return where + ": no signal here at this moment.";
    var L = legendFor(t);
    return where + ": " + (L ? L.spec.label : "value") + " about " + fmt(t.value) + ".";
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
  /* The yellow box on the source video that shows where the spot is. */
  function markVideo() {
    var cr = S.crop, sb = spotBox(), el = $("vcol");
    el.style.display = "block";
    el.style.left = (cr.x + sb.x * cr.w) * 100 + "%";
    el.style.top = (cr.y + sb.y * cr.h) * 100 + "%";
    el.style.width = sb.w * cr.w * 100 + "%";
    el.style.height = sb.h * cr.h * 100 + "%";
  }
  function drawMap(tiles) {
    var cv = $("map"), cs = 64, cols = C.grid.cols, rows = C.grid.rows;
    cv.width = cols * cs;
    cv.height = rows * cs;
    var g = cv.getContext("2d");
    g.fillStyle = "#000";
    g.fillRect(0, 0, cv.width, cv.height);
    tiles.forEach(function (t) {
      var x = t.col * cs, y = t.row * cs;
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
    markVideo();
  }

  /* ===== REGION 9: PLAYBACK =====
   Every tick reads the frame that is on screen at this moment. Nothing is queued ahead.
   */

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
          S.placeIdx = k;
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
    storyCheck();
  }
  function start() {
    initAudio();
    var rate = parseFloat($("rate").value);
    S.video.playbackRate = rate;
    var pr = S.video.play();
    if (pr && pr.catch) pr.catch(function () {});
    if (S.video.currentTime < 0.5) {
      S.series = [];
      S.ticks = 0;
      S.beat = 0;
      S.base.length = 0;
      S.storyIdx = 0;
    }
    clearInterval(S.timer);
    spotTick();
    S.timer = setInterval(spotTick, SPOT_MS / rate);
    $("play").innerHTML = PAUSE;
    document.body.classList.add("running");
    say("Playing. Listening to " + S.spot.name + ".");
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
        S.placeIdx = k;
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
  /* ===== Screenshot of a track's video, used as the carousel picture (cached; falls back to the colour gradient) ===== */
  var SHOTS = {};
  function grabShot(url) {
    if (SHOTS[url]) return SHOTS[url];
    return (SHOTS[url] = new Promise(function (ok, no) {
      var v = document.createElement("video"), done = false, timer;
      function fail() { if (done) return; done = true; clearTimeout(timer); delete SHOTS[url]; v.removeAttribute("src"); no(new Error("no screenshot")); }
      v.muted = true; v.playsInline = true; v.preload = "auto"; v.setAttribute("muted", "");
      timer = setTimeout(fail, 15000);
      v.addEventListener("error", fail);
      v.addEventListener("loadedmetadata", function () { v.currentTime = isFinite(v.duration) && v.duration > 0 ? Math.max(0.1, v.duration * 0.4) : 0.1; });
      v.addEventListener("seeked", function () {
        if (done) return;
        try {
          var w = 640, h = Math.max(1, Math.round(w * v.videoHeight / v.videoWidth)), c = document.createElement("canvas");
          c.width = w; c.height = h; c.getContext("2d").drawImage(v, 0, 0, w, h);
          var d = c.toDataURL("image/jpeg", 0.82);
          done = true; clearTimeout(timer); v.removeAttribute("src"); v.load(); ok(d);
        } catch (e) { fail(); }
      });
      v.src = url;
    }));
  }
  function paintShot(p, i) {
    var gb = document.querySelector("#blurb .gradbox");
    if (!gb) return;
    gb.style.backgroundImage = ""; gb.classList.remove("shot");
    var u = i === ITEMS.length - 1 ? "" : (p.thumb || p.videoUrl);
    if (!u) return;
    function put(src) { if (S.idx !== i) return; gb.style.backgroundImage = 'url("' + src + '")'; gb.classList.add("shot"); }
    var im = new Image();                       // 1) saved frame next to the video: precip.mp4 -> precip.jpg
    im.onload = function () { put(im.src); };
    im.onerror = function () { grabShot(u).then(put).catch(function () {}); };   // 2) frame taken from the mp4 itself
    im.src = u.replace(/\.[^./?]+$/, ".jpg");
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
    S.scene = null; // each dataset starts with its own scene layer again
    refreshScene();
    applyPreset(i);
    S.loaded = false;
    $("play").disabled = true;
    $("startLabel").textContent = isUpload() ? "Choose files" : "Play";
    function text() {
      $("pTitle").textContent = p.name;
      $("pDesc").textContent = p.description || "";
      $("pIdx").textContent = i + 1 + " / " + ITEMS.length;
      paintShot(p, i);
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
    S.sub = 0;
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
      setVideoAspect();
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

  /* ===== REGION 10b: INSTRUMENT BUTTON =====
     One button shows the current instrument. Click it or press I for the next one, Shift+I for the
     previous one. Each switch sounds the middle note, so you hear the new voice at once. */
  var ORDER = ["pluck", "bell", "sparkle", "harp", "xylophone", "flute", "piano", "accordion"];
  var INSTR_LABEL = {
    pluck: "Pluck", bell: "Bell", sparkle: "Sparkle", harp: "Harp", xylophone: "Xylophone", flute: "Flute",
    piano: "Piano", accordion: "Accordion", drip: "Drip", ice: "Ice chime",
  };
  /* Read out for screen reader users on every switch. */
  var INSTR_DESC = {
    pluck: "A short, dry plucked note.",
    sparkle: "A glassy celesta with tiny twinkles that follow the scale, major or minor.",
    bell: "A clear ringing tone.",
    harp: "Soft, dreamy notes that ring on.",
    xylophone: "Bright, hollow wooden bars struck with a mallet.",
    flute: "Breathy, with a gentle vibrato.",
    piano: "Each note blooms into a chord: bright major for higher values, darker minor for lower values.",
    accordion: "A reedy, shimmering squeezebox with a soft swell.",
    drip: "A short water drop that falls onto its pitch.",
    ice: "A clear, glassy chime with a high shimmer.",
  };
  /* Filled, single-colour silhouettes. They take the accent colour. */
  function svg(inner) {
    return '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">' + inner + "</svg>";
  }
  var ICONS = {
    pluck: svg('<path d="M12 2C7.5 2 4.5 5 5 9.5 5.6 15 9.5 22 12 22s6.4-7 7-12.5C19.5 5 16.5 2 12 2z"/>'),
    sparkle: svg('<path d="M12 1l2.2 8.8L23 12l-8.8 2.2L12 23l-2.2-8.8L1 12l8.8-2.2z"/><path d="M19 1l.8 2.2L22 4l-2.2.8L19 7l-.8-2.2L16 4l2.2-.8z"/>'),
    bell: svg('<path d="M12 2a1.5 1.5 0 0 1 1.5 1.5v.6A6 6 0 0 1 18 10v4l2 3v1H4v-1l2-3v-4a6 6 0 0 1 4.5-5.9v-.6A1.5 1.5 0 0 1 12 2zM9.5 19h5a2.5 2.5 0 0 1-5 0z"/>'),
    harp: svg('<path d="M5 2h3c6 0 11 3.5 11 9 0 3.5-1.5 7-3 11h-3c1.5-3.8 3-7 3-10.5C16 7.5 12.5 5 8 5v17H5z"/><rect x="10" y="9" width="1.4" height="9" rx=".7"/><rect x="13" y="12" width="1.4" height="6" rx=".7"/>'),
    xylophone: svg('<rect x="1.5" y="3.5" width="3" height="17" rx="1.2"/><rect x="6" y="5" width="3" height="14" rx="1.2"/><rect x="10.5" y="6.5" width="3" height="11" rx="1.2"/><rect x="15" y="8" width="3" height="8" rx="1.2"/><rect x="19.5" y="9.5" width="3" height="5" rx="1.2"/>'),
    accordion: svg('<rect x="1" y="5" width="5" height="14" rx="1.2"/><rect x="18" y="5" width="5" height="14" rx="1.2"/><rect x="7.4" y="6.5" width="1.6" height="11" rx=".8"/><rect x="9.8" y="6.5" width="1.6" height="11" rx=".8"/><rect x="12.2" y="6.5" width="1.6" height="11" rx=".8"/><rect x="14.6" y="6.5" width="1.6" height="11" rx=".8"/>'),
    flute: svg('<path fill-rule="evenodd" d="M3 9h18a2 2 0 0 1 0 6H3a2 2 0 0 1 0-6zM7 12m-1 0a1 1 0 1 0 2 0a1 1 0 1 0-2 0zM11 12m-1 0a1 1 0 1 0 2 0a1 1 0 1 0-2 0zM15 12m-1 0a1 1 0 1 0 2 0a1 1 0 1 0-2 0z"/>'),
    piano: svg('<path fill-rule="evenodd" d="M3 5h18a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zM6.5 11h1v8h-1zM10.5 11h1v8h-1zM14.5 11h1v8h-1zM18.5 11h1v8h-1z"/>'),
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
    var cur = currentInstr(), b = $("instBtn");
    chanLabel("notes", "Notes: " + (INSTR_LABEL[cur] || cur));
    if (!b) return;
    b.querySelector(".ico").innerHTML = ICONS[cur] || "";
    b.querySelector(".pv").textContent = INSTR_LABEL[cur] || cur;
    b.setAttribute("aria-label", "Instrument: " + (INSTR_LABEL[cur] || cur) + ". Press to change, or press I.");
  }
  /* The pitch guide: the instrument icon rises with the note and pulses on every hit, and a dot
     slides along a Low to High track. The dot follows pitch, so flipping pitch reverses it too. */
  function pitchGuide(norm) {
    var dot = $("pitchDot"), on = $("instBtn");
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
      ng = (L && (NOTE_GAIN[L.spec.type] || NOTE_GAIN["default"])) || 1;
    setMood(0.5);
    voice(midiToHz(pitchForNorm(0.5)), S.ctx.currentTime + 0.03, k, 0.3 * ng, 0); // the middle note
    pitchGuide(0.5);
    say("Instrument: " + INSTR_LABEL[k] + ", " + (ORDER.indexOf(k) + 1) + " of " + ORDER.length + ". " + INSTR_DESC[k]);
  }
  function nextInstrument() {
    if (S.view !== "play") return;
    setInstrument(ORDER[(ORDER.indexOf(currentInstr()) + 1) % ORDER.length]);
  }
  function prevInstrument() {
    if (S.view !== "play") return;
    var i = ORDER.indexOf(currentInstr());
    setInstrument(ORDER[(i <= 0 ? ORDER.length : i) - 1]);
  }
  window.spotNextInstrument = nextInstrument; // ui.js calls these from the I key
  window.spotPrevInstrument = prevInstrument;

  /* ===== REGION 10c: SCENE BUTTON =====
     One button shows the current scene layer. Click it or press U for the next, Shift+U for the previous.
     null = the preset's own layer. Hide it all with ui.showScenePicker: false in config.js. */
  function sceneList() {
    var SL = window.SCENE_LAYERS || {};
    return [null, "none"].concat(Object.keys(SL.layers || {}));
  }
  function sceneLabel(k) {
    if (k === null) return "Preset's own";
    if (k === "none") return "None";
    return k.replace(/([A-Z])/g, " $1").replace(/^./, function (c) {
      return c.toUpperCase();
    });
  }
  function refreshScene() {
    var b = $("sceneBtn");
    if (!b) return;
    b.querySelector(".pv").textContent = sceneLabel(S.scene);
    b.setAttribute("aria-label", "Scene layer: " + sceneLabel(S.scene) + ". Press to change, or press U.");
  }
  function setScene(k) {
    initAudio();
    S.scene = k;
    refreshScene();
    var list = sceneList(),
      kind = k === null ? sceneOf(S.legends[0]) : k,
      desc =
        k === "none"
          ? "No nature texture, notes only."
          : (window.SceneLayers && SceneLayers.describe(kind)) || "";
    say("Scene layer: " + sceneLabel(k) + ", " + (list.indexOf(k) + 1) + " of " + list.length + ". " + desc);
    /* paused: play the layer for a moment so you can hear it. Playing: the next tick uses it. */
    if (!S.timer && S.ctx && window.SceneLayers && SceneLayers.has(kind)) {
      scene(kind, { norm: 0.6, value: 0, type: "default" }, 0, SPOT_MS, null, 0);
      setTimeout(function () {
        if (!S.timer) silenceScene();
      }, 1800);
    } else if (!S.timer && S.ctx) silenceScene();
  }
  function nextScene() {
    if (S.view !== "play" || !SHOW_SCENE) return;
    var l = sceneList();
    setScene(l[(l.indexOf(S.scene) + 1) % l.length]);
  }
  function prevScene() {
    if (S.view !== "play" || !SHOW_SCENE) return;
    var l = sceneList(),
      i = l.indexOf(S.scene);
    setScene(l[(i <= 0 ? l.length : i) - 1]);
  }
  window.spotNextScene = nextScene;
  window.spotPrevScene = prevScene;

  /* ===== REGION 10d: SCALE BUTTON (major or minor pentatonic) =====
     Both have five notes per octave, so every note sits in key and nothing clashes.
     Click the button or press C to switch. */
  var SCALES = { major: [0, 2, 4, 7, 9], minor: [0, 3, 5, 7, 10] };
  var SCALE_LABEL = { major: "Major pentatonic", minor: "Minor pentatonic" };
  var SCALE_DESC = { major: "Open and bright.", minor: "Darker and more inward." };
  S.scaleName = "major"; // major pentatonic only: the minor toggle was removed
  if (!SCALES[S.scaleName]) S.scaleName = "major";
  C.scale = SCALES[S.scaleName].slice();
  function refreshScaleUI() {
    var b = $("scaleBtn");
    if (!b) return;
    b.querySelector(".pv").textContent = SCALE_LABEL[S.scaleName];
    b.setAttribute("aria-label", "Scale: " + SCALE_LABEL[S.scaleName] + ". Press to change, or press C.");
  }
  function setScale(k) {
    initAudio();
    S.scaleName = k;
    C.scale = SCALES[k].slice();
    if (window.SceneLayers && SceneLayers.retune) SceneLayers.retune();
    refreshScaleUI();
    say(SCALE_LABEL[k] + ". " + SCALE_DESC[k]);
    if (S.ctx && !S.timer) { // paused: play the scale up one octave so you hear the colour
      var L = S.legends[0], n = C.scale.length, t = S.ctx.currentTime + 0.05,
        ng = (L && (NOTE_GAIN[L.spec.type] || NOTE_GAIN["default"])) || 1, kt = currentInstr();
      for (var i = 0; i <= n; i++) {
        setMood(i / n);
        voice(midiToHz(noteFor(n + i)), t + i * 0.2, kt, 0.25 * ng, 0);
      }
    }
  }
  function toggleScale() {
    if (S.view !== "play") return;
    setScale(S.scaleName === "major" ? "minor" : "major");
  }
  window.spotToggleScale = toggleScale; // ui.js calls this from the C key

  /* The three picker buttons: click = next. Mouse clicks never take focus, so Space always means play. */
  function buildPickers() {
    [["instBtn", nextInstrument], ["sceneBtn", nextScene]].forEach(function (p) {
      var b = $(p[0]);
      b.addEventListener("mousedown", function (e) {
        e.preventDefault();
      });
      b.addEventListener("click", function () {
        p[1]();
      });
    });
    refreshInstrument();
    refreshScene();
    refreshScaleUI();
  }

  /* ===== REGION 11: PAGE CONTROLS ===== */
  /* The video wrapper takes the video's own shape, so it fits the screen with no bars and no scrolling. */
  function setVideoAspect() {
    var v = S.video,
      r = v.videoWidth && v.videoHeight ? v.videoWidth / v.videoHeight : 2;
    document.documentElement.style.setProperty("--vr", r.toFixed(4));
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
    moveSpot();
  }
  /* N / Shift+N: jump to the next or previous named place from config.js. */
  function nextPlace(d) {
    if (S.view !== "play" || !S.loaded || !PLACES.length) return;
    S.placeIdx = (S.placeIdx + d + PLACES.length) % PLACES.length;
    S.spot = placeCopy(S.placeIdx);
    moveSpot();
  }
  window.spotNextPlace = nextPlace; // ui.js calls this from the N key
  function pickAt(ev, el, isVideo) {
    if (!S.loaded) return;
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

    $("mixer").hidden = !SHOW_MIXER;
    $("sceneBtn").hidden = !SHOW_SCENE;
    if (SHOW_MIXER) mixLoop();
    buildPickers();
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
      say(spotLine(S.sample));
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
        if (S.loaded) {
          var dx = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0,
            dy = e.key === "ArrowUp" ? 1 : e.key === "ArrowDown" ? -1 : 0;
          setSpot(S.spot.lat + dy * SPOT_STEP, S.spot.lon + dx * SPOT_STEP);
        }
        return;
      }
      if (tg === "INPUT" || typing) return;
      if (S.view === "play" && (e.key === "," || e.key === ".")) {
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
