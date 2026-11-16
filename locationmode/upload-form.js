/* upload-form.js: the Location mark "Upload your own" form (file buttons, instrument grid, texture button)
   and the instrument and scene lists in the About sheet. */
(function () {
  var $ = function (id) { return document.getElementById(id); };
  function say(t) { if (window.spotSay) window.spotSay(t); else $("live").textContent = t; }
  /* ---- upload form (location mark): file buttons, instrument grid, texture button ---- */
  var ST = 'viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"';
  /* The instrument and scene lists come from the registries, so new plugins appear here by themselves. */
  var INS = window.LOC.instruments, SCN = window.LOC.scenes;
  function fill(sel, rows) { sel.innerHTML = ""; rows.forEach(function (r) { var o = document.createElement("option"); o.value = r[0]; o.textContent = r[1]; sel.appendChild(o); }); }
  fill($("upInstr"), INS.list().map(function (d) { return [d.id, d.name]; }));
  (function () {
    var all = SCN.list().filter(function (s) { return s.upload; }), first = all.filter(function (s) { return s.uploadDefault; }), rest = all.filter(function (s) { return !s.uploadDefault; });
    fill($("upScene"), first.concat([{ id: "none", name: "None" }], rest).map(function (s) { return [s.id, s.name]; }));
  })();
  var upI = $("upInstr"), igrid = $("instGrid"), ibtns = [];
  [].slice.call(upI.options).forEach(function (o) {
    var b = document.createElement("button");
    b.type = "button"; b.className = "igb"; b.title = o.textContent; b.setAttribute("aria-label", o.textContent);
    b.innerHTML = "<svg " + ST + ">" + INS.outline(o.value) + "</svg>";
    b.addEventListener("click", function () { pickInst(o.value, true); });
    igrid.appendChild(b); ibtns.push(b);
  });
  function pickInst(v, play) {
    upI.value = v;
    ibtns.forEach(function (b, j) { b.setAttribute("aria-pressed", upI.options[j].value === v); });
    $("instName").textContent = "Instrument: " + upI.options[upI.selectedIndex].text;
    if (play) { say("Instrument: " + upI.options[upI.selectedIndex].text + "."); if (window.spotPreviewInstrument) window.spotPreviewInstrument(v); }
  }
  pickInst(upI.value, false);
  var upS = $("upScene");
  function showScene() { $("sceneName").textContent = upS.options[upS.selectedIndex].text; }
  showScene();
  /* About sheet: the same instruments and scenes as the upload form, so the lists never drift apart */
  [].slice.call(upI.options).forEach(function (o) {
    var li = document.createElement("li"), t = document.createElement("span");
    li.innerHTML = "<svg " + ST + ">" + INS.outline(o.value) + "</svg>";
    t.textContent = o.textContent; li.appendChild(t); $("aboutInst").appendChild(li);
  });
  [].slice.call(upS.options).forEach(function (o) {
    if (o.value === "none") return;
    var li = document.createElement("li"); li.textContent = o.textContent; $("aboutScenes").appendChild(li);
  });
  $("sceneCycle").addEventListener("click", function () {
    upS.selectedIndex = (upS.selectedIndex + 1) % upS.options.length; showScene();
    say("Background texture: " + upS.options[upS.selectedIndex].text + ".");
  });
  /* The two upload buttons show a preview of the chosen file. The settings stay locked (inert, dimmed) until both files are in. */
  var pv = { v: null, l: null }, upc = $("upcols");
  function preview(which, file) {
    if (pv[which] === file) return;
    pv[which] = file;
    var btn = $(which === "v" ? "pickVideo" : "pickLegend");
    btn.style.backgroundImage = "";
    if (which === "v") window.spotUpPreview = "";
    if (!file) { if (which === "v" && window.spotRepaint) window.spotRepaint(); return; }
    var url = URL.createObjectURL(file);
    if (which === "l") { btn.style.backgroundImage = 'url("' + url + '")'; return; }
    if (!window.spotShot) return;
    window.spotShot(url).then(function (d) {
      if (pv.v !== file) return;
      btn.style.backgroundImage = 'url("' + d + '")';
      window.spotUpPreview = d;
      if (window.spotRepaint) window.spotRepaint();   // the carousel card shows the same picture
    }).catch(function () {});
  }
  function syncForm(speak) {
    var v = $("file").files[0], l = $("legendFile").files[0], ready = !!(v && l);
    $("vName").textContent = v ? v.name : "MP4";
    $("lName").textContent = l ? l.name : "PNG, JPG, WebP";
    $("pickVideo").classList.toggle("has", !!v);
    $("pickLegend").classList.toggle("has", !!l);
    preview("v", v || null);
    preview("l", l || null);
    upc.inert = !ready;
    $("load").disabled = !ready;
    $("upHint").textContent = ready ? "Both files are in. Adjust the settings, then load."
      : v ? "Now add the legend picture." : l ? "Now add the video." : "Add your video and legend picture to unlock the settings below.";
    if (speak) say(ready ? "Both files chosen. The settings are unlocked. Press Load and continue when ready."
      : v ? "Video chosen. Now choose the legend picture." : l ? "Legend chosen. Now choose the video." : "Cleared.");
  }
  $("pickVideo").addEventListener("click", function () { $("file").click(); });
  $("pickLegend").addEventListener("click", function () { $("legendFile").click(); });
  $("file").addEventListener("change", function () { syncForm(true); });
  $("legendFile").addEventListener("change", function () { syncForm(true); });
  syncForm();

})();
