/* UI layer: landing screen, About and Setting sheets, text size, carousel buttons, keyboard shortcuts.
   It drives controls app.js already owns, so nothing here touches audio or analysis. */
(function () {
  var $ = function (id) { return document.getElementById(id); };
  var body = document.body, about = $("about"), sets = $("settings"), lastF = null;

  function say(t) { if (window.spotSay) window.spotSay(t); else $("live").textContent = t; }

  /* Player title mirrors the menu title */
  var t1 = $("pTitle"), t2 = $("pTitle2");
  function mirror() { t2.textContent = t1.textContent; }
  new MutationObserver(mirror).observe(t1, { childList: true, characterData: true, subtree: true });
  mirror();

  /* ---- landing and menu ---- */
  function leaveHome() {                     /* landing -> mode screen */
    if (!body.classList.contains("home")) return;
    body.classList.remove("home"); body.classList.add("modes");
    $("modeLoc").focus();
    say("Choose a mode. Press 1 for Location mark, 2 for Sweep. Left and right arrow keys move between them.");
  }
  function goHome() {
    body.classList.remove("modes"); body.classList.add("home");
    $("homeStart").focus();
    say("DANIG. The world, through sound. Press Enter to start.");
  }
  function goModes() {                       /* carousel -> mode screen */
    body.classList.add("modes");
    $("modeLoc").focus();
    say("Choose a mode. Press 1 for Location mark, 2 for Sweep.");
  }
  function chooseMode(m) {
    if (window.spotSetMode) window.spotSetMode(m);
    body.classList.remove("modes");
    $("start").focus();
    say((m === "sweep" ? "Sweep mode. " : "Location mark mode. ") + t1.textContent + ". Press Enter to play. Use the left and right arrow keys to change dataset.");
  }
  function go(d) {
    var s = $("preset");
    s.selectedIndex = (s.selectedIndex + d + s.options.length) % s.options.length;
    s.dispatchEvent(new Event("change"));
  }
  $("homeStart").addEventListener("click", leaveHome);
  $("exitMenu").addEventListener("click", goModes);
  $("exitModes").addEventListener("click", goHome);
  $("modeLoc").addEventListener("click", function () { chooseMode("location"); });
  $("modeSweep").addEventListener("click", function () { chooseMode("sweep"); });
  $("prev").addEventListener("click", function () { go(-1); });
  $("next").addEventListener("click", function () { go(1); });
  ["prev", "next"].forEach(function (id) {
    $(id).addEventListener("mousedown", function (e) { e.preventDefault(); });
  });

  /* ---- sheets ---- */
  function openDlg(d) {
    var o = d === about ? sets : about;
    if (o.open) o.close();
    if (!d.open) { lastF = document.activeElement; d.showModal(); }
  }
  [about, sets].forEach(function (d) {
    d.addEventListener("close", function () { if (lastF && document.contains(lastF)) lastF.focus(); });
    d.addEventListener("click", function (e) { if (e.target === d) d.close(); });   /* click the dimmed area to close */
  });
  document.querySelectorAll("[data-close]").forEach(function (b) {
    b.addEventListener("click", function () { b.closest("dialog").close(); });
  });
  $("aboutBtn").addEventListener("click", function () { openDlg(about); });
  $("helpBtn").addEventListener("click", function () { openDlg(sets); });

  /* ---- text size ---- */
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
  function moveSize(d) { var j = (si + d + SIZES.length) % SIZES.length; applySize(j); radios[j].focus(); }
  try { applySize(Math.max(0, Math.min(3, +localStorage.getItem("danigSize") || 0)), true); } catch (e) { applySize(0, true); }

  /* ---- video size ---- */
  var vsl = $("vsize"), VS = [100, 75, 50, 35];
  function applyVideo(p, say_) {
    p = Math.max(30, Math.min(100, p));
    vsl.value = p;
    document.documentElement.style.setProperty("--vs", p / 100);
    try { localStorage.setItem("danigVideo", p); } catch (e) {}
    if (say_) say("Video size " + p + " percent.");
  }
  vsl.addEventListener("input", function () { applyVideo(+vsl.value); });
  vsl.addEventListener("change", function () { say("Video size " + vsl.value + " percent."); vsl.blur(); });
  try { var sv = +localStorage.getItem("danigVideo"); if (sv) applyVideo(sv); } catch (e) {}
  function cycleVideo() {
    applyVideo(VS.filter(function (x) { return x < +vsl.value; })[0] || VS[0], true);
  }

  /* ---- keyboard shortcut pages (match the keys wired in app.js and below) ---- */
  var K = function () { return [].slice.call(arguments).map(function (k) { return "<kbd>" + k + "</kbd>"; }).join(" "); };
  var PAGES = [
    ["Menu", [[K("&larr;", "&rarr;"), "Previous or next dataset"], [K("1") + " to " + K("6"), "Jump to a dataset"],
      [K("Enter") + " or " + K("Space"), "Start, then open the player"], [K("A"), "About"], [K("?"), "Setting and shortcuts"],
      [K("T"), "Change text size"], [K("Esc"), "Back one screen"]]],
    ["Player", [[K("Space"), "Play or pause"], [K("S"), "Silence now (pause)"], [K(",") + " " + K("."), "Seek back or forward 5 seconds"],
      [K("&larr;", "&rarr;", "&uarr;", "&darr;"), "Move the listening spot"], [K("N") + " / " + K("Shift") + "+" + K("N"), "Next or previous named place"],
      [K("R"), "Restart from the beginning"], [K("K"), "Play the sound key (pauses playback)"], [K("D"), "Describe this moment"]]],
    ["Player, sound", [[K("I") + " / " + K("Shift") + "+" + K("I"), "Next or previous instrument"],
      [K("U") + " / " + K("Shift") + "+" + K("U"), "Next or previous scene layer"], [K("V"), "Change video size"], [K("P"), "Panning on or off (left and right ear)"],
      [K("[") + " " + K("]"), "Slower or faster (restarts playback)"], [K("-") + " " + K("="), "Volume down or up"], [K("Esc"), "Back to the menu"]]],
    ["Map", [[K("M"), "Focus the map"], [K("Click") + " or " + K("Tap"), "Place the spot"], [K("?"), "Open or close this list"], [K("&larr;", "&rarr;"), "In this list: previous or next page"]]]
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

  function step(id, d) {
    var s = $(id), i = Math.max(0, Math.min(s.options.length - 1, s.selectedIndex + d));
    if (i === s.selectedIndex) return false;
    s.selectedIndex = i; s.dispatchEvent(new Event("change")); return true;
  }

  /* ---- keys. Capture phase, so this runs before app.js and can keep keys away from it ---- */
  document.addEventListener("keydown", function (e) {
    var k = e.key;
    if (about.open || sets.open) {          /* a sheet owns the keyboard while open */
      if (k === "?") { e.preventDefault(); (about.open ? about : sets).close(); }
      else if (k.toLowerCase() === "t" && !(e.ctrlKey || e.metaKey || e.altKey)) applySize((si + 1) % SIZES.length);   /* T works here too */
      else if (sets.open && (k === "ArrowLeft" || k === "ArrowRight")) {   /* arrows turn the shortcut pages */
        e.preventDefault(); $(k === "ArrowRight" ? "kNext" : "kBack").click();
      }
      e.stopImmediatePropagation(); return;
    }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (/INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) return;
    var lk = k.toLowerCase(), home = body.classList.contains("home"), playing = body.classList.contains("playing");
    if (k === "?") { e.preventDefault(); openDlg(sets); return; }
    if (lk === "a") { e.preventDefault(); openDlg(about); return; }
    if (lk === "t") { applySize((si + 1) % SIZES.length); return; }

    if (home) {                             /* landing: only Start is live */
      if ((k === "Enter" || k === " ") && e.target.tagName !== "BUTTON") { e.preventDefault(); leaveHome(); }
      e.stopImmediatePropagation(); return;
    }
    if (body.classList.contains("modes")) {  /* mode screen */
      if (k === "Escape") goHome();
      else if (k === "1") chooseMode("location");
      else if (k === "2") chooseMode("sweep");
      else if (k === "ArrowLeft") { e.preventDefault(); $("modeLoc").focus(); }
      else if (k === "ArrowRight") { e.preventDefault(); $("modeSweep").focus(); }
      e.stopImmediatePropagation(); return;
    }
    if (!playing) {                         /* menu */
      if (k === "Escape" && !body.classList.contains("form")) { goModes(); return; }
      var n = parseInt(k, 10), cards = document.querySelectorAll(".cf");
      if (n >= 1 && n <= cards.length && !cards[n - 1].classList.contains("on")) cards[n - 1].click();
      return;
    }
    if (lk === "k") $("key").click();
    else if (lk === "d") $("describe").click();
    else if (lk === "v") cycleVideo();
    else if (lk === "s") {
      if (body.classList.contains("running")) $("play").click(); else say("Already silent.");
    }
    else if (lk === "p") { if (window.spotTogglePan) window.spotTogglePan(); }
    else if (lk === "m") { $("map").focus(); say("Map focused. Arrow keys move the listening spot."); }
    else if (lk === "n") { if (window.spotNextPlace) window.spotNextPlace(e.shiftKey ? -1 : 1); }
    else if (lk === "i") { var fn = e.shiftKey ? window.spotPrevInstrument : window.spotNextInstrument; if (fn) fn(); }
    else if (lk === "u") { var fn2 = e.shiftKey ? window.spotPrevScene : window.spotNextScene; if (fn2) fn2(); }
    else if (lk === "r") { $("seek").value = 0; $("seek").dispatchEvent(new Event("input")); say("Back at the start."); }
    else if (k === "[") { if (step("rate", -1)) say("Speed " + $("rate").selectedOptions[0].text + ". Playback restarted."); }
    else if (k === "]") { if (step("rate", 1)) say("Speed " + $("rate").selectedOptions[0].text + ". Playback restarted."); }
    else if (k === "-" || k === "=" || k === "+") {
      var v = $("volume"); v.value = Math.max(0, Math.min(1, +v.value + (k === "-" ? -0.1 : 0.1)));
      v.dispatchEvent(new Event("input")); say("Volume " + Math.round(v.value * 100) + " percent.");
    }
  }, true);

  /* open on the landing screen */
  $("homeStart").focus();
  say("DANIG. The world, through sound. Press Enter to start.");
})();
