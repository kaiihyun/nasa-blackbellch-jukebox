/* paths.js: where every asset lives. Loaded first by both pages.
   Pages in a subfolder (sweepmode/) set <html data-root="../"> so DANIG.url() can reach the site root.
   Config files write site-root paths, e.g. DANIG.video("lst.mp4") = "assets/videos/lst.mp4". */
(function () {
  "use strict";
  var D = (window.DANIG = window.DANIG || {});
  D.root = document.documentElement.getAttribute("data-root") || "";
  D.dirs = { videos: "assets/videos/", legends: "assets/legends/", ui: "assets/ui/" };   /* rename a folder here and everything follows */
  D.video = function (n) { return D.dirs.videos + n; };
  D.legend = function (n) { return D.dirs.legends + n; };
  D.ui = function (n) { return D.dirs.ui + n; };
  D.url = function (p) { return /^(https?:|data:|blob:|\/)/.test(p) ? p : D.root + p; };   /* site-root path -> path from THIS page */
})();
