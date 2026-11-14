// Put each video and its legend picture in this assets/ folder, then list them here.
// (A browser cannot list a folder by itself, so this file is the one place you edit.)
// lo / hi = what the LEFT and RIGHT ends of the legend mean. units shows in the readout.
window.PRESETS = [
  { name: 'Global temperature (T2M)', video: 'assets/lst.mp4', legend: 'assets/lst_legend.png', lo: -40, hi: 40, units: '°C' },
  { name: 'Global NOx',               video: 'assets/nox.mp4', legend: 'assets/nox_legend.png', lo: 0,   hi: 10, units: 'ppb' }  // set lo/hi to your NOx legend
];
