/* instruments/registry.js: the instrument registry. The engine (engine.js), the I key, the Sound key,
   the upload form and the About sheet all read from here, so a new instrument shows up everywhere by itself.

   LOC.instruments.register({ id, name, play, ...optional })   see locationmode/templates/instrument.template.js */
(function () {
  "use strict";
  var LOC = (window.LOC = window.LOC || {}), list = [], byId = {}, alias = {};
  var FALLBACK = '<path d="M9 3v11.3A3.5 3.5 0 1 0 11 17.5V8h6V3z"/>';
  function pretty(id) { return id.replace(/[-_]/g, " ").replace(/^./, function (c) { return c.toUpperCase(); }); }
  var R = (LOC.instruments = {
    register: function (d) {
      if (!d || !d.id || typeof d.play !== "function") { console.error("Instrument needs an id and a play() function:", d); return; }
      var def = {
        id: d.id, name: d.name || pretty(d.id), desc: d.desc || "", gap: d.gap || 0.3,
        spoken: d.spoken || (d.name || pretty(d.id)).toLowerCase(), keyNote: d.keyNote || "",
        icon: d.icon || FALLBACK, outline: d.outline || d.icon || FALLBACK,
        cycle: d.cycle !== false, cycleOrder: d.cycleOrder == null ? 1000 + list.length : d.cycleOrder, play: d.play
      };
      if (byId[def.id]) list[list.indexOf(byId[def.id])] = def; else list.push(def);
      byId[def.id] = def;
      (d.alias || []).forEach(function (a) { alias[a] = def.id; });
      (d.types || []).forEach(function (t) {   /* data types that should use this instrument by default */
        var C = window.CONFIG; if (C) { C.timbres = C.timbres || {}; C.timbres[t] = def.id; }
      });
    },
    get: function (id) { return byId[alias[id] || id] || null; },
    list: function () { return list.slice(); },
    cycle: function () { return list.filter(function (d) { return d.cycle; }).sort(function (a, b) { return a.cycleOrder - b.cycleOrder; }).map(function (d) { return d.id; }); },
    name: function (id) { var d = R.get(id); return d ? d.name : id; },
    desc: function (id) { var d = R.get(id); return d ? d.desc : ""; },
    spoken: function (id) { var d = R.get(id); return d ? d.spoken : id; },
    gap: function (id) { var d = R.get(id); return d ? d.gap : 0.3; },
    keyNote: function (id) { var d = R.get(id); return d ? d.keyNote : ""; },
    outline: function (id) { var d = R.get(id); return d ? d.outline : FALLBACK; },
    icon: function (id) { var d = R.get(id); return '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">' + (d ? d.icon : FALLBACK) + "</svg>"; }
  });
})();
