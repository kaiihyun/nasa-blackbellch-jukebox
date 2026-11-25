/* ============================================================
   intro.js (index.html only)
     1  Intro     black screen with a "Tap to begin" button (browsers only allow sound after a tap).
                  Then the blurry grey Earth fades in, a ring of colour bars rises from behind it, clockwise, one by one,
                  each with a sparkle note (lowest to highest). When the ring is full AND everything is loaded, it bursts
                  outward into notes with an "award" sparkle, the Earth turns sharp and the page appears.
                  All values: CONFIG.intro in globalconfig.js. Skipped when the visitor asks for reduced motion.
     2  Upload   fills in the accepted file formats on the "Upload your own" card
   ============================================================ */
(function () {
  "use strict";
  var D = window.DANIG || {}, body = document.body, $ = function (id) { return document.getElementById(id); };

  /* ---------- 2. Upload card: accepted formats ---------- */
  (function formats() {
    var v = $("fmtVideo"), l = $("fmtLegend");
    if (!v || !l) return;
    function paint() {
      var it = window.spotCurrent && window.spotCurrent(), sweep = !!(it && it.sweep),
          imgs = !(window.CONFIG && window.CONFIG.ui && window.CONFIG.ui.sweepAcceptsImages === false);
      v.textContent = sweep && imgs ? "MP4, PNG or JPG" : "MP4";
      l.textContent = "PNG, JPG, WEBP or GIF";
    }
    paint();
    new MutationObserver(paint).observe($("pTitle"), { childList: true, characterData: true, subtree: true });
    new MutationObserver(paint).observe(body, { attributes: true, attributeFilter: ["class"] });
  })();

  /* ---------- 1. Intro ---------- */
  var I = (window.CONFIG && window.CONFIG.intro) || null, veil = $("introVeil"), sp = null,
      reduce = !!(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches);
  function finish() {                                                        /* no intro: switched off, reduced motion, or something is missing */
    if (D.riseGlobe) D.riseGlobe();
    if (D.colorGlobe) D.colorGlobe();
    body.classList.remove("intro"); body.classList.add("reveal", "ready");
    if (veil) veil.style.display = "none";
  }
  if (!veil || !I || I.enabled === false || reduce) { finish(); return; }

  function once(target, type) { return new Promise(function (ok) { target.addEventListener(type, ok, { once: true }); }); }
  function image(src) { return new Promise(function (ok) { var i = new Image(); i.onload = i.onerror = ok; i.src = D.url ? D.url(src) : src; }); }
  function onSpace(fn) { if (D.spaceIsReady) fn(); else window.addEventListener("danig:space", fn, { once: true }); }   /* space.js may load after this file */
  function sm(u) { return u * u * (3 - 2 * u); }

  /* bars and their notes */
  var N = Math.max(8, I.bars | 0), bars = [], parts = [], k,
      sc = I.scale || (window.CONFIG && window.CONFIG.scale) || [0, 2, 4, 7, 9], nn = sc.length * I.octaves;
  function hz(m) { return 440 * Math.pow(2, (m - 69) / 12); }
  function note(base, n) { return base + 12 * Math.floor(n / sc.length) + sc[n % sc.length]; }
  for (k = 0; k < N; k++) {
    var wv = 0.5 + 0.5 * (0.6 * Math.sin(k * 0.37) + 0.3 * Math.sin(k * 0.91 + 1.3) + 0.1 * Math.sin(k * 2.3 + 0.4));
    bars.push({ h: I.minLength + (I.maxLength - I.minLength) * wv, n: 0, t0: 0, played: false,
      ang: (I.startDeg + 360 * k / N) * Math.PI / 180,
      hue: ((I.hueStart + I.hueDir * 360 * k / N) % 360 + 360) % 360,
      f: hz(note(I.lowMidi, Math.round(k * (nn - 1) / (N - 1)))) });
  }

  /* sound: bell-like sparkle notes through a short echo, on the shared AudioContext from space.js */
  var A = null, PR = [1, 2.01, 3.99, 6.1], PA = [1, 0.45, 0.22, 0.1];
  function audioStart() {
    if (A || I.sound === false) return;
    var a = D.audio && D.audio(); if (!a) return;
    var c = a.c, bus = c.createGain(), cp = c.createDynamicsCompressor(), dl = c.createDelay(1), fb = c.createGain(), wet = c.createGain();
    if (c.state === "suspended") c.resume();
    bus.gain.value = I.volume; dl.delayTime.value = 0.27; fb.gain.value = 0.38; wet.gain.value = I.echo;
    bus.connect(cp); bus.connect(dl); dl.connect(fb); fb.connect(dl); dl.connect(wet); wet.connect(cp); cp.connect(c.destination);
    A = { c: c, bus: bus, noise: a.E.noise() };
  }
  function ping(f, t, amp, pan, len) {
    var c = A.c, out = c.createGain(), pn = c.createStereoPanner(), dur = len || I.decay * (f > 2000 ? 0.6 : 1), j, o, g;
    pn.pan.value = Math.max(-1, Math.min(1, pan)); out.connect(pn); pn.connect(A.bus);
    for (j = 0; j < PR.length; j++) {
      if (f * PR[j] > 15000) break;
      o = c.createOscillator(); g = c.createGain();
      o.type = "sine"; o.frequency.value = f * PR[j];
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(amp * PA[j], t + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur / (1 + j * 0.8));
      o.connect(g); g.connect(out); o.start(t); o.stop(t + dur + 0.05);
    }
  }
  function award() {                                                         /* the "task complete" glitter */
    if (!A || A.c.state !== "running") return;
    var c = A.c, t = c.currentTime + 0.03, len = sc.length, j, ns, hp, ng;
    for (j = 0; j < 14; j++) ping(hz(note(I.awardLowMidi - 12, j)), t + j * 0.055, 0.2, Math.sin(j) * 0.6);                 /* quick rising run */
    for (j = 0; j < I.awardNotes; j++) ping(hz(note(I.awardLowMidi, Math.floor(Math.random() * len * 3))),
      t + 0.2 + Math.random() * I.awardTime, 0.08 + Math.random() * 0.14, Math.random() * 1.8 - 0.9);                        /* scattered sparkles */
    [0, 2, 4, 5].forEach(function (n) { ping(hz(note(I.awardLowMidi - 12, n)), t + 0.8, 0.22, 0, 2.6); });                  /* the final chord */
    ns = c.createBufferSource(); hp = c.createBiquadFilter(); ng = c.createGain();                                           /* a bright shimmer */
    ns.buffer = A.noise; ns.loop = true; hp.type = "highpass";
    hp.frequency.setValueAtTime(5000, t); hp.frequency.exponentialRampToValueAtTime(11000, t + 1.4);
    ng.gain.setValueAtTime(0.0001, t); ng.gain.exponentialRampToValueAtTime(0.09, t + 0.25); ng.gain.exponentialRampToValueAtTime(0.0001, t + 1.8);
    ns.connect(hp); hp.connect(ng); ng.connect(A.bus); ns.start(t); ns.stop(t + 1.9);
  }

  /* drawing */
  var cv = null, c = null, W = 0, H = 0, dpr = 1, phase = 0, fullAt = 0, bt0 = 0, loaded = false, started = false;
  function fit() {
    if (!sp || !cv) return;
    W = sp.clientWidth || window.innerWidth; H = sp.clientHeight || window.innerHeight; dpr = Math.min(window.devicePixelRatio || 1, 2);
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
  }
  function geom() { var g = D.globeGeometry && D.globeGeometry(); return g || { cx: W / 2, cy: H / 2, r: Math.min(W, H) * 0.2 }; }
  function dims(G) {
    var R = G.r, r0 = R * I.innerRadius, sh = R * I.segHeight, st = sh + R * I.segGap, bw = 2 * Math.PI * r0 / N * I.barFill;
    return { R: R, r0: r0, sh: sh, st: st, bw: bw, hw: Math.max(0, (bw - sh) / 2) };
  }
  function seg(x, hw) { c.moveTo(x, -hw); c.lineTo(x, hw); }                 /* one dash: a short round-capped line across the bar */
  function drawBars(now, G) {
    var d = dims(G), b, p, v, full, part, fl, s, pass, ga, j;
    c.lineCap = "round";
    for (j = 0; j < N; j++) {
      b = bars[j]; p = (now - b.t0) / (I.growTime * 1000);
      if (p <= 0) continue;
      b.n = Math.max(1, Math.round(b.h * d.R / d.st));
      p = Math.min(1, p); v = b.n * sm(p);
      if (p >= 1 && I.idleWiggle) v = Math.max(1, b.n + Math.round(Math.sin(now / 260 + j * 0.9) * 1.2));
      fl = Math.max(0, 1 - (now - b.t0) / 700);                              /* a flash as each bar appears */
      full = Math.floor(v); part = v - full;
      c.save(); c.translate(G.cx, G.cy); c.rotate(b.ang);
      c.strokeStyle = "hsl(" + b.hue.toFixed(0) + "," + I.saturation + "%," + (I.lightness + 22 * fl).toFixed(0) + "%)";
      for (pass = 0; pass < 2; pass++) {                                     /* pass 0 = glow, pass 1 = the dashes */
        c.globalCompositeOperation = pass ? "source-over" : "lighter";
        c.lineWidth = pass ? d.sh : d.sh * I.glowSize;
        ga = Math.min(1, pass ? 0.95 : I.glow * (1 + 2 * fl));
        c.globalAlpha = ga; c.beginPath();
        for (s = 0; s < full; s++) seg(d.r0 + s * d.st + d.sh / 2, d.hw);
        c.stroke();
        if (part > 0.02) { c.globalAlpha = ga * part; c.beginPath(); seg(d.r0 + full * d.st + d.sh / 2, d.hw); c.stroke(); }
      }
      c.restore();
    }
    c.globalAlpha = 1; c.globalCompositeOperation = "source-over";
  }
  function burst(now, G) {
    var d = dims(G), j, s, b, a;
    parts = []; bt0 = now;
    for (j = 0; j < N; j++) {
      b = bars[j];
      for (s = 0; s < b.n; s++) parts.push({ a: b.ang, r: d.r0 + s * d.st + d.sh / 2, vr: (0.5 + Math.random()) * I.burstSpeed * d.R * (0.5 + s / b.n),
        dr: (Math.random() - 0.5) * 0.5, hue: b.hue, w: d.bw, h: d.sh, spin: (Math.random() - 0.5) * 4,
        g: Math.random() < I.noteGlyphs ? (Math.random() < 0.5 ? "\u266a" : "\u266b") : "" });
    }
    for (j = 0; j < I.burstDust; j++) {
      a = Math.random() * 6.2832;
      parts.push({ a: a, r: d.r0 + Math.random() * I.maxLength * d.R, vr: (0.6 + Math.random() * 1.6) * I.burstSpeed * d.R, dr: (Math.random() - 0.5) * 0.8,
        hue: ((I.hueStart + I.hueDir * (a * 57.2958 - I.startDeg)) % 360 + 360) % 360, h: 1 + Math.random() * 2.2, ph: Math.random() * 6.28, dust: 1 });
    }
    award(); reveal();
  }
  function drawParts(now, G) {
    var life = (now - bt0) / (I.burstTime * 1000), d, al, p, j, a, r, x, y, col, hw;
    if (life >= 1) return false;
    d = 1 - Math.pow(1 - life, 2.2); al = Math.pow(1 - life, 1.4);
    c.globalCompositeOperation = "lighter"; c.textAlign = "center"; c.textBaseline = "middle"; c.lineCap = "round";
    for (j = 0; j < parts.length; j++) {
      p = parts[j]; a = p.a + p.dr * d; r = p.r + p.vr * d;
      x = G.cx + Math.cos(a) * r; y = G.cy + Math.sin(a) * r;
      col = "hsl(" + p.hue.toFixed(0) + ",90%,65%)";
      if (p.dust) { c.globalAlpha = al * (0.5 + 0.5 * Math.sin(now / 90 + p.ph)); c.fillStyle = col; c.beginPath(); c.arc(x, y, p.h, 0, 6.2832); c.fill(); }
      else if (p.g) { c.globalAlpha = al; c.fillStyle = col; c.font = Math.round(p.h * 3.2 * (1 - 0.4 * life)) + "px sans-serif"; c.fillText(p.g, x, y); }
      else {
        hw = Math.max(0, (p.w - p.h) / 2);
        c.save(); c.translate(x, y); c.rotate(a + p.spin * d);
        c.globalAlpha = al; c.strokeStyle = col; c.lineWidth = p.h * (1 - 0.5 * life);
        c.beginPath(); c.moveTo(0, -hw); c.lineTo(0, hw); c.stroke(); c.restore();
      }
    }
    c.globalAlpha = 1; c.globalCompositeOperation = "source-over";
    return true;
  }
  function frame(now) {
    var G = geom(), j, b;
    c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, W, H);
    if (phase < 2) {
      for (j = 0; j < N; j++) {
        b = bars[j];
        if (!b.played && now >= b.t0) { b.played = true; if (A && A.c.state === "running") ping(b.f, A.c.currentTime + 0.02, 0.26 - 0.1 * j / N, Math.cos(b.ang) * 0.7); }
      }
      if (phase === 0 && now >= bars[N - 1].t0 + I.growTime * 1000) { phase = 1; fullAt = now; }
      if (phase === 1 && loaded && now - fullAt >= I.holdMin * 1000) { phase = 2; burst(now, G); }
    }
    if (phase < 2) drawBars(now, G);
    else if (!drawParts(now, G)) { if (cv.parentNode) cv.parentNode.removeChild(cv); return; }
    requestAnimationFrame(frame);
  }
  function reveal() {                                                        /* the burst begins: the page appears, the Earth sharpens and glows */
    body.classList.remove("intro"); body.classList.add("reveal", "ready");
    if (D.colorGlobe) D.colorGlobe();
    if (D.clearGlobe) D.clearGlobe();
    if (veil.parentNode) veil.parentNode.removeChild(veil);
  }

  /* start: tap -> sound unlocks, black fades off -> ring fills */
  function go() {
    sp = $("space");
    if (!sp) { reveal(); return; }
    if (!A) audioStart();
    cv = document.createElement("canvas"); c = cv.getContext("2d");
    cv.className = "intro-spectrum"; cv.setAttribute("aria-hidden", "true");
    var gl = $("globe"); sp.insertBefore(cv, gl && gl.parentNode === sp ? gl : null);   /* behind the Earth: the bars come out from behind it */
    fit(); window.addEventListener("resize", fit);
    var t = performance.now() + I.startDelay * 1000, j;
    for (j = 0; j < N; j++) bars[j].t0 = t + j / N * I.fillTime * 1000;
    requestAnimationFrame(frame);
  }
   var viaKey = false, gateOff = null;  
  function begin() {
    if (started) return; started = true;
    
    if (!viaKey && gateOff) gateOff();         /* started by tap or click: no Space keyup to wait for */
    audioStart();                                                            /* inside the tap: the browser allows sound */
    veil.style.setProperty("--fade", I.earthFade + "s");
    veil.classList.add("go"); veil.setAttribute("aria-hidden", "true");
    onSpace(go);
  }
  var h0 = I.titleHue != null ? I.titleHue : Math.floor(Math.random() * 360), title = document.createElement("div");
  title.className = "intro-title"; title.setAttribute("aria-hidden", "true"); title.textContent = I.title || "DANIG";
  veil.style.setProperty("--h0", h0); veil.style.setProperty("--h1", h0 + I.titleSpread / 2); veil.style.setProperty("--h2", h0 + I.titleSpread);
  veil.style.setProperty("--flow", I.titleFlow + "s");
  veil.appendChild(title);
  var btn = document.createElement("button"), t1 = document.createElement("span");
  btn.type = "button"; btn.className = "intro-gate";
  t1.textContent = I.gateText || "Tap anywhere to start"; btn.appendChild(t1);
  if (window.matchMedia && matchMedia("(hover: hover) and (pointer: fine)").matches) {          /* laptop or desktop: a keyboard is likely there */
    var t2 = document.createElement("span"); t2.textContent = I.gateKeyText || "or press Space to start"; btn.appendChild(t2);
  }
  veil.appendChild(btn);
  if (I.gate === false) begin();
  else {
    btn.addEventListener("click", begin); veil.addEventListener("click", begin); btn.focus();
  
    function spaceStart(e) {                                                /* capture phase on window: runs before global.js's shortcut dispatcher */
      if (e.key !== " " && e.key !== "Spacebar" && e.code !== "Space") return;
      e.preventDefault(); e.stopImmediatePropagation();                       /* no scroll, and the Space shortcut does nothing behind the gate */
      if (e.type === "keydown") { if (!started) { viaKey = true; begin(); } }
      else if (started) gateOff(); 
    }

     gateOff = function () {
      window.removeEventListener("keydown", spaceStart, true);
      window.removeEventListener("keyup", spaceStart, true);
      gateOff = null;

    };
    window.addEventListener("keydown", spaceStart, true);
    window.addEventListener("keyup", spaceStart, true);
  }

  /* loading goes on behind the gate; the burst waits for it */
  onSpace(function () { if (D.riseGlobe) D.riseGlobe(); });                 /* the Earth sits ready (grey, blurry) behind the black */
  var ready = Promise.all([
    document.readyState === "complete" ? 0 : once(window, "load"),
    document.fonts ? Promise.all([document.fonts.load("700 100px Poppins").catch(function () {}), document.fonts.ready]) : 0,
    new Promise(onSpace),
    image("assets/ui/danig_logo.svg"), image("assets/ui/mode-location.jpg"), image("assets/ui/mode-sweep.jpg")
  ]);
  var giveUp = new Promise(function (ok) { setTimeout(ok, I.maxWait * 1000); });   /* a missing file must never trap the person here */
  Promise.race([ready, giveUp]).then(function () { loaded = true; });
})();