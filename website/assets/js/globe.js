/* ================================================================
   spatioClimata — 2D Interactive Map (Leaflet / OpenStreetMap)
   ================================================================ */

// ── Configuration ──────────────────────────────────────────────
const MANIFEST_URL = 'https://kndyu62zzumvdajy.public.blob.vercel-storage.com/streaming/manifest.json';

const VAR_META = {
  'river_discharge_in_the_last_24_hours': { label: 'River Discharge (24h)', unit: 'm³/s', range: [0, 5000] },
  'soil_wetness_index':                  { label: 'Soil Wetness Index',     unit: '–',    range: [0, 1] },
  'runoff_water_equivalent':             { label: 'Runoff Water Equiv.',    unit: 'kg/m²', range: [0, 50] },
  '2m_temperature':                      { label: '2m Temperature',        unit: 'K',    range: [220, 320] },
  'total_precipitation':                 { label: 'Total Precipitation',   unit: 'm',    range: [0, 0.05] },
  'surface_runoff':                      { label: 'Surface Runoff',        unit: 'm',    range: [0, 0.01] },
  'sub_surface_runoff':                  { label: 'Sub-surface Runoff',    unit: 'm',    range: [0, 0.005] },
  'volumetric_soil_water_layer_1':       { label: 'Soil Water Layer 1',    unit: 'm³/m³', range: [0, 0.5] },
  'potential_evaporation':               { label: 'Potential Evaporation', unit: 'm',    range: [-0.01, 0] },
  'evaporation':                         { label: 'Evaporation',           unit: 'm',    range: [-0.01, 0] },
  'soil_temperature_level_1':            { label: 'Soil Temperature L1',   unit: 'K',    range: [240, 320] },
  'surface_pressure':                    { label: 'Surface Pressure',      unit: 'Pa',   range: [50000, 105000] },
  '10m_u_component_of_wind':             { label: '10m U-Wind',            unit: 'm/s',  range: [-20, 20] },
  '10m_v_component_of_wind':             { label: '10m V-Wind',            unit: 'm/s',  range: [-20, 20] },
};

const TURBO_SRGB = [
  [0.19,0.07,0.23],[0.23,0.17,0.52],[0.25,0.29,0.76],[0.20,0.44,0.90],
  [0.11,0.57,0.94],[0.06,0.68,0.88],[0.14,0.78,0.71],[0.31,0.85,0.50],
  [0.52,0.89,0.31],[0.72,0.88,0.17],[0.88,0.82,0.13],[0.97,0.70,0.12],
  [0.99,0.55,0.11],[0.95,0.39,0.10],[0.86,0.24,0.10],[0.70,0.12,0.09],
];

function turboColor(t) {
  t = Math.max(0, Math.min(1, t));
  const idx = t * (TURBO_SRGB.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.min(lo + 1, TURBO_SRGB.length - 1);
  const f = idx - lo;
  return [
    TURBO_SRGB[lo][0] + (TURBO_SRGB[hi][0] - TURBO_SRGB[lo][0]) * f,
    TURBO_SRGB[lo][1] + (TURBO_SRGB[hi][1] - TURBO_SRGB[lo][1]) * f,
    TURBO_SRGB[lo][2] + (TURBO_SRGB[hi][2] - TURBO_SRGB[lo][2]) * f,
  ];
}

let map, overlayLayer;
let manifest = null;
let currentVariable = null;
let dates = [];
let currentDateIdx = 0;
let isPlaying = false;
let playInterval = null;
let gridCache = {};

const varSelect   = document.getElementById('variable-select');
const dateSlider  = document.getElementById('date-slider');
const dateLabel   = document.getElementById('date-label');
const playBtn     = document.getElementById('play-btn');
const playStatus  = document.getElementById('playback-status');
const legendMin   = document.getElementById('legend-min');
const legendMax   = document.getElementById('legend-max');
const legendUnit  = document.getElementById('legend-unit');
const infoText    = document.getElementById('info-text');
const loadingEl   = document.getElementById('loading-overlay');

function initMap() {
  map = L.map('map', {
    center: [0, 0],
    zoom: 2,
    worldCopyJump: true,
    minZoom: 2,
    maxBounds: [[-90, -180], [90, 180]]
  });

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors',
    noWrap: false
  }).addTo(map);

  setupUI();
  loadData();
}

async function loadData() {
  try {
    const resp = await fetch(MANIFEST_URL);
    if (!resp.ok) throw new Error(`Manifest failed: ${resp.status}`);
    manifest = await resp.json();
    populateUI();
    await loadCurrentGrid();
  } catch (err) {
    console.warn('Manifest not found, creating Demo Data...', err);
    useDemoData();
  }
  loadingEl.classList.add('hidden');
}

async function loadGridForVariableDate(variable, dateStr) {
  const cacheKey = `${variable}__${dateStr}`;
  if (gridCache[cacheKey]) return gridCache[cacheKey];

  if (!manifest) return null;
  const entry = manifest.variables?.find(v => v.name === variable);
  if (!entry) return null;
  const dateEntry = entry.dates?.find(d => d.date === dateStr);
  if (!dateEntry) return null;

  try {
    const resp = await fetch(dateEntry.url);
    if (!resp.ok) return null;
    const grid = await resp.json();
    gridCache[cacheKey] = grid;
    return grid;
  } catch { return null; }
}

async function loadCurrentGrid() {
  if (!currentVariable || dates.length === 0) return;
  const dateStr = dates[currentDateIdx];

  let grid = gridCache[`${currentVariable}__${dateStr}`];
  if (!grid) {
    grid = await loadGridForVariableDate(currentVariable, dateStr);
  }

  if (grid) {
    paintDataLayer(grid);
    updateLegend(grid);
    updateInfoBadge(currentVariable, dateStr);
  }
}

// ── Demo Data Fallback ────────────────────────────────
const DEMO_VARS = [
  { key: '2m_temperature', label: '2m Temperature (Demo)', min: 220, max: 320, gen: (lat, lon, day) => 288 - Math.abs(lat)*1.1 + Math.sin(lon*0.08)*5 + Math.cos(lat*0.12+lon*0.05+day*0.3)*4 },
  { key: 'river_discharge_in_the_last_24_hours', label: 'River Discharge (Demo)', min: 0, max: 5000, gen: (lat, lon, day) => Math.max(0, 1200 - Math.abs(lat)*25 + Math.sin(lon*0.06+day*0.5)*800 + Math.cos(lat*0.1)*500) },
  { key: 'total_precipitation', label: 'Total Precipitation (Demo)', min: 0, max: 0.05, gen: (lat, lon, day) => Math.max(0, 0.02 - Math.abs(lat)*0.0003 + Math.sin(lon*0.09+day*0.4)*0.012 + Math.cos(lat*0.15+day*0.2)*0.008) },
];

function buildDemoDates() {
  const out = [];
  const now = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now); d.setDate(d.getDate() - i - 2);
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

function generateDemoGrid(varDef, dateStr) {
  const w = 360, h = 181;
  const dayIdx = parseInt(dateStr.slice(-2), 10) || 0;
  const values = new Array(h * w);
  for (let r = 0; r < h; r++) {
    const lat = 90 - r;
    for (let c = 0; c < w; c++) {
      let lon = -180 + c;
      if (lon >= 180) lon -= 360;
      values[r * w + c] = varDef.gen(lat, lon, dayIdx);
    }
  }
  return {
    variable: varDef.key, date: dateStr,
    min: varDef.min, max: varDef.max, shape: [h, w],
    grid: { lat_min: -90, lat_max: 90, lon_min: -180, lon_max: 180, resolution: 1.0 },
    values,
  };
}

function useDemoData() {
  const demoDates = buildDemoDates();
  manifest = { variables: [] };
  DEMO_VARS.forEach(vd => {
    const datEntries = demoDates.map(d => ({ date: d, url: '' }));
    manifest.variables.push({ name: vd.key, dates: datEntries });
    demoDates.forEach(d => { gridCache[`${vd.key}__${d}`] = generateDemoGrid(vd, d); });
  });

  varSelect.innerHTML = '';
  DEMO_VARS.forEach(vd => {
    const opt = document.createElement('option');
    opt.value = vd.key; opt.textContent = vd.label;
    varSelect.appendChild(opt);
  });

  currentVariable = DEMO_VARS[0].key;
  dates = demoDates;
  currentDateIdx = dates.length - 1;
  dateSlider.max = dates.length - 1;
  dateSlider.value = currentDateIdx;
  
  loadCurrentGrid();
}

function paintDataLayer(grid) {
  const { values, shape, min, max } = grid;
  const [rows, cols] = shape;
  const range = max - min || 1;

  const canvas = document.createElement('canvas');
  canvas.width = cols; canvas.height = rows;
  const ctx = canvas.getContext('2d');
  const imgData = ctx.createImageData(cols, rows);
  const px = imgData.data;

  // Process data, correcting for longitude 0 to 360 if necessary
  const is0to360 = (grid.grid.lon_max > 180);
  
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      // If data is [0, 360], shift columns so data matches [-180, 180] bounds mapping
      const targetC = is0to360 ? ((c + Math.floor(cols / 2)) % cols) : c;
      const val = values[r * cols + c];
      const idx = (r * cols + targetC) * 4;
      if (val === null || val === undefined || Number.isNaN(val) || val <= min) {
         px[idx+3] = 0; // transparent
         continue;
      }
      
      const t = Math.max(0, Math.min(1, (val - min) / range));
      const [cr, cg, cb] = turboColor(t);
      px[idx] = Math.round(cr * 255);
      px[idx + 1] = Math.round(cg * 255);
      px[idx + 2] = Math.round(cb * 255);
      px[idx + 3] = 160; // 60% opacity
    }
  }

  ctx.putImageData(imgData, 0, 0);

  // Notice bounds: lat limits changed to [-85.0511, 85.0511] to match Web Mercator 
  const lat_min = grid.grid.lat_min ?? -90;
  const lat_max = grid.grid.lat_max ?? 90;
  // Always bound overlay at [-180, 180] standard OSM bounds now that px cols are wrapped
  const bounds = [[Math.max(-85.0511, lat_min), -180], [Math.min(85.0511, lat_max), 180]];
  
  if (overlayLayer) {
    overlayLayer.setBounds(bounds);
    overlayLayer.setUrl(canvas.toDataURL());
  } else {
    overlayLayer = L.imageOverlay(canvas.toDataURL(), bounds).addTo(map);
  }
}

function populateUI() {
  varSelect.innerHTML = '';
  manifest.variables.forEach(v => {
    const meta = VAR_META[v.name] || { label: v.name };
    const opt = document.createElement('option');
    opt.value = v.name; opt.textContent = meta.label;
    varSelect.appendChild(opt);
  });
  if (manifest.variables.length > 0) {
    currentVariable = manifest.variables[0].name;
    dates = manifest.variables[0].dates.map(d => d.date);
    currentDateIdx = dates.length - 1;
    dateSlider.max = dates.length - 1;
    dateSlider.value = currentDateIdx;
  }
}

function setupUI() {
  varSelect.addEventListener('change', async (e) => {
    currentVariable = e.target.value;
    const vDef = manifest?.variables?.find(v => v.name === currentVariable);
    if (vDef) {
       dates = vDef.dates.map(d => d.date);
       currentDateIdx = dates.length - 1;
       dateSlider.max = dates.length - 1;
       dateSlider.value = currentDateIdx;
    }
    await loadCurrentGrid();
  });

  dateSlider.addEventListener('input', async () => {
    currentDateIdx = parseInt(dateSlider.value);
    await loadCurrentGrid();
  });

  playBtn.addEventListener('click', togglePlayback);
}

function togglePlayback() {
  isPlaying = !isPlaying;
  const icon = playBtn.querySelector('i');
  if (isPlaying) {
    icon.className = 'bi bi-pause-fill';
    playStatus.textContent = 'Playing';
    playInterval = setInterval(async () => {
      currentDateIdx = (currentDateIdx + 1) % dates.length;
      dateSlider.value = currentDateIdx;
      await loadCurrentGrid();
    }, 1500);
  } else {
    icon.className = 'bi bi-play-fill';
    playStatus.textContent = '';
    clearInterval(playInterval);
  }
}

function updateLegend(grid) {
  const meta = VAR_META[grid.variable] || {};
  const lo = grid.min ?? meta.range?.[0] ?? 0;
  const hi = grid.max ?? meta.range?.[1] ?? 100;
  legendMin.textContent = (hi > 1000) ? lo.toFixed(0) : lo.toPrecision(3);
  legendMax.textContent = (hi > 1000) ? hi.toFixed(0) : hi.toPrecision(3);
  if (legendUnit) legendUnit.textContent = meta.unit || '';
}

function updateInfoBadge(variable, dateStr) {
  const meta = VAR_META[variable] || { label: variable };
  infoText.textContent = `${meta.label}  ·  ${dateStr}`;
  dateLabel.textContent = dateStr;
}

initMap();