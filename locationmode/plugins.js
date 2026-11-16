/* plugins.js: loads YOUR instruments and scene layers.
   Put a file in locationmode/instruments/custom/ or locationmode/scenes/custom/, then run
       python3 tools/make-plugins.py
   which rewrites the list below. (Or add the path by hand.) Load order matters: this runs after the
   registries and built-ins and before the engine, so everything listed here is picked up automatically:
   the I and U keys, the Sound key, the upload form and the About sheet. */
(function () {
  "use strict";
  var FILES = [
/* AUTO-LIST-START */
/* AUTO-LIST-END */
  ];
  FILES.forEach(function (p) { document.write('<script src="' + window.DANIG.url(p) + '"><\/script>'); });
})();
