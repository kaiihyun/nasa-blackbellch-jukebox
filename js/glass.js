/* glass.js: the "Glass opacity" slider in Setting. It sets --glass-alpha (see css/tokens.css), remembers it,
   and keeps the main page and the sweep player in step. Loaded by both pages. */
(function () {
  "use strict";
  var KEY = "danigGlass", root = document.documentElement,
      sl = document.getElementById("glassAmt"), out = document.getElementById("glassVal");
  function show(a) { if (sl) sl.value = Math.round(a * 100); if (out) out.textContent = Math.round(a * 100) + "%"; }
  function apply(a, save) {
    a = Math.max(0, Math.min(1, a));
    root.style.setProperty("--glass-alpha", a); show(a);
    if (save) try { localStorage.setItem(KEY, a); } catch (e) {}
  }
  var saved = NaN; try { saved = parseFloat(localStorage.getItem(KEY)); } catch (e) {}
  if (isFinite(saved)) apply(saved, false); else show(parseFloat(getComputedStyle(root).getPropertyValue("--glass-alpha")) || 0.26);
  if (sl) {
    sl.addEventListener("input", function () { apply(sl.value / 100, true); });
    sl.addEventListener("change", function () { if (window.spotSay) window.spotSay("Glass opacity " + sl.value + " percent."); });
  }
  window.addEventListener("storage", function (e) { if (e.key === KEY && e.newValue !== null) apply(parseFloat(e.newValue), false); });
})();
