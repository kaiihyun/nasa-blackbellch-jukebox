/* bridge.js: puts the Earth Jukebox tracks (jukebox/presets.js) into the SPOT carousel.
   It edits nothing. SPOT's carousel shows the extra tracks; pressing Play on one opens the
   untouched Earth Jukebox player (jukebox/index.html) on top, already on that track.
   Leaving that player (Exit or Esc) lands back on this carousel. */
(function () {
  "use strict";
  var $ = function (id) { return document.getElementById(id); };
  var C = window.CONFIG, EJP = (window.EJ && window.EJ.PRESETS) || [], DIR = "jukebox/";
  var FALLBACK = ["#5aa9ee", "#6366f1", "#a855f7"], TRACKS = {};
  function base(u) { return String(u || "").split("/").pop(); }
  function say(t) { if (window.spotSay) window.spotSay(t); }

  /* 1. carousel entries. A track reuses the colors of the SPOT dataset that has the same video file. */
  EJP.forEach(function (p) {
    var twin = C.presets.filter(function (q) { return base(q.videoUrl) && base(q.videoUrl) === base(p.video); })[0];
    var colors = (twin && twin.theme && twin.theme.colors) || FALLBACK;
    C.presets.push({ name: p.name, description: p.blurb || "", theme: { colors: colors, fixed: true }, thumb: p.video ? DIR + p.video : "" });
    TRACKS[p.name] = p.id;
  });

  /* 2. the player, loaded the first time it is needed */
  var frame = null, win = null, busy = false, shown = false;
  var st = document.createElement("style");
  st.textContent = "#jukeboxFrame{position:fixed;inset:0;width:100%;height:100dvh;border:0;z-index:50;background:#02050b;visibility:hidden;opacity:0;transition:opacity .35s ease}" +
    "#jukeboxFrame.on{visibility:visible;opacity:1}@media (prefers-reduced-motion:reduce){#jukeboxFrame{transition:none}}";
  document.head.appendChild(st);

  /* While the player is loading or open, the carousel underneath must not react to the keyboard (arrow keys would change its track). */
  document.addEventListener("keydown", function (e) {
    if (!busy && !shown) return;
    if (e.ctrlKey || e.metaKey || e.altKey || /^F\d+$/.test(e.key)) return;
    e.preventDefault(); e.stopImmediatePropagation();
    if (win) win.focus();
  }, true);

  function fail(msg) {
    var dead = !(win && win.EJ);
    busy = false; shown = false;
    if (frame) frame.classList.remove("on");
    if (dead && frame) { frame.remove(); frame = null; win = null; }
    window.focus(); $("start").focus();
    say(msg || "The Earth Jukebox did not open. Check that the jukebox folder sits next to index.html.");
  }
  function show() {
    shown = true; frame.classList.add("on"); win.focus();
    var pl = win.document.getElementById("play"); if (pl) pl.focus();
  }
  function hide() {
    shown = false; busy = false; frame.classList.remove("on"); window.focus();
    $("start").focus(); say("Back to the playlist. " + $("pTitle").textContent + ".");
  }
  function watch() {   /* the jukebox adds "playing" to its body when its player opens, and removes it on Exit */
    var b = win.document.body;
    new MutationObserver(function () {
      var p = b.classList.contains("playing");
      if (p && !shown) show(); else if (!p && shown) hide();
    }).observe(b, { attributes: true, attributeFilter: ["class"] });
  }
  function index(id) {   /* the track's place in the jukebox's own playlist, or -1 until every legend picture is read */
    var E = win.EJ; if (!E || !E.MAPS || !E.PRESETS || !E.isReady || !E.isReady()) return -1;
    var T = E.PRESETS.filter(function (p) { return E.MAPS[p.map]; });
    for (var i = 0; i < T.length; i++) if (T[i].id === id) return i;
    return -1;
  }
  function drive(id, t0) {   /* uses the jukebox's own controls: Start, the number key, Play */
    var i = index(id), d = win.document;
    if (i < 0) { if (Date.now() - t0 > 20000) fail(); else setTimeout(function () { drive(id, t0); }, 100); return; }
    if (d.body.classList.contains("home")) d.getElementById("homeStart").click();
    d.body.dispatchEvent(new win.KeyboardEvent("keydown", { key: String(i + 1), bubbles: true }));
    setTimeout(function () { d.getElementById("start").click(); wait(Date.now()); }, 260);
  }
  function wait(t0) {   /* the player opens only after the video is fully loaded, which can take a while: wait while the jukebox says it is loading */
    setTimeout(function () {
      if (shown || !busy) return;
      var E = win && win.EJ;
      if (E && E.loading && Date.now() - t0 < 120000) return wait(t0);
      if (E && E.loadError) return fail(E.loadError);
      if (Date.now() - t0 < 1500) return wait(t0);     /* the click has just been sent */
      hide();                                          /* cancelled with Esc */
    }, 400);
  }
  function open(id) {
    if (busy) return; busy = true;
    var t0 = Date.now();
    if (frame) { frame.classList.add("on"); frame.focus(); return drive(id, t0); }   /* the jukebox's loading screen shows while the track loads */
    frame = document.createElement("iframe");
    frame.id = "jukeboxFrame"; frame.title = "Earth Jukebox player"; frame.setAttribute("allow", "autoplay");
    frame.addEventListener("load", function () { win = frame.contentWindow; watch(); drive(id, t0); });
    frame.src = DIR + "jukebox.html";
    frame.classList.add("on");   /* show the player at once so its loading screen is seen */
    document.body.appendChild(frame);
    frame.focus();
  }
  function current() { return TRACKS[$("pTitle").textContent]; }

  /* 3. Play on a jukebox track: click, or Enter / Space on the playlist */
  document.addEventListener("click", function (e) {
    if (!e.target.closest || !e.target.closest("#start")) return;
    var id = current(); if (!id) return;
    e.preventDefault(); e.stopImmediatePropagation(); open(id);
  }, true);
  document.addEventListener("keydown", function (e) {
    var cl = document.body.classList;
    if (cl.contains("home") || cl.contains("playing") || cl.contains("form") || document.querySelector("dialog[open]")) return;
    if (e.key !== "Enter" && e.key !== " ") return;
    if (/^(BUTTON|INPUT|SELECT|TEXTAREA|A)$/.test(e.target.tagName)) return;
    var id = current(); if (!id) return;
    e.preventDefault(); e.stopImmediatePropagation(); open(id);
  }, true);
})();
