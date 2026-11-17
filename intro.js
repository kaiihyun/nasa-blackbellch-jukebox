/* ============================================================
   intro.js (index.html only)
     1  Intro     black screen with DANIG cut out of it, so the stars and Earth show through the letters.
                  Nothing moves until every file is loaded. Then the word grows until the whole page is visible,
                  and the landing page fades in (blur to sharp, one piece after another).
                  The zoom aims at the stem of the letter "I" (a plain solid bar) and ends the moment the
                  screen sits entirely inside it. At that point no black is left on screen, so the overlay is
                  simply removed. There is no fade, so no black is ever seen fading out.
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
  var svg = $("intro"), g = $("introScale"), tx = $("introText");
  function finish() {
    body.classList.remove("intro"); body.classList.add("reveal", "ready");
    if (svg) svg.style.display = "none";
  }
  if (!svg || !g || !tx || (window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches)) { finish(); return; }

  /* geometry, measured from the overlay itself (not window.innerHeight, which jumps on phones when the address bar moves) */
  var W = 0, H = 0, cx = 0, cy = 0,
      fx = 0, fy = 0,          /* the focus: the middle of the N's left leg, in text coordinates */
      kEnd = 140;              /* the scale at which the screen sits entirely inside that leg */
  var cvs = document.createElement("canvas").getContext("2d");

  function size() {
    var r = svg.getBoundingClientRect();
    W = r.width || window.innerWidth; H = r.height || window.innerHeight;
    cx = W / 2; cy = H / 2;
    var fs = Math.min(W * 0.235, H * 0.36);
    tx.setAttribute("font-size", fs);
    tx.setAttribute("x", cx); tx.setAttribute("y", cy);
    tx.setAttribute("dominant-baseline", "alphabetic");              /* the y below is then the true baseline, so the middle of the letters is known exactly */
    fx = cx; fy = cy; kEnd = 140;
    try {
      /* actual ink of "I" in the real font: where the bar is, and how wide and tall */
      cvs.font = "700 100px Poppins, system-ui, sans-serif";
      var mi = cvs.measureText("I"), mn = cvs.measureText("N"),
          k = fs / 100,
          stemW = (mi.actualBoundingBoxLeft + mi.actualBoundingBoxRight) * k,   /* the I is one bar, so its width is the stroke thickness */
          nLeft = -mn.actualBoundingBoxLeft * k,                                /* where the N's ink begins */
          stemH = mn.actualBoundingBoxAscent * k;
      if (stemW > 0 && stemH > 0) {
        var base = cy + stemH / 2;                                   /* baseline that puts the capital letters exactly in the middle of the screen */
        tx.setAttribute("y", base);
        var p = tx.getStartPositionOfChar(2);                        /* "DANIG": index 2 is the N */
        fx = p.x + nLeft + stemW / 2;                                /* the middle of the N's left leg, across */
        fy = base - stemH / 2;                                       /* and halfway up it: the middle of the N */
        kEnd = 4 * Math.max(W / stemW, H / stemH);                   /* at the end the leg is 4x the screen wide (and tall), so the screen is deep inside it */
      }
    } catch (e) {}
  }
  size(); window.addEventListener("resize", size);
  if (window.visualViewport) window.visualViewport.addEventListener("resize", size);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(size);    /* measure again once the real font is in */

  function once(target, type) { return new Promise(function (ok) { target.addEventListener(type, ok, { once: true }); }); }
  function image(src) { return new Promise(function (ok) { var i = new Image(); i.onload = i.onerror = ok; i.src = D.url ? D.url(src) : src; }); }
  var ready = Promise.all([
    document.readyState === "complete" ? 0 : once(window, "load"),
    document.fonts ? Promise.all([document.fonts.load("700 100px Poppins").catch(function () {}), document.fonts.ready]) : 0,
    D.spaceIsReady ? 0 : once(window, "danig:space"),
    image("assets/ui/danig_logo.svg"), image("assets/ui/earth.png"), image("assets/ui/mode-location.jpg"), image("assets/ui/mode-sweep.jpg"),
    new Promise(function (ok) { setTimeout(ok, 1100); })                     /* always show the word for a moment */
  ]);
  var giveUp = new Promise(function (ok) { setTimeout(ok, 9000); });          /* a missing file must never trap the person here */

  function ease(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  function smooth(u) { return u * u * (3 - 2 * u); }
  function grow() {
    var t0 = performance.now(), DUR = 4600, shown = false;
    size();                                                                    /* fonts are loaded now: measure again, with the real glyphs */
    svg.classList.add("go");
    function step(now) {
      var t = Math.min(1, (now - t0) / DUR),
          q = 0.82 * ease(t) + 0.18 * t,                                       /* 0..1, never decelerates to a stop */
          k = Math.exp(Math.log(kEnd) * q),
          s = smooth(Math.min(1, q / 0.55)),                                   /* the focus reaches the middle of the screen early, then NEVER moves again */
          px = fx + (cx - fx) * s, py = fy + (cy - fy) * s;
      g.setAttribute("transform", "translate(" + px + " " + py + ") scale(" + k + ") translate(" + (-fx) + " " + (-fy) + ")");
      if (!shown && t > 0.4) { shown = true; body.classList.add("reveal"); }   /* the landing page starts to fade in while the letters are still opening up */
      var f = Math.max(0, Math.min(1, (t - 0.7) / 0.3));                       /* last 30%: pure fade, zoom keeps going, nothing shifts */
      svg.style.opacity = String(1 - smooth(f));
      if (t < 1) requestAnimationFrame(step); else finish();
    }
    requestAnimationFrame(step);
  }
  Promise.race([ready, giveUp]).then(grow);
})();
