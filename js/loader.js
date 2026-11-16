/* loader.js: the loading screen (logo, orbiting notes, a bar that only ever fills) for the DANIG presets. Styles: css/loader.css.
   It looks the same as the one inside the Earth Jukebox. app.js shows it while a preset's legend and video load,
   and the player only opens after it reaches 100%. While it is up the keyboard is locked; Esc cancels.

     DanigLoader.show(onCancel)   start a fresh load (bar at 0)
     DanigLoader.progress(p)      p from 0 to 1; the bar never goes back
     DanigLoader.done()           fill to 100%, fade out; returns a Promise: true = finished, false = cancelled or failed
     DanigLoader.fail()           leave at once (error or cancel)
     DanigLoader.active()         is it on screen
*/
(function () {
  "use strict";
  /* The look is in css/loader.css (shared with the sweep player). */

  var el = document.createElement("div");
  el.className = "loader done";
  el.hidden = true;
  el.setAttribute("aria-busy", "false");
  el.innerHTML =
    '<div class="lstage" aria-hidden="true">' +
    '<svg width="0" height="0" style="position:absolute"><defs>' +
    '<symbol id="dn1" viewBox="0 0 24 24"><ellipse cx="8" cy="18" rx="3.8" ry="2.8" transform="rotate(-20 8 18)"/><rect x="10.6" y="3" width="1.8" height="15"/><path d="M12.4 3c1 3.6 5.6 4.2 5.6 9.2-1.1-2.6-3.1-3.3-5.6-3.8z"/></symbol>' +
    '<symbol id="dn2" viewBox="0 0 24 24"><ellipse cx="6.5" cy="18" rx="3.4" ry="2.6" transform="rotate(-20 6.5 18)"/><rect x="8.7" y="5.5" width="1.7" height="12.5"/><ellipse cx="17" cy="16" rx="3.4" ry="2.6" transform="rotate(-20 17 16)"/><rect x="19.2" y="3" width="1.7" height="13"/><path d="M8.7 5.5l12.2-2.5v4L8.7 9.5z"/></symbol>' +
    "</defs></svg>" +
    '<div class="orbit">' +
    '<span class="lnote" style="--a:0deg"><svg><use href="#dn1"/></svg></span>' +
    '<span class="lnote" style="--a:90deg"><svg><use href="#dn2"/></svg></span>' +
    '<span class="lnote" style="--a:180deg"><svg><use href="#dn1"/></svg></span>' +
    '<span class="lnote" style="--a:270deg"><svg><use href="#dn2"/></svg></span>' +
    "</div>" +
    '<img class="llogo" src="' + DANIG.url(DANIG.ui("danig_logo.svg")) + '" alt="">' +
    "</div>" +
    '<div class="lbar" role="progressbar" aria-label="Loading" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><i></i></div>' +
    '<p class="lpct">0%</p><button type="button" class="btn lcancel">Cancel</button><p class="lhint">Esc to cancel</p>';
  document.body.appendChild(el);
  var bar = el.querySelector(".lbar"), fill = el.querySelector(".lbar i"), pct = el.querySelector(".lpct");

  var on = false, target = 0, shown = 0, t0 = 0, vp = 0, finishing = false, hideT = null, cancel = null, resolveDone = null;
  var MIN_MS = 900;
  el.querySelector(".lcancel").addEventListener("click", function () { if (cancel) cancel(); });

  function paint() {
    var p = Math.round(shown * 100);
    fill.style.width = p + "%";
    pct.textContent = p + "%";
    bar.setAttribute("aria-valuenow", p);
  }
  function leave(ok) {
    on = false;
    el.setAttribute("aria-busy", "false");
    el.classList.add("done");
    clearTimeout(hideT);
    hideT = setTimeout(function () { if (!on) el.hidden = true; }, 700);
    var r = resolveDone; resolveDone = null; cancel = null; finishing = false;
    if (r) r(ok);
  }
  function tick(now) {
    if (!on) return;
    target = Math.max(target, Math.min(1, 0.03 + 0.97 * vp));
    if (!finishing) target = Math.min(target, 0.96);          // never 100% until done() is called
    shown = Math.min(target, shown + Math.max(0.004, (target - shown) * 0.08));   // eases up, never down
    paint();
    if (finishing && shown >= 1 && now - t0 >= MIN_MS) { shown = 1; paint(); return leave(true); }
    requestAnimationFrame(tick);
  }

  /* While it is up, the keyboard belongs to the loader: Esc cancels, everything else is ignored. */
  document.addEventListener("keydown", function (e) {
    if (!on) return;
    if (e.ctrlKey || e.metaKey || e.altKey || /^F\d+$/.test(e.key)) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    if (e.key === "Escape" && cancel) cancel();
  }, true);

  window.DanigLoader = {
    show: function (onCancel) {
      clearTimeout(hideT);
      on = true; finishing = false; vp = 0; target = 0.03; shown = 0; t0 = performance.now(); cancel = onCancel || null;
      el.hidden = false;
      void el.offsetWidth;
      el.classList.remove("done");
      el.setAttribute("aria-busy", "true");
      paint();
      requestAnimationFrame(tick);
    },
    progress: function (p) { vp = Math.max(vp, Math.min(1, p)); },
    done: function () {
      return new Promise(function (ok) {
        if (!on) { ok(false); return; }
        vp = 1; finishing = true; resolveDone = ok;
      });
    },
    fail: function () { if (on) leave(false); },
    active: function () { return on; }
  };
})();
