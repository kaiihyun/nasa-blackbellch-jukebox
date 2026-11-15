/* fit.js: nothing on this site scrolls, so anything that could be too big is scaled down to fit.
   It covers the About and Setting sheets (every page of them) and the location-mark upload form.
   The CSS already shrinks spacing and controls with the screen height; this is the last step, and does nothing when the content fits.
   Used by index.html and, as ../fit.js, by jukebox/jukebox.html. */
(function () {
  "use strict";
  var pending = 0;

  function fitDialog(d) {
    d.style.transform = "";
    d.style.animation = "";
    if (!d.open) return;
    var vw = window.innerWidth, vh = window.innerHeight, m = 12,
        w = d.offsetWidth, h = d.offsetHeight,                       /* layout size: not affected by transforms or the opening animation */
        k = Math.min(1, (vw - 2 * m) / w, (vh - 2 * m) / h);
    if (k >= 0.999) return;
    var cx = d.offsetLeft + w / 2, cy = d.offsetTop + h / 2;         /* where it sits now, so it can be moved to the middle of the screen */
    d.style.animation = "none";
    d.style.transform = "translate(" + (vw / 2 - cx) + "px," + (vh / 2 - cy) + "px) scale(" + k + ")";
  }

  function fitForm() {
    var s = document.querySelector(".src"), main = document.getElementById("main"), mid = document.querySelector(".mid");
    if (!s || !main || !mid) return;
    s.style.transform = "";
    s.style.animation = "";
    var b = document.body.classList;
    if (!b.contains("form") || b.contains("playing")) return;
    var top = mid.getBoundingClientRect().top - main.getBoundingClientRect().top,
        k = Math.min(1, (main.clientHeight - top - 8) / s.offsetHeight);
    if (k >= 0.999) return;
    s.style.animation = "none";
    s.style.transform = "scale(" + Math.max(0.4, k) + ")";
  }

  function run() {
    [].forEach.call(document.querySelectorAll("dialog"), fitDialog);
    fitForm();
  }
  function schedule() {
    if (pending) return;
    pending = requestAnimationFrame(function () { pending = 0; run(); });
  }

  window.addEventListener("resize", schedule);
  window.addEventListener("load", schedule);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(schedule);

  /* text size lives on <html style>, the form opens through a class on <body>, sheets open through [open] and change page by rewriting their rows */
  new MutationObserver(function () {   /* while playing, the page colors change several times a second: only refit when a sheet is open */
    if (!document.body.classList.contains("playing") || document.querySelector("dialog[open]")) schedule();
  }).observe(document.documentElement, { attributes: true, attributeFilter: ["style"] });
  new MutationObserver(schedule).observe(document.body, { attributes: true, attributeFilter: ["class"] });
  [].forEach.call(document.querySelectorAll("dialog"), function (d) {
    new MutationObserver(schedule).observe(d, { attributes: true, attributeFilter: ["open"], childList: true, characterData: true, subtree: true });
  });
  var src = document.querySelector(".src");
  if (src) new MutationObserver(schedule).observe(src, { childList: true, characterData: true, subtree: true });
  schedule();
})();
