/* ============================================================
   global.js: everything both modes share. Loaded by index.html and sweepmode/sweep.html, after globalconfig.js.
     1  Keys          reads DANIG.keys (globalconfig.js): key labels, the badge on each button, what screen readers hear
     2  Setting       About and Setting sheets, text size, glass opacity, the shortcut list
     3  Keyboard      one handler: every button that has data-act="name" is clicked by its key
     4  Main page     landing, mode picker, Exit, the loading screen, the Sweep player (index.html only)
     5  Fit           shrinks a sheet or form that would otherwise be cut off
   A button gets its shortcut by carrying data-act="name" in the HTML. Nothing else is needed.
   ============================================================ */
(function () {
  "use strict";
  var D = window.DANIG, K = D.keys, UI = (window.CONFIG && window.CONFIG.ui) || {};
  var $ = function (id) { return document.getElementById(id); };
  var body = document.body;
  var MAIN = !!$("modeLoc");                         /* index.html; false on the Sweep page */

  D.say = D.say || function (t) { var n = $("live") || $("sr"); if (n) n.textContent = t; };
  function say(t) { if (window.spotSay) window.spotSay(t); else D.say(t); }

  /* ---------- 1. Keys ---------- */
  function parse(spec) {
    var s = String(spec), shift = false;
    if (s.indexOf("Shift+") === 0) { shift = true; s = s.slice(6); }
    return { shift: shift, key: s };
  }
  D.keyOf = function (act, i) { var v = K[act]; if (Object.prototype.toString.call(v) === "[object Array]") v = v[i || 0]; return v || ""; };
  /* does this key event match the key configured for the action? */
  D.is = function (e, act, i) {
    var v = D.keyOf(act, i); if (!v) return false;
    var p = parse(v);
    if (p.shift) return !!e.shiftKey && (e.code === "Digit" + p.key || e.code === "Key" + p.key.toUpperCase());
    if (e.key === p.key) return true;
    return /^[a-z]$/i.test(p.key) && e.key.toLowerCase() === p.key.toLowerCase();
  };
  var SHOWN = { Enter: "Enter", " ": "Space", Escape: "Esc", ArrowLeft: "←", ArrowRight: "→", ArrowUp: "↑", ArrowDown: "↓" };
  D.label = function (v) {
    var p = parse(v), k = SHOWN[p.key] || (p.key.length === 1 ? p.key.toUpperCase() : p.key);
    return (p.shift ? "⇧" : "") + k;
  };
  var SAID = { Enter: "Enter", " ": "Space", Escape: "Escape", ArrowLeft: "Left arrow", ArrowRight: "Right arrow", ArrowUp: "Up arrow", ArrowDown: "Down arrow",
    "?": "question mark", "[": "left bracket", "]": "right bracket", "-": "minus", "=": "equals", ",": "comma", ".": "period" };
  function spoken(v) { var p = parse(v); return (p.shift ? "Shift " : "") + (SAID[p.key] || p.key); }
  function aria(v) { var p = parse(v); return (p.shift ? "Shift+" : "") + (p.key === " " ? "Space" : p.key); }

  /* Puts the key to the right of the button's text and tells screen readers about it. Runs again whenever a script rewrites the button. */
  function decorate(el) {
    var act = el.getAttribute("data-act"), key = D.keyOf(act, +el.getAttribute("data-i") || 0);
    if (!key || el.querySelector(":scope > .kb, :scope > .kbs")) return;
    el.setAttribute("aria-keyshortcuts", aria(key));
    var al = el.getAttribute("aria-label");
    if (al) {                                                     /* icon buttons: the label carries the key */
      if (al.toLowerCase().indexOf("shortcut") < 0 && !el.hasAttribute("data-selflabel")) el.setAttribute("aria-label", al.replace(/[.\s]+$/, "") + ". Shortcut: " + spoken(key) + ".");
    } else {
      var s = document.createElement("span"); s.className = "sr kbs"; s.textContent = "Shortcut: " + spoken(key) + "."; el.appendChild(s);
    }
    if (!el.hasAttribute("data-nokbd")) {
      var kb = document.createElement("kbd"); kb.className = "kb"; kb.setAttribute("aria-hidden", "true"); kb.textContent = D.label(key);
      var first = el.querySelector(":scope > .kbs"); el.insertBefore(kb, first);
    }
  }
  function decorateAll(root) {
    if (root.nodeType !== 1) return;
    if (root.hasAttribute && root.hasAttribute("data-act")) decorate(root);
    [].forEach.call(root.querySelectorAll("[data-act]"), decorate);
  }
  decorateAll(body);
  [].forEach.call(document.querySelectorAll("[data-key]"), function (n) { n.textContent = D.label(D.keyOf(n.getAttribute("data-key"))); });   /* keys written inside headings */
  new MutationObserver(function (list) {
    list.forEach(function (m) {
      if (m.type === "childList") {
        [].forEach.call(m.addedNodes, decorateAll);
        var t = m.target.closest && m.target.closest("[data-act]"); if (t) decorate(t);      /* the button's own text was replaced */
      }
    });
  }).observe(body, { childList: true, subtree: true });
  D.decorate = decorateAll;

  /* switches from globalconfig.js */
  if (UI.showShortcutBadges === false) body.classList.add("shortcuts-off");
  if (UI.showTextSize === false) { [$("tsL"), $("sizes")].forEach(function (n) { if (n) n.hidden = true; }); }
  if (UI.showGlassOpacity === false) { var gl = $("glL"); if (gl) gl.hidden = true; var gr = $("glassAmt"); if (gr && gr.parentNode) gr.parentNode.hidden = true; }

  /* ---------- 2. Setting: sheets, text size, glass, shortcut list ---------- */
  var about = $("about"), sets = $("settings"), lastF = null;
  function openDlg(d) {
    var o = d === about ? sets : about;
    if (o.open) o.close();
    if (!d.open) { lastF = document.activeElement; d.showModal(); }
  }
  [about, sets].forEach(function (d) {
    d.addEventListener("close", function () { if (lastF && document.contains(lastF)) lastF.focus(); });
    d.addEventListener("click", function (e) { if (e.target === d) d.close(); });          /* click the dimmed area to close */
  });
  [].forEach.call(document.querySelectorAll("[data-close]"), function (b) { b.addEventListener("click", function () { b.closest("dialog").close(); }); });
  $("aboutBtn").addEventListener("click", function () { openDlg(about); });
  $("helpBtn").addEventListener("click", function () { openDlg(sets); });

  var SIZES = [["Normal", 100], ["Large", 115], ["Extra large", 130], ["Largest", 150]], si = 0;
  var radios = [].slice.call(document.querySelectorAll("#sizes [role=radio]"));
  function applySize(i, quiet) {
    si = i;
    document.documentElement.style.setProperty("--fs", SIZES[i][1] + "%");
    radios.forEach(function (b, j) { b.setAttribute("aria-checked", j === i); b.tabIndex = j === i ? 0 : -1; });
    try { localStorage.setItem("danigSize", i); } catch (e) {}
    if (!quiet) say("Text size: " + SIZES[i][0] + ".");
  }
  radios.forEach(function (b, j) { b.addEventListener("click", function () { applySize(j); }); });
  try { applySize(Math.max(0, Math.min(3, +localStorage.getItem("danigSize") || 0)), true); } catch (e) { applySize(0, true); }
  window.addEventListener("storage", function (e) { if (e.key === "danigSize" && e.newValue !== null) applySize(Math.max(0, Math.min(3, +e.newValue || 0)), true); });

  (function glass() {                                         /* the "Glass opacity" slider sets --glass-alpha */
    var KEY = "danigGlass", root = document.documentElement, sl = $("glassAmt"), out = $("glassVal");
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
      sl.addEventListener("change", function () { say("Glass opacity " + sl.value + " percent."); });
    }
    window.addEventListener("storage", function (e) { if (e.key === KEY && e.newValue !== null) apply(parseFloat(e.newValue), false); });
  })();

  /* the shortcut list in Setting is written from the config, so it can never disagree with the buttons */
  function kbs() { return [].slice.call(arguments).map(function (k) { return "<kbd>" + k + "</kbd>"; }).join(" "); }
  function L(act, i) { return D.label(D.keyOf(act, i)); }
  function both(a, b) { return kbs(L(a), L(b)); }
  var PAGES = MAIN ? [
    ["Menu", [[both("prev", "next"), "Previous or next dataset"], [kbs(L("start")), "Start, then open the player"],
      [kbs(L("modeLocation")) + " " + kbs(L("modeSweep")), "Location mark or Sweep"], [kbs(L("uploadVideo")) + " " + kbs(L("uploadLegend")), "Upload card: video or legend"],
      [kbs(L("about")), "About"], [kbs(L("settings")), "Setting and shortcuts"], [kbs(L("textSize")), "Change text size"], [kbs(L("exit")), "Back one screen"]]],
    ["Player", [[kbs(L("play")), "Play or pause"], [kbs(L("silence")), "Silence now (pause)"], [kbs(L("seekBack")) + " " + kbs(L("seekForward")), "Seek back or forward 5 seconds"],
      [kbs("&larr;", "&rarr;", "&uarr;", "&darr;"), "Move the listening spot"], [kbs(L("nextPlace")) + " / " + kbs("Shift") + "+" + kbs(L("nextPlace")), "Next or previous named place"],
      [kbs(L("restart")), "Restart from the beginning"], [kbs(L("soundKey")), "Play the sound key (pauses playback)"], [kbs(L("describe")), "Describe this moment"]]],
    ["Player, sound", [[kbs(L("instrument")) + " / " + kbs("Shift") + "+" + kbs(L("instrument")), "Next or previous instrument"],
      [kbs(L("instrumentPick", 0)) + " to " + kbs(L("instrumentPick", 9)), "Pick an instrument (the buttons beside the video)"],
      [kbs(L("scene")) + " / " + kbs("Shift") + "+" + kbs(L("scene")), "Next or previous scene layer"], [kbs(L("speed")), "Speed: Slow, Normal, Fast"],
      [kbs(L("pan")), "Panning on or off (left and right ear)"], [kbs(L("volumeDown")) + " " + kbs(L("volumeUp")), "Volume down or up"],
      [kbs(L("mute", 0)) + " to " + kbs(L("mute", 9)), "Mute a row of Playing now"]]],
    ["Map", [[kbs(L("focusMap")), "Focus the map"], [kbs("Click") + " or " + kbs("Tap"), "Place the spot"], [kbs(L("settings")), "Open or close this list"], [both("prev", "next"), "In this list: previous or next page"]]]
  ] : [
    ["Playlist", [[both("prev", "next"), "Previous or next track"], [kbs("1") + " to " + kbs("9"), "Jump to a track"],
      [kbs(L("start")), "Play the track"], [kbs(L("about")), "About"], [kbs(L("settings")), "Setting and shortcuts"],
      [kbs(L("textSize")), "Change text size"], [kbs(L("exit")), "Back one screen"]]],
    ["Player", [[kbs(L("play")), "Play or stop"], [kbs(L("pan")), "Panning on or off"], [kbs(L("silence")), "Stop the sound"], [kbs(L("restart")), "Restart the sweep from the west"],
      [kbs(L("describe")), "Describe this moment"], [kbs(L("exit")), "Back to the playlist (the track is chosen there)"]]],
    ["Player, sound", [[kbs(L("slower")) + " " + kbs(L("faster")), "Slower or faster sweep"], [kbs(L("volumeDown")) + " " + kbs(L("volumeUp")), "Volume down or up"],
      [kbs(L("seekBack")) + " " + kbs(L("seekForward")), "Video back or forward 5 seconds"], [kbs(L("textSize")), "Change text size"],
      [kbs(L("settings")), "Open or close this list"], [both("prev", "next"), "In this list: previous or next page"]]]
  ], kp = 0;
  function drawKeys() {
    var p = PAGES[kp], tb = $("kRows");
    $("kTitle").textContent = p[0]; tb.textContent = "";
    p[1].forEach(function (r) {
      var tr = document.createElement("tr"), a = document.createElement("td"), b = document.createElement("td");
      a.innerHTML = r[0]; b.textContent = r[1]; tr.appendChild(a); tr.appendChild(b); tb.appendChild(tr);
    });
    $("kPage").textContent = (kp + 1) + " of " + PAGES.length;
    $("kBack").disabled = kp === 0; $("kNext").disabled = kp === PAGES.length - 1;
  }
  $("kBack").addEventListener("click", function () { if (kp > 0) { kp--; drawKeys(); } });
  $("kNext").addEventListener("click", function () { if (kp < PAGES.length - 1) { kp++; drawKeys(); } });
  drawKeys();

  /* ---------- 4a. Main page: loading screen (before the keyboard code, so it can lock the keys first) ---------- */
  if (MAIN) (function loader() {
    var el = document.createElement("div");
    el.className = "loader done"; el.hidden = true; el.setAttribute("aria-busy", "false");
    el.innerHTML =
      '<div class="lstage" aria-hidden="true"><svg width="0" height="0" style="position:absolute"><defs>' +
      '<symbol id="dn1" viewBox="0 0 24 24"><ellipse cx="8" cy="18" rx="3.8" ry="2.8" transform="rotate(-20 8 18)"/><rect x="10.6" y="3" width="1.8" height="15"/><path d="M12.4 3c1 3.6 5.6 4.2 5.6 9.2-1.1-2.6-3.1-3.3-5.6-3.8z"/></symbol>' +
      '<symbol id="dn2" viewBox="0 0 24 24"><ellipse cx="6.5" cy="18" rx="3.4" ry="2.6" transform="rotate(-20 6.5 18)"/><rect x="8.7" y="5.5" width="1.7" height="12.5"/><ellipse cx="17" cy="16" rx="3.4" ry="2.6" transform="rotate(-20 17 16)"/><rect x="19.2" y="3" width="1.7" height="13"/><path d="M8.7 5.5l12.2-2.5v4L8.7 9.5z"/></symbol>' +
      '</defs></svg><div class="orbit">' +
      '<span class="lnote" style="--a:0deg"><svg><use href="#dn1"/></svg></span><span class="lnote" style="--a:90deg"><svg><use href="#dn2"/></svg></span>' +
      '<span class="lnote" style="--a:180deg"><svg><use href="#dn1"/></svg></span><span class="lnote" style="--a:270deg"><svg><use href="#dn2"/></svg></span></div>' +
      '<img class="llogo" src="' + D.url(D.ui("danig_logo.svg")) + '" alt=""></div>' +
      '<div class="lbar" role="progressbar" aria-label="Loading" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><i></i></div>' +
      '<p class="lpct">0%</p><button type="button" class="btn lcancel" data-act="cancel">Cancel</button>';
    body.appendChild(el);
    var bar = el.querySelector(".lbar"), fill = el.querySelector(".lbar i"), pct = el.querySelector(".lpct");
    var on = false, target = 0, shown = 0, t0 = 0, vp = 0, finishing = false, hideT = null, cancel = null, resolveDone = null, MIN_MS = 900;
    el.querySelector(".lcancel").addEventListener("click", function () { if (cancel) cancel(); });
    function paint() { var p = Math.round(shown * 100); fill.style.width = p + "%"; pct.textContent = p + "%"; bar.setAttribute("aria-valuenow", p); }
    function leave(ok) {
      on = false; el.setAttribute("aria-busy", "false"); el.classList.add("done");
      clearTimeout(hideT); hideT = setTimeout(function () { if (!on) el.hidden = true; }, 700);
      var r = resolveDone; resolveDone = null; cancel = null; finishing = false;
      if (r) r(ok);
    }
    function tick(now) {
      if (!on) return;
      target = Math.max(target, Math.min(1, 0.03 + 0.97 * vp));
      if (!finishing) target = Math.min(target, 0.96);                 /* never 100% until done() is called */
      shown = Math.min(target, shown + Math.max(0.004, (target - shown) * 0.08));
      paint();
      if (finishing && shown >= 1 && now - t0 >= MIN_MS) { shown = 1; paint(); return leave(true); }
      requestAnimationFrame(tick);
    }
    /* While it is up the keyboard belongs to the loader: Esc cancels, everything else is ignored. */
    document.addEventListener("keydown", function (e) {
      if (!on) return;
      if (e.ctrlKey || e.metaKey || e.altKey || /^F\d+$/.test(e.key)) return;
      e.preventDefault(); e.stopImmediatePropagation();
      if (e.key === "Escape" && cancel) cancel();
    }, true);
    window.DanigLoader = {
      show: function (onCancel) {
        clearTimeout(hideT);
        on = true; finishing = false; vp = 0; target = 0.03; shown = 0; t0 = performance.now(); cancel = onCancel || null;
        el.hidden = false; void el.offsetWidth; el.classList.remove("done"); el.setAttribute("aria-busy", "true");
        paint(); requestAnimationFrame(tick);
      },
      progress: function (p) { vp = Math.max(vp, Math.min(1, p)); },
      done: function () { return new Promise(function (ok) { if (!on) { ok(false); return; } vp = 1; finishing = true; resolveDone = ok; }); },
      fail: function () { if (on) leave(false); },
      active: function () { return on; }
    };
  })();

  /* ---------- 4b. Main page: the Sweep player lives in sweepmode/sweep.html, opened on top of the carousel ---------- */
  if (MAIN) (function bridge() {
    var C = window.CONFIG, EJP = (window.EJ && window.EJ.PRESETS) || [], DIR = "sweepmode/";
    var FALLBACK = ["#5aa9ee", "#6366f1", "#a855f7"], UP = "__upload__";
    function base(u) { return String(u || "").split("/").pop(); }

    /* carousel entries: a track reuses the colors of the Location dataset that has the same video file */
    EJP.forEach(function (p) {
      var twin = C.presets.filter(function (q) { return base(q.videoUrl) && base(q.videoUrl) === base(p.video); })[0];
      var colors = (twin && twin.theme && twin.theme.colors) || FALLBACK;
      C.presets.push({ name: p.name, description: p.blurb || "", theme: { colors: colors, fixed: true }, thumb: p.video || "", sweep: true, trackId: p.id });
    });

    var frame = null, win = null, busy = false, shown = false;
    var st = document.createElement("style");
    st.textContent = "#jukeboxFrame{position:fixed;inset:0;width:100%;height:100dvh;border:0;z-index:50;background:#02050b;visibility:hidden;opacity:0;transition:opacity .35s ease}" +
      "#jukeboxFrame.on{visibility:visible;opacity:1}@media (prefers-reduced-motion:reduce){#jukeboxFrame{transition:none}}";
    document.head.appendChild(st);

    /* while the player is loading or open, the carousel underneath must not react to the keyboard */
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
      say(msg || "The Earth Jukebox did not open. Check that the sweepmode folder sits next to index.html.");
    }
    function show() { shown = true; frame.classList.add("on"); win.focus(); var pl = win.document.getElementById("play"); if (pl) pl.focus(); }
    function hide() { shown = false; busy = false; frame.classList.remove("on"); window.focus(); $("start").focus(); say("Back to the playlist. " + $("pTitle").textContent + "."); }
    function watch() {                                       /* the jukebox adds "playing" to its body when its player opens, and removes it on Exit */
      var b = win.document.body;
      new MutationObserver(function () {
        var p = b.classList.contains("playing");
        if (p && !shown) show(); else if (!p && shown) hide();
      }).observe(b, { attributes: true, attributeFilter: ["class"] });
    }
    function index(id) {                                     /* the track's place in the jukebox's own playlist, or -1 until every legend picture is read */
      var E = win.EJ; if (!E || !E.MAPS || !E.PRESETS || !E.isReady || !E.isReady()) return -1;
      var T = E.PRESETS.filter(function (p) { return E.MAPS[p.map]; });
      for (var i = 0; i < T.length; i++) if (T[i].id === id) return i;
      return -1;
    }
    function drive(id, t0) {                                 /* uses the jukebox's own controls: Start, the number key, Play. The upload card opens the player empty. */
      var d = win.document, E = win.EJ, up = id === UP, i;
      if (up) i = (E && E.isReady && E.isReady() && E.openCustom) ? 0 : -1; else i = index(id);
      if (i < 0) { if (Date.now() - t0 > 20000) fail(); else setTimeout(function () { drive(id, t0); }, 100); return; }
      if (d.body.classList.contains("home")) d.getElementById("homeStart").click();
      if (up) {
        var f = window.spotSweepFiles && window.spotSweepFiles();
        if (!f) return fail("Upload a video and a legend first.");
        E.openCustom(f.video, f.legend); wait(Date.now()); return;
      }
      d.body.dispatchEvent(new win.KeyboardEvent("keydown", { key: String(i + 1), bubbles: true }));
      setTimeout(function () { d.getElementById("start").click(); wait(Date.now()); }, 260);
    }
    function wait(t0) {                                      /* the player opens only after the video is fully loaded */
      setTimeout(function () {
        if (shown || !busy) return;
        var E = win && win.EJ;
        if (E && E.loading && Date.now() - t0 < 120000) return wait(t0);
        if (E && E.loadError) return fail(E.loadError);
        if (Date.now() - t0 < 1500) return wait(t0);
        hide();                                              /* cancelled with Esc */
      }, 400);
    }
    function open(id) {
      if (busy) return; busy = true;
      var t0 = Date.now();
      if (frame) { frame.classList.add("on"); frame.focus(); return drive(id, t0); }
      frame = document.createElement("iframe");
      frame.id = "jukeboxFrame"; frame.title = "Earth Jukebox player"; frame.setAttribute("allow", "autoplay");
      frame.addEventListener("load", function () { win = frame.contentWindow; watch(); drive(id, t0); });
      frame.src = DIR + "sweep.html";
      frame.classList.add("on");
      body.appendChild(frame);
      frame.focus();
    }
    function current() { var it = window.spotCurrent && window.spotCurrent(); return it && it.sweep && (it.trackId !== UP || window.spotSweepFiles()) ? it.trackId : null; }

    /* Play on a Sweep track: click, or the Start key on the playlist */
    document.addEventListener("click", function (e) {
      if (!e.target.closest || !e.target.closest("#start")) return;
      var id = current(); if (!id) return;
      e.preventDefault(); e.stopImmediatePropagation(); open(id);
    }, true);
  })();

  /* ---------- 3. Keyboard ---------- */
  function usable(el) {
    if (el.hidden || el.disabled || el.closest("[inert]")) return false;
    if (!el.getClientRects().length) return false;
    return getComputedStyle(el).visibility !== "hidden";
  }
  /* Enter, Space, Escape and the arrows keep their normal meaning on a focused control, so those keys are left alone there */
  function nativeKey(e) { return (e.key === "Enter" || e.key === " ") && /^(BUTTON|A|SUMMARY)$/.test(e.target.tagName); }
  function claim(e) { e.preventDefault(); e.stopImmediatePropagation(); }

  document.addEventListener("keydown", function (e) {
    var k = e.key;
    if (about.open || sets.open) {                              /* a sheet owns the keyboard while open (Esc closes it natively) */
      if (e.target.id === "glassAmt" && /^(Arrow|Home$|End$|Page)/.test(k)) { e.stopImmediatePropagation(); return; }
      if (D.is(e, "settings")) { e.preventDefault(); (about.open ? about : sets).close(); }
      else if (D.is(e, "textSize") && UI.showTextSize !== false && !(e.ctrlKey || e.metaKey || e.altKey)) applySize((si + 1) % SIZES.length);
      else if (sets.open && (k === "ArrowLeft" || k === "ArrowRight")) { e.preventDefault(); $(k === "ArrowRight" ? "kNext" : "kBack").click(); }
      e.stopImmediatePropagation(); return;
    }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    var tg = e.target, tag = tg.tagName;
    if (tag === "SELECT" || tag === "TEXTAREA" || (tag === "INPUT" && tg.type !== "range" && tg.type !== "checkbox" && tg.type !== "file")) {   /* typing */
      var ld = $("load");                                       /* Enter in a settings field loads, like any form */
      if (MAIN && k === "Enter" && tag === "INPUT" && ld && usable(ld)) { claim(e); ld.click(); }
      return;
    }

    if (D.is(e, "settings")) { e.preventDefault(); openDlg(sets); return; }
    if (D.is(e, "about")) { e.preventDefault(); openDlg(about); return; }
    if (D.is(e, "textSize") && UI.showTextSize !== false) { applySize((si + 1) % SIZES.length); return; }

    var cl = body.classList, playing = cl.contains("playing");
    if (MAIN && cl.contains("home")) {                          /* landing: only Start is live */
      if ((D.is(e, "start") || k === " ") && tag !== "BUTTON") { e.preventDefault(); leaveHome(); }
      e.stopImmediatePropagation(); return;
    }
    if (MAIN && cl.contains("modes")) {                         /* mode picker */
      if (D.is(e, "exit")) goHome();
      else if (D.is(e, "modeLocation")) chooseMode("location");
      else if (D.is(e, "modeSweep")) chooseMode("sweep");
      else if (k === "ArrowLeft") { e.preventDefault(); $("modeLoc").focus(); }
      else if (k === "ArrowRight") { e.preventDefault(); $("modeSweep").focus(); }
      e.stopImmediatePropagation(); return;
    }

    /* the one dispatcher: a visible, enabled button with data-act="name" is clicked by its key */
    if (!nativeKey(e)) {
      var els = document.querySelectorAll("[data-act]");
      for (var n = 0; n < els.length; n++) {
        var el = els[n], act = el.getAttribute("data-act"), idx = +el.getAttribute("data-i") || 0;
        if (!D.is(e, act, idx) || !usable(el)) continue;
        if (e.shiftKey && (act === "instrument" || act === "scene")) {           /* Shift + the key = the one before */
          var back = act === "instrument" ? window.spotPrevInstrument : window.spotPrevScene;
          if (back) { claim(e); back(); return; }
        }
        claim(e); el.click(); return;
      }
    }

    if (k === " " && !playing && !nativeKey(e)) {               /* Space starts a track too, like Enter */
      var go = $("start");
      if (go && usable(go)) { claim(e); go.click(); return; }
    }
    if (!MAIN) return;                                          /* the Sweep page handles its own player keys (sweepmode/sweep.js) */
    if (!playing) {                                             /* playlist: 1 to 6 jump to a dataset */
      if (cl.contains("form")) return;
      var num = parseInt(k, 10), cards = document.querySelectorAll(".cf");
      if (num >= 1 && num <= cards.length && !cards[num - 1].classList.contains("on")) cards[num - 1].click();
      return;
    }
    if (D.is(e, "silence")) { if (cl.contains("running")) $("play").click(); else say("Already silent."); }
    else if (D.is(e, "pan")) { if (window.spotTogglePan) window.spotTogglePan(); }
    else if (D.is(e, "focusMap")) { $("map").focus(); say("Map focused. Arrow keys move the listening spot."); }
    else if (D.is(e, "nextPlace")) { if (window.spotNextPlace) window.spotNextPlace(e.shiftKey ? -1 : 1); }
    else if (D.is(e, "restart")) { $("seek").value = 0; $("seek").dispatchEvent(new Event("input")); say("Back at the start."); }
    else if (D.is(e, "slower")) { if (window.spotStepSpeed && window.spotStepSpeed(-1)) say("Speed " + $("rate").selectedOptions[0].text + ". Playback restarted."); }
    else if (D.is(e, "faster")) { if (window.spotStepSpeed && window.spotStepSpeed(1)) say("Speed " + $("rate").selectedOptions[0].text + ". Playback restarted."); }
    else if (D.is(e, "volumeDown") || D.is(e, "volumeUp") || k === "+") {
      var v = $("volume"); v.value = Math.max(0, Math.min(1, +v.value + (D.is(e, "volumeDown") ? -0.1 : 0.1)));
      v.dispatchEvent(new Event("input")); say("Volume " + Math.round(v.value * 100) + " percent.");
    }
  }, true);

  /* ---------- 4c. Main page: landing, mode picker, Exit ---------- */
  var leaveHome, goHome, chooseMode;
  if (MAIN) (function nav() {
    var t1 = $("pTitle"), t2 = $("pTitle2");
    function mirror() { t2.textContent = t1.textContent; }          /* the player title mirrors the carousel title */
    new MutationObserver(mirror).observe(t1, { childList: true, characterData: true, subtree: true });
    mirror();

    leaveHome = function () {                                       /* landing -> mode picker */
      if (!body.classList.contains("home")) return;
      body.classList.remove("home"); body.classList.add("modes");
      $("modeLoc").focus();
      say("Choose a mode. Press " + L("modeLocation") + " for Location mark, " + L("modeSweep") + " for Sweep. Left and right arrow keys move between them.");
    };
    goHome = function () {
      body.classList.remove("modes"); body.classList.add("home");
      $("homeStart").focus();
      say("DANIG. The world, through sound. Press " + L("start") + " to start.");
    };
    function goModes() {                                            /* carousel -> mode picker */
      body.classList.add("modes");
      $("modeLoc").focus();
      say("Choose a mode. Press " + L("modeLocation") + " for Location mark, " + L("modeSweep") + " for Sweep.");
    }
    chooseMode = function (m) {
      if (window.spotSetMode) window.spotSetMode(m);
      body.classList.remove("modes");
      $("start").focus();
      say((m === "sweep" ? "Sweep mode. " : "Location mark mode. ") + t1.textContent + ". Press " + L("start") + " to play. Use the left and right arrow keys to change dataset.");
    };
    function go(d) {
      var s = $("preset");
      s.selectedIndex = (s.selectedIndex + d + s.options.length) % s.options.length;
      s.dispatchEvent(new Event("change"));
    }
    $("homeStart").addEventListener("click", leaveHome);
    $("exitBtn").addEventListener("click", function () {            /* one Exit button, top left: back one screen (same as Esc) */
      var c = body.classList;
      if (c.contains("home")) return;
      if (c.contains("modes")) goHome();
      else if (c.contains("playing") || c.contains("form")) { if (window.spotBack) window.spotBack(); }
      else goModes();
    });
    $("modeLoc").addEventListener("click", function () { chooseMode("location"); });
    $("modeSweep").addEventListener("click", function () { chooseMode("sweep"); });
    $("prev").addEventListener("click", function () { go(-1); });
    $("next").addEventListener("click", function () { go(1); });
    ["prev", "next"].forEach(function (id) { $(id).addEventListener("mousedown", function (e) { e.preventDefault(); }); });
    $("homeStart").focus();
    say("DANIG. The world, through sound. Press " + L("start") + " to start.");
  })();

  /* ---------- 5. Fit: nothing on this site scrolls, so a sheet or form that is too big is scaled down ---------- */
  (function fit() {
    var pending = 0;
    function fitDialog(d) {
      d.style.transform = ""; d.style.animation = "";
      if (!d.open) return;
      var vw = window.innerWidth, vh = window.innerHeight, m = 16, w = d.offsetWidth, h = d.offsetHeight,
          k = Math.min(1, (vw - 2 * m) / w, (vh - 2 * m) / h);
      if (k >= 0.999) return;
      var cx = d.offsetLeft + w / 2, cy = d.offsetTop + h / 2;
      d.style.animation = "none";
      d.style.transform = "translate(" + (vw / 2 - cx) + "px," + (vh / 2 - cy) + "px) scale(" + k + ")";
    }
    function fitForm() {
      var s = document.querySelector(".src"), main = $("main"), mid = document.querySelector(".mid");
      if (!s || !main || !mid) return;
      s.style.transform = ""; s.style.animation = "";
      var b = body.classList;
      if (!b.contains("form") || b.contains("playing")) return;
      var top = mid.getBoundingClientRect().top - main.getBoundingClientRect().top,
          k = Math.min(1, (main.clientHeight - top - 8) / s.offsetHeight);
      if (k >= 0.999) return;
      s.style.animation = "none"; s.style.transform = "scale(" + Math.max(0.4, k) + ")";
    }
    function run() { [].forEach.call(document.querySelectorAll("dialog"), fitDialog); fitForm(); }
    function schedule() { if (pending) return; pending = requestAnimationFrame(function () { pending = 0; run(); }); }
    window.addEventListener("resize", schedule);
    window.addEventListener("load", schedule);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(schedule);
    new MutationObserver(function () { if (!body.classList.contains("playing") || document.querySelector("dialog[open]")) schedule(); })
      .observe(document.documentElement, { attributes: true, attributeFilter: ["style"] });
    new MutationObserver(schedule).observe(body, { attributes: true, attributeFilter: ["class"] });
    [].forEach.call(document.querySelectorAll("dialog"), function (d) {
      new MutationObserver(schedule).observe(d, { attributes: true, attributeFilter: ["open"], childList: true, characterData: true, subtree: true });
    });
    var src = document.querySelector(".src");
    if (src) new MutationObserver(schedule).observe(src, { childList: true, characterData: true, subtree: true });
    schedule();
  })();
})();
