## [2026-11-25] New intro: tap-to-begin, Earth fade-in, colour spectrum ring with sparkle notes
- Replaced the DANIG SVG-mask zoom with a black "Tap to begin" gate, a grey/blurry Earth fade-in, a clockwise rainbow spectrum ring rising from behind the Earth with ascending sparkle notes, and a burst with an award sparkle once everything is loaded
- Earth turns sharp and coloured after the intro (CONFIG.intro.clearAfter = false restores the old grey look)
- All timings, sizes, colours and sound values are in CONFIG.intro
- Added DANIG.audio, DANIG.globeGeometry, DANIG.clearGlobe in space.js; hover is disabled during the intro
- Files: intro.js, globalconfig.js, space.js, index.html, styles.css


## [2026-11-25] Intro start screen: giant flowing-gradient DANIG, plain tap/Space text
- Start screen now shows a giant responsive DANIG with a left-to-right flowing gradient of neighbouring hues (random start colour, or CONFIG.intro.titleHue)
- Replaced the "Tap to begin" button with plain text at 3/4 height: "Tap anywhere to start", plus "or press Space to start" on mouse+keyboard devices
- Space now starts the intro; new CONFIG.intro keys: title, titleHue, titleSpread, titleFlow, gateText, gateKeyText
- Files: intro.js, styles.css, globalconfig.js
## [2026-11-25] Intro gate: fix Space key and hide focus outline
- Space now starts the intro (capture-phase listener on window, blocks the global shortcut dispatcher while the gate is up)
- Removed the focus outline around the "Tap anywhere to start" text
- Files: intro.js, styles.css

## [2026-11-25] Fix Space/Enter dead after the intro
- Intro gate's capture-phase Space listeners now remove themselves (on key release, or at once when started by tap), so Space and Enter work again on home Start, mode picker, carousel cards and play/pause
- Removed the redundant non-capture keydown listener
- Files: intro.js


## GIT COMMIT: NEW INTRO
---------------------------------