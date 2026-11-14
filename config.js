/* ============================================================
   EARTH JUKEBOX CONFIG. Change things here, not in app.js.
   ============================================================ */
window.CONFIG = {

  /* --- GRID: how coarsely we look at each frame (columns x rows) --- */
  grid: { cols: 18, rows: 9 },

  /* --- BANDS: used by the whole-map views, the description and the table.
     Rows count from the top (north) to the bottom (south). --- */
  bands: [
    { name: "Northern latitudes", rowStart: 0, rowEnd: 3 },
    { name: "Tropics",            rowStart: 3, rowEnd: 6 },
    { name: "Southern latitudes", rowStart: 6, rowEnd: 9 }
  ],

  /* --- PLACES: named spots for "One place" listening. lat: north is +, lon: east is +.
     Assumes the video is a whole flat world map (-180 to 180, 90 to -90). --- */
  places: [
    { name: "Equatorial Pacific (El Niño)", lat: 0,  lon: -145 },
    { name: "Philippines",                  lat: 10, lon: 123 },
    { name: "Amazon rainforest",            lat: -5, lon: -62 },
    { name: "Sahara desert",                lat: 23, lon: 12 },
    { name: "Congo basin",                  lat: 0,  lon: 22 },
    { name: "India",                        lat: 22, lon: 78 },
    { name: "Bay of Bengal",                lat: 15, lon: 88 },
    { name: "Gulf Stream",                  lat: 38, lon: -60 },
    { name: "Southern Ocean",               lat: -55, lon: 20 },
    { name: "Arctic Ocean",                 lat: 80, lon: 0 },
    { name: "North China Plain",   lat: 36, lon: 115 },
    { name: "Indo-Gangetic Plain", lat: 27, lon: 80 },
    { name: "Western Europe",      lat: 49, lon: 8 },
    { name: "US East Coast",       lat: 40, lon: -76 },
    { name: "Siberia",             lat: 62, lon: 100 },
    { name: "Persian Gulf",        lat: 27, lon: 51 },
  ],

  /* --- GAZETTEER: names for any spot the user picks by clicking or arrow keys.
     r = radius in km. The entry nearest relative to its own size wins.
     Inside the radius: "Name". Outside: "Near Name". Add as many as you like. --- */
  gazetteer: [
    
    { n: "the Amazon",              lat: -5,  lon: -62,  r: 1800 },
    { n: "the Sahara",              lat: 23,  lon: 12,   r: 2000 },
    { n: "the Philippines",         lat: 12,  lon: 122,  r: 700 },
    { n: "India",                   lat: 22,  lon: 79,   r: 1400 },
    { n: "the Congo basin",         lat: 0,   lon: 22,   r: 1200 },
    { n: "the Gulf Stream",         lat: 38,  lon: -60,  r: 1200 },
    { n: "the North Pacific Ocean", lat: 30,  lon: -170, r: 3500 },
    { n: "the equatorial Pacific",  lat: 0,   lon: -140, r: 3000 },
    { n: "the South Pacific Ocean", lat: -30, lon: -130, r: 3500 },
    { n: "the North Atlantic Ocean",lat: 35,  lon: -40,  r: 3000 },
    { n: "the South Atlantic Ocean",lat: -25, lon: -15,  r: 3000 },
    { n: "the Indian Ocean",        lat: -15, lon: 80,   r: 3500 },
    { n: "the Southern Ocean",      lat: -62, lon: 0,    r: 2500 },
    { n: "the Arctic Ocean",        lat: 82,  lon: 0,    r: 1800 },
    { n: "Antarctica",              lat: -80, lon: 0,    r: 2500 },
    { n: "Europe",                  lat: 50,  lon: 15,   r: 1800 },
    { n: "East Asia",               lat: 35,  lon: 105,  r: 2500 },
    { n: "Southeast Asia",          lat: 10,  lon: 105,  r: 1500 },
    { n: "Indonesia",               lat: -2,  lon: 115,  r: 1800 },
    { n: "Australia",               lat: -25, lon: 134,  r: 2000 },
    { n: "North America",           lat: 45,  lon: -100, r: 2800 },
    { n: "Canada",                  lat: 60,  lon: -100, r: 2200 },
    { n: "Central America",         lat: 14,  lon: -87,  r: 900 },
    { n: "the Caribbean",           lat: 17,  lon: -73,  r: 1200 },
    { n: "the Gulf of Mexico",      lat: 25,  lon: -90,  r: 900 },
    { n: "Brazil",                  lat: -12, lon: -52,  r: 2200 },
    { n: "the Andes",               lat: -18, lon: -68,  r: 1800 },
    { n: "Siberia",                 lat: 62,  lon: 100,  r: 2800 },
    { n: "Greenland",               lat: 72,  lon: -40,  r: 1300 },
    { n: "the Middle East",         lat: 28,  lon: 45,   r: 1600 },
    { n: "the Mediterranean Sea",   lat: 36,  lon: 15,   r: 1400 },
    { n: "Southern Africa",         lat: -20, lon: 25,   r: 1800 },
    { n: "West Africa",             lat: 10,  lon: -2,   r: 1500 },
    { n: "East Africa",             lat: 3,   lon: 38,   r: 1400 },
    { n: "the Bay of Bengal",       lat: 15,  lon: 88,   r: 900 },
    { n: "the Arabian Sea",         lat: 15,  lon: 65,   r: 1200 },
    { n: "the South China Sea",     lat: 12,  lon: 114,  r: 1100 },
    { n: "the Tibetan Plateau",     lat: 33,  lon: 88,   r: 1300 }
  ],

  spotMs: 250,              // one reading every N ms while the video plays (one place)
  spotDeg: 12,              // size of the listening spot in degrees
  spotStep: 3,              // arrow keys move the spot by this many degrees

  /* --- MUSIC --- */
  sweepMs: 4000,            // sweep view: how long one west-to-east sweep takes
  sweepStepSec: 1.5,        // sweep view: video time that jumps forward after each sweep
  chordMs: 1000,            // chord view: one chord every N ms while the video plays
  maxNotesPerColumn: 2,     // sweep view: strongest notes kept per column
 
  noteEveryTicks: -1,   // 1 = notes on every reading
  notesPerTick: 1,     // how many notes sound per reading (1 = just the main note)
  noteSpreadSteps: 100,  // scale steps between those notes
  

  scale: [0, 2, 4, 7, 9],   // pentatonic: sounds pleasant in any combination
  octaves: 3,               // pitch range
  lowMidi: 48,              // lowest note (60 = middle C)
  volume: 1.2,
    
  /* Instruments: pluck, bell, harp, lyre, flute, rainstick, guitar, windchime, piano*/
 timbres: { liquid:"bell", frozen:"bell", temperature:"harp", seatemperature:"harp", default:"pluck",
  carbon_monoxide:"flute", ozone:"lyre", nitrogen_oxide:"harp" },
  noteGain: { liquid: 8, default: 1 },   // per legend type, multiplies note loudness
 



  /* --- TEXTURE AND MUSIC LAYERS : the nature texture under the notes.
     "rain", "heat" (wind and shimmer), "ocean" (swell) or "none".
     A legend can override this with its own  scene: "ocean". --- */
  scenes: { liquid: "none", temperature: "none", "default": "none" },
  storyTour: false,         // true = guided tour: cues announce text AND move the marker. Keep false until the cue times in each preset's story are real.
  anomalyThreshold: 0.12,   // how far above the place's early baseline before the quiet clash fades in

  drone: false,              // one low tone for the whole planet, rises a little as the mean value rises
  notes: true,            // false = no instrument notes, texture and drone only


  /* --- LISTENING ---
     view "spot":  one place, a texture every tick, a sparse note about once a second.
     view "map":   the whole map swept west to east. The video freezes during each sweep.
     view "chord": the whole map as one chord per second while the video plays. */
  listen: {
    view: "spot",
    mode: "cycle",          // sweep view only: "cycle", "all", or a band number 0, 1, 2
    invertPitch: false,     // false: higher value (or further north) = higher note
    panWidth: 0.9,          // 0 = mono, 1 = hard left and right
    loudness: [0.1, 0.45],  // quietest and loudest note
    reverb: 0.12,
    flipPan: true           //which ear is music
  },

  /* --- ANALYSIS: how pixels become values --- */
  analysis: {
    width: 720,
    samplesPerTile: 6,
    maxColorDistance: 70,
    minCoverage: 0.06,
    wetMin: 0.1,
    dryColor: null,
    dryTolerance: 30,
    noDataColor: null
  },

  /* --- ACCESSIBILITY --- */
  announceEveryBeats: 4,    // map views: screen reader summary every N sweeps or chords

  /* --- DETAILS PANEL --- */
  info: { now: true, stats: true, bands: true, legends: true },

  /* --- LAST CARD: the upload slot (the form opens when you press Play on it) --- */
  upload: { name: "Upload your own", description: "Bring a video and a picture of its color bar. Hear any map move.",
            theme: { colors: ["#e5e5e5", "#737373", "#404040"], fixed: false }, videoUrl: "", legends: [] },

  proxyPath: "/proxy?url=",

  /* --- PRESETS. "place" = the named place chosen by default.
     story = guided tour cues. t is seconds into the video.
     !!! The times below are PLACEHOLDERS. Watch each video and put in the real moments. !!!
     A cue announces its text and, in one-place view, moves the spot to the named place. --- */
  presets: [
    {
      name: "IMERG rain",
      description: "Rain across the planet, every 30 minutes. You hear rain: more drops and a brighter wash mean heavier rain. Silence means dry.",
      theme: { colors: ["#38bdf8", "#6366f1", "#a855f7"], fixed: false },
      videoUrl: "assets/precip.mp4",
      mapCrop: { x: 0, y: 0, w: 1, h: 1 },
      place: "Philippines",
      story: [
        { t: 0,  place: "Philippines",   text: "Typhoon season. Listen for the rain thickening into a wash." },
        { t: 12, place: "Sahara desert", text: "Now the Sahara. Almost silence. This is what dry sounds like." },
        { t: 24, place: "Amazon rainforest", text: "The Amazon. Steady, heavy rain, the sound of a rainforest breathing." }
      ],
      legends: [
        { label: "Liquid precipitation", type: "liquid", url: "assets/rainlegend.png", min: 0.1, max: 50, scale: "log",
          orientation: "horizontal-lowleft", crop: { x: 0, y: 0, w: 1, h: 1 } }
      ]
    },
    {
      name: "Near-Surface Temperature",
      description: "Temperature near the ground, from polar cold to desert heat. Cold is deep, breathy wind. Hot is a thin, dry shimmer. Higher notes mean hotter.",
      theme: { colors: ["#fb923c", "#ef4444", "#a855f7"], fixed: false },
      videoUrl: "assets/lst.mp4",
      mapCrop: { x: 0, y: 0, w: 1, h: 1 },
      wetMin: -1000,
      place: "Sahara desert",
      story: [
        { t: 0,  place: "Sahara desert", text: "The Sahara. Listen for the thin, dry shimmer of extreme heat." },
        { t: 15, place: "Arctic Ocean",  text: "Now the Arctic. Deep, slow wind. This is the cold end of the planet." }
      ],
      legends: [
        { label: "Temperature in Celsius", type: "temperature",  url: "assets/lstlegend.png", min: -40, max: 40, scale: "linear",
          orientation: "horizontal-lowleft", crop: { x: 0, y: 0, w: 1, h: 1 } }
      ]
    },
    {
      name: "Sea Surface Temperature (SST)",
      description: "The temperature of the oceans over the past two and a half years. You hear ocean swell: warmer water means faster, brighter waves. A quiet clash means warmer than this place's normal.",
      theme: { colors: ["#fb923c", "#ef4444", "#2f42e8"], fixed: false },
      videoUrl: "assets/sst.mp4",
      mapCrop: { x: 0, y: 0, w: 1, h: 1 },
      wetMin: -1000,
      place: "Equatorial Pacific (El Niño)",
      story: [
        { t: 0,  place: "Equatorial Pacific (El Niño)", text: "The equatorial Pacific. A calm baseline. Remember this sound." },
        { t: 20, place: "Equatorial Pacific (El Niño)", text: "A warm patch is building. Listen for the quiet clash fading in." }
      ],
      legends: [
        { label: "Temperature in Celsius", type: "seatemperature", scene: "ocean", url: "assets/seatemplegend.png", min: -5, max: 35, scale: "linear",
          orientation: "horizontal-lowleft", crop: { x: 0, y: 0, w: 1, h: 1 } }
      ]
    },
    {
      name: "Carbon Monoxide (CO)",
      description: "Carbon monoxide near the ground, from NASA's GEOS-CF model. Clean air is quiet. Smoke from fires and cities adds a soft crackle and a warm haze. Higher notes mean more CO.",
      theme: { colors: ["#FFFCDA","#FF6D20","#E71F10","#B40A0F","#7E0110"], fixed: false },
      videoUrl: "assets/co.mp4", mapCrop: { x:0,y:0,w:1,h:1 },
      wetMin: 70, place: "Congo basin", story: [],
      legends: [{ label: "CO (ppbv)", type: "carbon_monoxide", url: "assets/co_legend.png",
        min: 40, max: 500, scale: "linear", orientation: "horizontal-lowleft", crop: { x:0,y:0,w:1,h:1 } }]
    },
    {
      name: "Near Surface Ozone (O3)",
      description: "Ozone near the ground, from NASA's GEOS-CF model. Thin, airy and glassy. More sparkle and a brighter shimmer mean more ozone. Higher notes mean more O3.",
      theme: { colors: ["#FEFEFE","#F3F3FA","#846AD8","#4221C0"], fixed: false },
      videoUrl: "assets/o3.mp4", mapCrop: { x:0,y:0,w:1,h:1 },
      wetMin: 20, place: "North China Plain", story: [],
      legends: [{ label: "O3 (ppbv)", type: "ozone", url: "assets/o3_legend.png",
        min: 5, max: 60, scale: "linear", orientation: "horizontal-lowleft", crop: { x:0,y:0,w:1,h:1 } }]
    },
    {
      name: "Nitrogen Oxides (NOx)",
      description: "Nitrogen oxides near the ground, from NASA's GEOS-CF model. A low, slow city hum, like distant engines and ships. Faster, brighter pulses mean more NOx. Higher notes mean more NOx.",
      theme: { colors: ["#FEFEFE","#76E176","#2BB32B","#107F0F","#023D01"], fixed: false },
      videoUrl: "assets/nox.mp4", mapCrop: { x:0,y:0,w:1,h:1 },
      wetMin: 0.3, place: "Western Europe", story: [],
      legends: [{ label: "NOx (ppbv)", type: "nitrogen_oxide", url: "assets/nox_legend.png",
        min: 0.001, max: 10, scale: "linear", orientation: "horizontal-lowleft", crop: { x:0,y:0,w:1,h:1 } }]
    }


  
  ]
};