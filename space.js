/* ============================================================
   space.js: stars behind every screen, plus the 3D globe on the landing page
   (loaded by global.js, so both modes get the stars).

   STARS: the "Stardust" sparkles, rewritten in plain JS and made light:
     - one canvas, no DPR scaling, 30 fps cap, about 4 stars per 10,000 px (the original was about 17)
     - stars are drawn in 5 opacity buckets, one path per bucket (5 fills per frame, not one per star)
     - the stars cover the whole screen: the canvas takes the size of the fixed #space layer (100lvh, so it also fills the area behind phone toolbars)
     - frozen while the player is open or the jukebox is on top (glass panels blur whatever is behind them,
       and a moving background would make that blur repaint every frame), and while the tab is hidden
     - reduced motion: drawn once, never animated
   Settings: CONFIG.stars in globalconfig.js.

   GLOBE: the "music disc". It stays grey and blurry. Where the mouse is, a soft circle turns colour and sharp.
     - a second canvas copies the WebGL canvas and is masked by a radial gradient that follows the mouse
     - the colour of that circle (and the glow) drifts slowly round the colour wheel
     - a ring of 3D bars (globe.gl "points") stands out of the globe at the mouse, driven by the live spectrum
     - the mouse height picks a pentatonic pitch, and the Accordion instrument plays it (left/right = pan)
     - sound starts after the first click or key press (browsers do not allow audio before that)
   Settings: CONFIG.globe in globalconfig.js.
   ============================================================ */
(function () {
  "use strict";
  var D = window.DANIG = window.DANIG || {}, doc = document, body = doc.body, CF = window.CONFIG || {};
  if (doc.getElementById("space")) return;

  var reduce = !!(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches);
  var sp = doc.createElement("div");
  sp.id = "space"; sp.setAttribute("aria-hidden", "true");
  sp.innerHTML = '<canvas class="stars"></canvas>';
  body.insertBefore(sp, body.firstChild);

  /* ---------- stars ---------- */
  (function stars() {
    var S = { density: 5, speed: 12, fps: 30, color: "#C8E9FF", angle: 121, flicker: 1 }, k, UC = CF.stars || {};
    for (k in UC) S[k] = UC[k];
    var cv = sp.firstChild, c = cv.getContext("2d"), LV = 5, SZ = 1.3,
        W = 0, H = 0, N = 0, x, y, op, ov, bk = [], cnt = new Int32Array(LV), i, b,
        rad = (S.angle - 90) * Math.PI / 180, dx = Math.cos(rad) * S.speed, dy = Math.sin(rad) * S.speed,
        jf = null;

    function init() {
      W = sp.clientWidth || innerWidth; H = sp.clientHeight || innerHeight; cv.width = W; cv.height = H;
      N = Math.round(W * H / 1e4 * S.density);
      x = new Float32Array(N); y = new Float32Array(N); op = new Float32Array(N); ov = new Float32Array(N);
      for (b = 0; b < LV; b++) bk[b] = new Uint16Array(N);
      for (i = 0; i < N; i++) {
        x[i] = Math.random() * W; y[i] = Math.random() * H;
        op[i] = 0.1 + Math.random() * 0.9;
        ov[i] = (Math.random() < 0.5 ? -1 : 1) * (0.1 + Math.random() * 0.5) * S.flicker;     /* opacity change per second */
      }
    }
    function step(dt) {
      for (i = 0; i < N; i++) {
        x[i] += dx * dt; y[i] += dy * dt;
        if (x[i] > W) x[i] = 0; else if (x[i] < 0) x[i] = W;
        if (y[i] > H) y[i] = 0; else if (y[i] < 0) y[i] = H;
        op[i] += ov[i] * dt;
        if (op[i] <= 0.1) { op[i] = 0.1; ov[i] = Math.abs(ov[i]); } else if (op[i] >= 1) { op[i] = 1; ov[i] = -Math.abs(ov[i]); }
      }
    }
    function draw() {
      var l, j, n;
      c.clearRect(0, 0, W, H); cnt.fill(0);
      for (i = 0; i < N; i++) { l = Math.ceil(op[i] * LV) - 1; bk[l][cnt[l]++] = i; }
      c.fillStyle = S.color;
      for (b = 0; b < LV; b++) {
        if (!cnt[b]) continue;
        c.globalAlpha = (b + 1) / LV; c.beginPath();
        for (j = 0; j < cnt[b]; j++) { n = bk[b][j]; c.rect(x[n], y[n], SZ, SZ); }
        c.fill();
      }
      c.globalAlpha = 1;
    }
    function frozen() {
      if (!jf) jf = doc.getElementById("jukeboxFrame");
      return body.classList.contains("playing") || (jf && jf.classList.contains("on"));
    }
    init(); draw(); sp.classList.add("on");
    var t = 0;
    window.addEventListener("resize", function () { clearTimeout(t); t = setTimeout(function () { init(); draw(); }, 150); });
    if (reduce) return;
    var last = performance.now(), gap = 1000 / S.fps;
    (function frame(now) {
      requestAnimationFrame(frame);
      if (now - last < gap) return;
      var dt = Math.min(0.1, (now - last) / 1000); last = now;
      if (doc.hidden || frozen()) return;
      step(dt); draw();
    })(last);
  })();

  /* ---------- the globe ---------- */
  var G = {
    script: "https://cdn.jsdelivr.net/npm/globe.gl",
    texture: "https://cdn.jsdelivr.net/npm/three-globe/example/img/earth-blue-marble.jpg",
    bump: "https://cdn.jsdelivr.net/npm/three-globe/example/img/earth-topology.png",
    enabled: true,
    spin: 40,            /* seconds for the disc to turn once, clockwise. 0 = no disc spin */
    speed: 0.5,          /* the globe's own turning, 0 = still */
    lat: 14, lng: 121,   /* the point that faces you at the start */
    glowColor: "#5aa9ee",
    atmosphere: 0.15,
    blur: 8,             /* px of blur on the grey globe */
    radius: 0.3,         /* size of the colour circle around the mouse, as a fraction of the globe's width */
    hueSpeed: 20,        /* degrees per second the colours drift while you hover. 0 = no drift */
    bars: 20,            /* bars in the 3D spectrum ring */
    ring: 5,             /* radius of that ring, in degrees of the globe */
    barHeight: 0.3,      /* tallest bar, as a fraction of the globe's radius */
    hoverSound: true,
    instrument: "accordion",
    lowMidi: 55,         /* lowest note under the mouse (the top of the globe is three octaves higher) */
    volume: 0.8,
    dimDelay: 4,         /* seconds after the globe rises before it starts to blur and go grey */
    dimTime: 8,          /* seconds the blur and grey take to arrive */
    noteGap: 110         /* ms between notes while gliding */
  }, UC = CF.globe || {}, k;
  for (k in UC) G[k] = UC[k];

  var done = false, colored = false, rose = false, mounts = 0, leaving = 0, dimT = 0,
      g = null, wrap = null, halo = null, sspin = null, rev = null, rc = null, cur = { lat: G.lat, lng: G.lng };

  function ready() {
    if (done) return; done = true;
    D.spaceIsReady = true;
    if (!body.classList.contains("intro")) { D.riseGlobe(); setTimeout(D.colorGlobe, 1200); }
    window.dispatchEvent(new Event("danig:space"));
  }
  setTimeout(ready, 6000);

  function startDim(w) {                          /* clear colour first, then blur + grey after dimDelay seconds */
    if (!w || w.dataset.dim) return;
    w.dataset.dim = "1";
    var go = function () { if (w === wrap) w.classList.add("dim"); };
    if (reduce) go(); else dimT = setTimeout(go, Math.max(0, G.dimDelay) * 1000);
  }
  D.riseGlobe = function () {
    rose = true;
    if (wrap && !wrap.classList.contains("pop") && !wrap.classList.contains("leave")) { wrap.classList.add("rise"); startDim(wrap); }
  };
  D.colorGlobe = function () {                    /* lights the glow around the disc. The globe itself stays grey until hovered. */
    colored = true;
    if (wrap) wrap.classList.add("color");
  };

  function layout() {
    var disc = doc.getElementById("disc");
    if (!g || !wrap || !disc) return;
    var r = disc.getBoundingClientRect();
    if (!r.width) return;
    var ty = 0;
    try { ty = new DOMMatrix(getComputedStyle(disc).transform).m42 || 0; } catch (e) {}
    var S = Math.round(r.width), Dm = Math.round(S * 1.4),
        cx = r.left + r.width / 2, cy = r.top - ty + r.height / 2,
        f = S / Dm, alt = (100 / f / Math.tan(25 * Math.PI / 180) - 100) / 100;
    try { var p = g.pointOfView(); if (p && isFinite(p.lng)) cur = { lat: p.lat, lng: p.lng }; } catch (e) {}
    try { g.renderer().setPixelRatio(Math.min(window.devicePixelRatio || 1, 2)); } catch (e) {}
    wrap.style.width = wrap.style.height = Dm + "px";
    wrap.style.left = Math.round(cx - Dm / 2) + "px";
    wrap.style.top = Math.round(cy - Dm / 2) + "px";
    wrap.style.setProperty("--drop", Math.round(innerHeight - (cy - Dm / 2) + 24) + "px");
    if (halo) halo.style.width = halo.style.height = S + "px";
    g.width(Dm).height(Dm);
    g.pointOfView({ lat: cur.lat, lng: cur.lng, altitude: alt }, 0);
  }
  var lt = 0;
  function later() { clearTimeout(lt); lt = setTimeout(layout, 80); }
  window.addEventListener("resize", later);
  if (doc.fonts && doc.fonts.ready) doc.fonts.ready.then(later);
  doc.addEventListener("animationend", later, true);
  new MutationObserver(later).observe(doc.documentElement, { attributes: true, attributeFilter: ["style"] });
  (function watchDisc() {
    var d = doc.getElementById("disc");
    if (d && window.ResizeObserver) new ResizeObserver(later).observe(d);
  })();

  /* ---------- hover: colour circle, 3D spectrum, accordion ---------- */
  var au = null;                                   /* audio, created on the first click or key press */
  function audio() {
    if (au) return au;
    var AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null;
    var c = new AC(), m = c.createGain(), an = c.createAnalyser(), nb = c.createBuffer(1, c.sampleRate * 2, c.sampleRate), d = nb.getChannelData(0), i;
    for (i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    m.gain.value = G.volume; an.fftSize = 2048; an.smoothingTimeConstant = 0.75; an.minDecibels = -90; an.maxDecibels = -25;
    m.connect(an); an.connect(c.destination);
    au = { c: c, m: m, an: an, d: new Uint8Array(an.frequencyBinCount), E: {   /* the helpers every instrument's play() expects */
      ctx: c, conv: m, mood: 1, scale: CF.scale || [0, 2, 4, 7, 9],
      noise: function () { return nb; },
      tone: function (type, f, amp, t, dur, dest, det) {
        var o = c.createOscillator(), pg = c.createGain();
        o.type = type; o.frequency.value = f; if (det) o.detune.value = det;
        pg.gain.setValueAtTime(amp, t); pg.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(pg); pg.connect(dest); o.start(t); o.stop(t + dur + 0.05);
      },
      envelope: function (gn, t, peak, dur) {
        gn.gain.setValueAtTime(0.0001, t); gn.gain.exponentialRampToValueAtTime(peak, t + 0.01); gn.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      }
    } };
    return au;
  }
  function unlock() {
    var a = audio(); if (!a || a.c.state === "running") return;
    a.c.resume().then(function () {               /* the first click, tap or key sounds the note under the pointer right away */
      var l = Hv.last;
      if (l && performance.now() - l.t < 1500) { Hv.idx = -1; hoverNote(l.vx, l.vy, l.Rg); }
    }).catch(function () {});
  }
  ["pointerdown", "pointerup", "touchend", "mousedown", "click", "keydown"].forEach(function (t) { window.addEventListener(t, unlock, true); });

  var Hv = { tr: 0, rr: 0, rx: 0, ry: 0, hue: 0, raf: 0, t: 0, lastBars: 0, idx: -1, nt: 0, shown: false, pts: 0, arr: null, h: null };
  window.addEventListener("danig:hue", function () { if (D.hueShift === false && !Hv.tr) Hv.hue = 0; });
  var HUE0 = 208;                                  /* the blue of the glow, in hue degrees */

  function hoverNote(vx, vy, Rg) {
    if (!G.hoverSound || !au) return;
    var a = au; if (a.c.state === "suspended") a.c.resume();
    if (a.c.state !== "running") return;
    var now = performance.now(), n = Math.max(0, Math.min(1, (Rg - vy) / (2 * Rg))),
        sc = CF.scale || [0, 2, 4, 7, 9], len = sc.length * 3, idx = Math.round(n * (len - 1));
    if (idx === Hv.idx || now - Hv.nt < G.noteGap) return;
    var inst = window.LOC && LOC.instruments && LOC.instruments.get(G.instrument);
    if (!inst) return;
    Hv.idx = idx; Hv.nt = now;
    var m = G.lowMidi + 12 * Math.floor(idx / sc.length) + sc[idx % sc.length], f = 440 * Math.pow(2, (m - 69) / 12),
        gn = a.c.createGain(), pn = a.c.createStereoPanner();
    pn.pan.value = Math.max(-1, Math.min(1, vx / Rg)) * 0.8;
    gn.connect(pn); pn.connect(a.m);
    inst.play(f, a.c.currentTime + 0.01, 0.6, gn, a.E);
  }
  function onPtr(e) {
    if (!g || !wrap || !rev || leaving || !body.classList.contains("home")) { if (Hv.tr) { Hv.tr = 0; Hv.idx = -1; kick(); } return; }
    var r = wrap.getBoundingClientRect(), Dm = parseFloat(wrap.style.width) || r.width, sc = r.width / Dm, Sg = Dm / 1.4,
        vx = e.clientX - (r.left + r.width / 2), vy = e.clientY - (r.top + r.height / 2), Rg = Sg / 2 * sc;
    if (vx * vx + vy * vy > Rg * Rg) { if (Hv.tr) { Hv.tr = 0; Hv.idx = -1; kick(); } return; }
    var a = 0;                                     /* the disc turns, so un-turn the mouse position to find the spot on the canvas */
    try { var m = new DOMMatrix(getComputedStyle(sspin).transform); a = Math.atan2(m.b, m.a); } catch (x) {}
    var co = Math.cos(a), si = Math.sin(a);
    Hv.rx = (vx * co + vy * si) / sc + Dm / 2;
    Hv.ry = (-vx * si + vy * co) / sc + Dm / 2;
    Hv.tr = G.radius * Sg;
    Hv.last = { vx: vx, vy: vy, Rg: Rg, t: performance.now() };
    kick(); hoverNote(vx, vy, Rg);
  }
  doc.addEventListener("pointermove", onPtr, { passive: true });
  doc.addEventListener("pointerdown", onPtr, { passive: true });
  doc.documentElement.addEventListener("pointerleave", function () { Hv.tr = 0; Hv.idx = -1; kick(); });
  window.addEventListener("blur", function () { Hv.tr = 0; Hv.idx = -1; kick(); });
  function endTouch(e) { if (e.pointerType !== "mouse") { Hv.tr = 0; Hv.idx = -1; kick(); } }   /* finger lifted: the colour circle goes */
  doc.addEventListener("pointerup", endTouch, { passive: true });
  doc.addEventListener("pointercancel", endTouch, { passive: true });

  function kick() { if (!Hv.raf) Hv.raf = requestAnimationFrame(loop); }
  function clearBars() { if (Hv.pts && g) { try { g.pointsData([]); } catch (e) {} } Hv.pts = 0; }
  function bars(now) {
    var co = null;
    try { co = Hv.tr > 0 ? g.toGlobeCoords(Hv.rx, Hv.ry) : null; } catch (e) {}
    if (!co) { clearBars(); return; }
    var N = G.bars, a = au && au.c.state === "running" ? au : null, hz = 0, i, j, i0, i1, v, o, an, t = now / 1000, arr = Hv.arr;
    if (a) { a.an.getByteFrequencyData(a.d); hz = a.c.sampleRate / a.an.fftSize; }
    if (!arr || arr.length !== N) {
      arr = Hv.arr = []; Hv.h = new Float32Array(N);
      for (i = 0; i < N; i++) arr.push({ lat: 0, lng: 0, alt: 0, color: "#fff" });
    }
    var cl = Math.max(0.2, Math.cos(co.lat * Math.PI / 180));
    for (i = 0; i < N; i++) {
      v = 0;
      if (a) {                                     /* 90 Hz to 4 kHz, spread on a log scale like the notes spectrum in the player */
        i0 = Math.floor(90 * Math.pow(44.44, i / N) / hz); i1 = Math.max(i0 + 1, Math.ceil(90 * Math.pow(44.44, (i + 1) / N) / hz));
        for (j = i0; j < i1 && j < a.d.length; j++) if (a.d[j] > v) v = a.d[j];
        v = Math.min(1, v / 255 * 1.5);
      }
      Hv.h[i] = Math.max(v, Hv.h[i] * 0.88);       /* quick rise, soft fall */
      an = i / N * 6.2832 + t * 0.4; o = arr[i];
      o.lat = co.lat + G.ring * Math.sin(an);
      o.lng = co.lng + G.ring * Math.cos(an) / cl;
      o.alt = 0.04 + 0.03 * Math.sin(t * 3 + i * 0.7) + Hv.h[i] * G.barHeight;   /* a small idle wave, so the ring is alive even in silence */
      o.color = "hsl(" + ((HUE0 + Hv.hue + i * (360 / N) * 0.25) % 360).toFixed(0) + ",90%,65%)";
    }
    try { g.pointsData(arr.slice()); Hv.pts = 1; } catch (e) {}
  }
  function loop(now) {
    Hv.raf = 0;
    if (!g || !wrap || !rev) return;
    var dt = Math.min(0.1, (now - (Hv.t || now)) / 1000); Hv.t = now;
    Hv.rr += (Hv.tr - Hv.rr) * Math.min(1, dt * 9);
    if (Math.abs(Hv.tr - Hv.rr) < 0.5) Hv.rr = Hv.tr;
    if (Hv.rr > 0.5) {
      if (!Hv.shown) { rev.style.display = "block"; Hv.shown = true; }
      var shift = D.hueShift !== false && !reduce && G.hueSpeed > 0;   /* CONFIG.globe.colorShift (developers only) */
      if (shift) Hv.hue = (Hv.hue + dt * G.hueSpeed) % 360;
      else if (Hv.hue) { var tg = Hv.hue > 180 ? 360 : 0; Hv.hue += (tg - Hv.hue) * Math.min(1, dt * 4); if (Math.abs(tg - Hv.hue) < 0.3) Hv.hue = 0; }   /* off: glide back to the original colors */
      var tinted = shift || Hv.hue !== 0;
      var src = g.renderer().domElement;
      if (rev.width !== src.width || rev.height !== src.height) { rev.width = src.width; rev.height = src.height; }
      rc.clearRect(0, 0, rev.width, rev.height); rc.drawImage(src, 0, 0);
      rev.style.filter = tinted ? "hue-rotate(" + Hv.hue.toFixed(1) + "deg) saturate(1.2)" : "none";
      rev.style.setProperty("--rx", Hv.rx.toFixed(1) + "px");
      rev.style.setProperty("--ry", Hv.ry.toFixed(1) + "px");
      rev.style.setProperty("--rr", Hv.rr.toFixed(1) + "px");
      if (halo) halo.style.setProperty("--glow", tinted ? "hsl(" + ((HUE0 + Hv.hue) % 360).toFixed(0) + " 85% 62%)" : G.glowColor);
      if (Hv.tr > 0) { if (now - Hv.lastBars > 33) { Hv.lastBars = now; bars(now); } } else clearBars();
    } else if (Hv.shown) {
      rev.style.display = "none"; Hv.shown = false; clearBars();
    }
    if (Hv.tr > 0 || Hv.rr > 0) Hv.raf = requestAnimationFrame(loop); else Hv.t = 0;
  }

  function mount() {
    if (!doc.getElementById("disc") || !window.Globe || wrap) return;
    var again = mounts++ > 0;
    var w = doc.createElement("div"), h = doc.createElement("div"), spin = doc.createElement("div"),
        box = doc.createElement("div"), rv = doc.createElement("canvas");
    w.id = "globe"; h.className = "globe-halo"; spin.className = "globe-spin"; box.className = "globe-box"; rv.className = "globe-rev";
    if (again) w.classList.add("pop");
    if (colored || again) w.classList.add("color");
    w.style.setProperty("--gblur", G.blur + "px");
    w.style.setProperty("--gdimtime", Math.max(0, G.dimTime) + "s");
    w.style.setProperty("--gspin", (G.spin > 0 ? G.spin : 0) + "s");
    if (!(G.spin > 0)) spin.style.animation = "none";
    h.style.setProperty("--glow", G.glowColor);
    spin.appendChild(box); spin.appendChild(rv); w.appendChild(h); w.appendChild(spin); sp.appendChild(w);
    wrap = w; halo = h; sspin = spin; rev = rv; rc = rv.getContext("2d");
    Hv.tr = Hv.rr = 0; Hv.shown = false; Hv.idx = -1;

    var gl = window.Globe({ rendererConfig: { antialias: true, alpha: true, preserveDrawingBuffer: true } })(box)   /* the copy needs the finished frame to stay readable */
      .globeImageUrl(G.texture)
      .bumpImageUrl(G.bump)
      .backgroundColor("rgba(0,0,0,0)")
      .showAtmosphere(true)
      .atmosphereColor(G.glowColor)
      .atmosphereAltitude(G.atmosphere)
      .enablePointerInteraction(false)
      .pointsData([]).pointLat("lat").pointLng("lng").pointAltitude("alt").pointColor("color")
      .pointRadius(0.55).pointResolution(5).pointsMerge(false).pointsTransitionDuration(0)
      .onGlobeReady(function () {
        if (wrap !== w) return;
        w.classList.add("on");
        if (again || rose) { w.classList.add("rise"); startDim(w); }
        ready();
      });
    g = gl;
    cur = { lat: G.lat, lng: G.lng };
    var c = gl.controls();
    c.enableZoom = false; c.enablePan = false; c.enableRotate = false;
    c.autoRotate = G.speed > 0 && !reduce;
    c.autoRotateSpeed = G.speed;
    try { gl.renderer().domElement.style.pointerEvents = "none"; } catch (e) {}
    layout();
  }

  function destroy() {
    clearTimeout(dimT);
    if (leaving) { clearTimeout(leaving); leaving = 0; }
    var gl = g, w = wrap, r = null;
    g = null; wrap = null; halo = null; sspin = null; rev = null; rc = null;
    cancelAnimationFrame(Hv.raf); Hv.raf = 0; Hv.tr = Hv.rr = 0; Hv.pts = 0; Hv.shown = false; Hv.arr = null;
    if (au && au.c.state === "running") au.c.suspend();
    if (gl) {
      try { r = gl.renderer(); } catch (e) {}
      try { if (gl.pauseAnimation) gl.pauseAnimation(); } catch (e) {}
      try { if (gl._destructor) gl._destructor(); } catch (e) {}
      try { if (r) { r.dispose(); if (r.forceContextLoss) r.forceContextLoss(); } } catch (e) {}
    }
    if (w && w.parentNode) w.parentNode.removeChild(w);
  }
  function unmount() {
    if (!wrap || leaving) return;
    Hv.tr = 0; kick();
    wrap.classList.remove("pop", "rise", "on"); wrap.classList.add("leave");
    leaving = setTimeout(function () { leaving = 0; destroy(); }, 1000);
  }
  function sync() {
    var home = body.classList.contains("home");
    if (home) { if (wrap && leaving) destroy(); if (!wrap) mount(); }
    else if (wrap) unmount();
  }
  new MutationObserver(sync).observe(body, { attributes: true, attributeFilter: ["class"] });

  if (G.enabled === false || !doc.getElementById("disc")) { ready(); return; }
  if (window.Globe) sync();
  else {
    var s = doc.createElement("script");
    s.src = G.script; s.async = true; s.onload = sync; s.onerror = ready;
    doc.head.appendChild(s);
  }
})();
