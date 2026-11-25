/* ============================================================
   sfx.js: small interface sounds (index.html and sweepmode/sweep.html). Loaded BEFORE global.js,
   so its click listener runs before global.js can swallow a click.
     go    bright major arpeggio: Space, Enter, Play, Start, Next, picking a card, opening a sheet
     back  softer falling minor: Exit, Cancel, Pause, closing a sheet
     size  one bell per text size, low to high
     thud  faint dull tap: a click on empty space in the Location player
   Values: CONFIG.sfx in globalconfig.js. Instrument buttons are skipped: they play their own instrument.
   ============================================================ */
(function () {
  "use strict";
  var D = window.DANIG = window.DANIG || {}, S = (window.CONFIG && window.CONFIG.sfx) || {}, body = document.body;
  var ctx = null, bus = null, nb = null, last = 0, lastShift = -1, noop = function () {};
  D.sfx = { go: noop, back: noop, size: noop, thud: noop };
  if (S.enabled === false) return;

  function hz(m) { return 440 * Math.pow(2, (m - 69) / 12); }
  function ac() {
    if (ctx) return ctx;
    var a = D.audio && D.audio(), AC = window.AudioContext || window.webkitAudioContext;
    ctx = a ? a.c : (AC ? new AC() : null);
    if (ctx) {
      bus = ctx.createGain(); bus.gain.value = S.volume != null ? S.volume : 0.4; bus.connect(ctx.destination);
      nb = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * 0.05), ctx.sampleRate);
      var nd = nb.getChannelData(0), q; for (q = 0; q < nd.length; q++) nd[q] = Math.random() * 2 - 1;
    }
    return ctx;
  }
  function tone(f, t, amp, dur) {
    var o = ctx.createOscillator(), g = ctx.createGain();
    o.type = "sine"; o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(amp, t + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(bus); o.start(t); o.stop(t + dur + 0.03);
  }
  function bell(m, t, amp, dur, soft) { tone(hz(m), t, amp, dur); if (!soft) tone(hz(m) * 2.01, t, amp * 0.3, dur * 0.5); }

  function shift() {                                            /* a new starting note each time, never the same one twice in a row */
    var s = S.shifts || [-5, -3, 0, 2, 4], n = 0;
    if (s.length > 1) { do { n = Math.floor(Math.random() * s.length); } while (n === lastShift); lastShift = n; }
    return s[n];
  }




  var SOUNDS = {
    go: function (t) { var r = (S.majorMidi || 76) + shift(); [0, 4, 7].forEach(function (n, j) { bell(r + n, t + j * 0.045, 0.3 - j * 0.04, 0.34); }); },
    back: function (t) { var r = (S.minorMidi || 69) + shift(); [7, 3, 0].forEach(function (n, j) { bell(r + n, t + j * 0.055, 0.26 - j * 0.03, 0.3, true); }); },
    size: function (t, i) {                                     /* a soft pluck (triangle + closing filter), not a bell */
      var f = hz((S.sizeMidi || [48, 57, 66, 76])[i] || 64), lp = ctx.createBiquadFilter(), g = ctx.createGain(), o, o2, g2;
      o = ctx.createOscillator(); o.type = "triangle"; o.frequency.value = f;
      o2 = ctx.createOscillator(); o2.type = "triangle"; o2.frequency.value = f * 2; g2 = ctx.createGain(); g2.gain.value = 0.35;
      lp.type = "lowpass"; lp.frequency.setValueAtTime(Math.min(f * 8, 9000), t); lp.frequency.exponentialRampToValueAtTime(f * 1.5, t + 0.22);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.5, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
      o.connect(lp); o2.connect(g2); g2.connect(lp); lp.connect(g); g.connect(bus);
      o.start(t); o2.start(t); o.stop(t + 0.32); o2.stop(t + 0.32);
    },
    click: function (t) {                                       /* faint tick for passive buttons */
      var s = ctx.createBufferSource(), bp = ctx.createBiquadFilter(), g = ctx.createGain(), v = S.clickVolume != null ? S.clickVolume : 0.7;
      s.buffer = nb; bp.type = "bandpass"; bp.frequency.value = 2200; bp.Q.value = 1.2;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + 0.002); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.04);
      s.connect(bp); bp.connect(g); g.connect(bus); s.start(t); s.stop(t + 0.05);
    },
    thud: function (t) {
      var o = ctx.createOscillator(), g = ctx.createGain(), v = S.thudVolume != null ? S.thudVolume : 0.35;
      o.type = "sine"; o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(60, t + 0.09);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.13);
      o.connect(g); g.connect(bus); o.start(t); o.stop(t + 0.16);
    }
  };
  function play(name, arg) {
    if (body.classList.contains("intro")) return;
    var now = Date.now(); if (now - last < 90) return;          /* one sound per action, even when click and a direct hook both fire */
    var c = ac(); if (!c) return;
    last = now;
    function run() { SOUNDS[name](c.currentTime + 0.01, arg); }
    var p = c.state === "running" ? null : c.resume();
    if (p && p.then) p.then(run, noop); else run();
  }
  D.sfx = {
        go: function () { play("go"); }, back: function () { play("back"); }, click: function () { play("click"); },
        size: function (i) { play("size", i); }, thud: function () { if (S.thud !== false) play("thud"); }
  };




  /* the one click listener: mouse, tap, and keyboard shortcuts (global.js clicks the button for a key) all arrive here */
  var BTN = 'button,a[href],[role="radio"],[role="button"],[role="tab"],summary,.cfc';
  var SKIP = '#istrip,#sizes,[data-close],[data-act="instrument"],[data-act="instrumentPick"]';
  var MINOR = { exit: 1, cancel: 1, silence: 1 };
  var PASSIVE = { about: 1, settings: 1, svs: 1 };              /* they only open something: a faint click, not a melody */
  var EMPTY_OK = '#map,.mapfig,.vbox,video,input,select,textarea,label,dialog,.loader,.intro,[tabindex]';
  document.addEventListener("click", function (e) {
    var t = e.target, el = t && t.closest ? t.closest(BTN) : null, act;
    if (el) {
      if (el.disabled || el.getAttribute("aria-disabled") === "true" || el.closest(SKIP)) return;
      act = el.getAttribute("data-act") || "";
      if (el.id === "play") D.sfx[body.classList.contains("running") ? "back" : "go"]();   /* clicked while running = pause */
      else if (PASSIVE[act]) D.sfx.click();
      else D.sfx[MINOR[act] ? "back" : "go"]();
      return;
    }
    if (!t || !t.closest || !body.classList.contains("playing") || body.classList.contains("page-sweep")) return;
    if (document.querySelector("dialog[open]") || t.closest(EMPTY_OK)) return;
    D.sfx.thud();
  }, true);
})();