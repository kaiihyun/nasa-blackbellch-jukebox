/* ============================================================
   space.js: twinkling stars behind every screen (loaded by global.js, so both modes get it).
   The Earth itself is the picture assets/ui/earth.png, set as the background of #space in styles.css.
   ============================================================ */
(function () {
  "use strict";
  var D = window.DANIG = window.DANIG || {}, doc = document, body = doc.body;
  if (doc.getElementById("space")) return;

  var sp = doc.createElement("div");
  sp.id = "space"; sp.setAttribute("aria-hidden", "true");
  sp.innerHTML = '<canvas class="stars s1"></canvas><canvas class="stars s2"></canvas>';
  body.insertBefore(sp, body.firstChild);

  function rng(seed) {
    return function () {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      var t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function drawStars(cv, seed, per) {
    var w = innerWidth, h = innerHeight, c, r = rng(seed), n, i, x, y, s, a;
    cv.width = w; cv.height = h; c = cv.getContext("2d");
    n = Math.round(w * h / per);
    for (i = 0; i < n; i++) {
      x = r() * w; y = r() * h; s = 0.4 + r() * r() * 1.4; a = 0.35 + r() * 0.65;
      c.fillStyle = r() < 0.22 ? "rgba(190,215,255," + a + ")" : "rgba(255,255,255," + a + ")";
      c.beginPath(); c.arc(x, y, s, 0, 6.2832); c.fill();
      if (s > 1.2) { c.fillStyle = "rgba(170,205,255," + (a * 0.14) + ")"; c.beginPath(); c.arc(x, y, s * 3.2, 0, 6.2832); c.fill(); }
    }
  }
  function paint() { drawStars(sp.children[0], 7, 6000); drawStars(sp.children[1], 19, 9000); }

  paint();
  var timer = 0;
  window.addEventListener("resize", function () { clearTimeout(timer); timer = setTimeout(paint, 150); });
  sp.classList.add("on");
  D.spaceIsReady = true;
  window.dispatchEvent(new Event("danig:space"));
})();
