/* ================================================================
   spatioClimata — 2D Interactive Map (Leaflet / OpenStreetMap)
   ================================================================ */

// ── Configuration ──────────────────────────────────────────────
const MANIFEST_URL = '../data/manifest.json';

const VAR_META = {
  // ── ERA5 Variables (Climate Reanalysis) ────────────────────────────
  '2m_temperature': { 
    label: '2m Temperature', 
    unit: 'K', 
    range: [220, 320],
    dataset: 'reanalysis-era5-single-levels'
  },
  'total_precipitation': { 
    label: 'Total Precipitation', 
    unit: 'm', 
    range: [0, 0.05],
    dataset: 'reanalysis-era5-single-levels'
  },
  '10m_u_component_of_wind': { 
    label: '10m U-Wind', 
    unit: 'm/s', 
    range: [-20, 20],
    dataset: 'reanalysis-era5-single-levels'
  },
  '10m_v_component_of_wind': { 
    label: '10m V-Wind', 
    unit: 'm/s', 
    range: [-20, 20],
    dataset: 'reanalysis-era5-single-levels'
  },
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
let windEnabled = false;
let windCanvas = null;
let windCtx = null;
let windUGrid = null;
let windVGrid = null;
let rainEnabled = false;
let rainCanvas = null;
let rainCtx = null;
let rainGrid = null;

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

  // Use a reliable high-contrast basemap. Stamen has been returning 503s in this environment,
  // so fall back to Carto + OpenStreetMap when tiles fail.
  const basemaps = [
    {
      url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
      attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
    },
    {
      url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      attribution: '&copy; OpenStreetMap contributors',
    },
  ];

  let activeBaseLayer = null;
  const addBasemap = (index) => {
    const source = basemaps[index];
    if (!source) return;
    const layer = L.tileLayer(source.url, {
      attribution: source.attribution,
      noWrap: false,
      updateWhenIdle: true,
    });
    layer.on('tileerror', () => {
      if (activeBaseLayer === layer && index + 1 < basemaps.length) {
        map.removeLayer(layer);
        addBasemap(index + 1);
      }
    });
    activeBaseLayer = layer;
    layer.addTo(map);
  };

  addBasemap(0);

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
    console.warn('Live manifest not found, creating sample data...', err);
    useDemoData();
    infoText.textContent = 'Live manifest unavailable - showing sample data';
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
    if (windEnabled) {
      await loadWindForCurrentDate();
    }
    if (rainEnabled) {
      await loadRainForCurrentDate();
    }
  }
}

// ── Demo Data Fallback ────────────────────────────────
const DEMO_VARS = [
  { key: '2m_temperature', label: '2m Temperature', min: 220, max: 320, gen: (lat, lon, day) => 288 - Math.abs(lat)*1.1 + Math.sin(lon*0.08)*5 + Math.cos(lat*0.12+lon*0.05+day*0.3)*4 },
  { key: 'total_precipitation', label: 'Total Precipitation', min: 0, max: 0.05, gen: (lat, lon, day) => Math.max(0, 0.02 - Math.abs(lat)*0.0003 + Math.sin(lon*0.09+day*0.4)*0.012 + Math.cos(lat*0.15+day*0.2)*0.008) },
  { key: '10m_u_component_of_wind', label: '10m U-Wind', min: -20, max: 20, gen: (lat, lon, day) => Math.sin(lat*0.08+day*0.2)*4 + Math.cos(lon*0.06+day*0.3)*3 },
  { key: '10m_v_component_of_wind', label: '10m V-Wind', min: -20, max: 20, gen: (lat, lon, day) => Math.cos(lat*0.06+day*0.3)*4 - Math.sin(lon*0.04+day*0.15)*2 },
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

  const windCheckbox = document.getElementById('wind-checkbox');
  if (windCheckbox) {
    windCheckbox.addEventListener('change', async (e) => {
      windEnabled = e.target.checked;
      if (windEnabled) {
        await initWindLayer();
        await loadWindForCurrentDate();
      } else {
        removeWindLayer();
      }
    });
  }

  const rainCheckbox = document.getElementById('rain-checkbox');
  if (rainCheckbox) {
    rainCheckbox.addEventListener('change', async (e) => {
      rainEnabled = e.target.checked;
      if (rainEnabled) {
        await initRainLayer();
        await loadRainForCurrentDate();
      } else {
        removeRainLayer();
      }
    });
  }


async function initWindLayer() {
  if (!map) return;
  if (windCanvas) return; // already created
  const mapPane = map.getPanes().overlayPane;
  windCanvas = document.createElement('canvas');
  windCanvas.style.position = 'absolute';
  windCanvas.style.top = '0';
  windCanvas.style.left = '0';
  windCanvas.width = map.getSize().x;
  windCanvas.height = map.getSize().y;
  windCanvas.style.pointerEvents = 'none';
  mapPane.appendChild(windCanvas);
  windCtx = windCanvas.getContext('2d');

  map.on('move resize zoom', () => {
    if (windCanvas) {
      windCanvas.width = map.getSize().x;
      windCanvas.height = map.getSize().y;
      // clear to avoid stale artifacts
      if (windCtx) windCtx.clearRect(0, 0, windCanvas.width, windCanvas.height);
    }
  });

  // seed particles and start animation
  seedParticles();
  startParticleAnimation();
}

function removeWindLayer() {
  if (!windCanvas) return;
  stopParticleAnimation();
  windCanvas.remove();
  windCanvas = null;
  windCtx = null;
  windUGrid = null;
  windVGrid = null;
  particles = [];
}

async function loadRainForCurrentDate() {
  if (!manifest || !map) return;
  const dateStr = dates[currentDateIdx];
  const precipGrid = await loadGridForVariableDate('total_precipitation', dateStr);
  if (precipGrid) {
    rainGrid = precipGrid;
    seedRainParticles();
  }
}

async function initRainLayer() {
  if (!map) return;
  if (rainCanvas) return;
  const mapPane = map.getPanes().overlayPane;
  rainCanvas = document.createElement('canvas');
  rainCanvas.style.position = 'absolute';
  rainCanvas.style.top = '0';
  rainCanvas.style.left = '0';
  rainCanvas.width = map.getSize().x;
  rainCanvas.height = map.getSize().y;
  rainCanvas.style.pointerEvents = 'none';
  mapPane.appendChild(rainCanvas);
  rainCtx = rainCanvas.getContext('2d');

  map.on('move resize zoom', () => {
    if (rainCanvas) {
      rainCanvas.width = map.getSize().x;
      rainCanvas.height = map.getSize().y;
      if (rainCtx) rainCtx.clearRect(0, 0, rainCanvas.width, rainCanvas.height);
    }
  });

  seedRainParticles();
  startRainAnimation();
}

function removeRainLayer() {
  if (!rainCanvas) return;
  stopRainAnimation();
  rainCanvas.remove();
  rainCanvas = null;
  rainCtx = null;
  rainGrid = null;
  rainParticles = [];
}

// Rain / monsoon particles use precipitation intensity and optional wind drift.
let rainParticles = [];
let rainAnimId = null;
const RAIN_COUNT = 900;

function seedRainParticles() {
  if (!rainCanvas) return;
  rainParticles = [];
  const w = rainCanvas.width;
  const h = rainCanvas.height;
  for (let i = 0; i < RAIN_COUNT; i++) {
    rainParticles.push({ x: Math.random() * w, y: Math.random() * h, age: Math.random() * 100 });
  }
}

function startRainAnimation() {
  if (rainAnimId) return;
  function frame() {
    rainTick();
    rainAnimId = requestAnimationFrame(frame);
  }
  rainAnimId = requestAnimationFrame(frame);
}

function stopRainAnimation() {
  if (rainAnimId) cancelAnimationFrame(rainAnimId);
  rainAnimId = null;
}

function rainTick() {
  if (!rainCtx || !rainCanvas || !rainGrid) return;
  const ctx = rainCtx;
  const w = rainCanvas.width;
  const h = rainCanvas.height;
  ctx.fillStyle = 'rgba(0,0,0,0.12)';
  ctx.fillRect(0, 0, w, h);

  const rows = rainGrid.shape[0];
  const cols = rainGrid.shape[1];
  const latMin = rainGrid.grid.lat_min;
  const latMax = rainGrid.grid.lat_max;
  const lonMin = rainGrid.grid.lon_min;
  const lonMax = rainGrid.grid.lon_max;

  function sample(gridObj, lat, lon) {
    const fx = ((lon - lonMin) / (lonMax - lonMin)) * (cols - 1);
    const fy = ((latMax - lat) / (latMax - latMin)) * (rows - 1);
    if (!isFinite(fx) || !isFinite(fy)) return 0;
    const ix = Math.floor(fx);
    const iy = Math.floor(fy);
    const dx = fx - ix;
    const dy = fy - iy;
    const ix0 = Math.max(0, Math.min(cols - 1, ix));
    const iy0 = Math.max(0, Math.min(rows - 1, iy));
    const ix1 = Math.max(0, Math.min(cols - 1, ix + 1));
    const iy1 = Math.max(0, Math.min(rows - 1, iy + 1));
    const v00 = gridObj.values[iy0 * cols + ix0] ?? 0;
    const v10 = gridObj.values[iy0 * cols + ix1] ?? 0;
    const v01 = gridObj.values[iy1 * cols + ix0] ?? 0;
    const v11 = gridObj.values[iy1 * cols + ix1] ?? 0;
    const top = v00 * (1 - dx) + v10 * dx;
    const bot = v01 * (1 - dx) + v11 * dx;
    return top * (1 - dy) + bot * dy;
  }

  for (let i = 0; i < rainParticles.length; i++) {
    const p = rainParticles[i];
    const latlng = map.containerPointToLatLng([p.x, p.y]);
    const lat = latlng.lat;
    const lon = latlng.lng;
    const intensity = Math.max(0, sample(rainGrid, lat, lon));
    const windU = windUGrid ? sample(windUGrid, lat, lon) : 0;
    const windV = windVGrid ? sample(windVGrid, lat, lon) : 0;

    const speed = 1.8 + intensity * 180;
    const dx = windU * 0.25;
    const dy = speed + (-windV * 0.08);

    const newX = (p.x + dx + w) % w;
    const newY = p.y + dy;

    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(newX, newY);
    ctx.strokeStyle = `rgba(120, 200, 255, ${Math.min(0.95, 0.18 + intensity * 25)})`;
    ctx.lineWidth = 1;
    ctx.lineCap = 'round';
    ctx.stroke();

    p.x = newX;
    p.y = newY;
    p.age += 1;
    if (p.y > h || p.age > 400) {
      p.x = Math.random() * w;
      p.y = -10;
      p.age = 0;
    }
  }
}

async function loadWindForCurrentDate() {
  if (!manifest || !map) return;
  const dateStr = dates[currentDateIdx];
  const uGrid = await loadGridForVariableDate('10m_u_component_of_wind', dateStr);
  const vGrid = await loadGridForVariableDate('10m_v_component_of_wind', dateStr);
  if (uGrid && vGrid) {
    windUGrid = uGrid;
    windVGrid = vGrid;
    updateWindLegend(uGrid, vGrid);
    // reseed particles so they sample latest wind
    seedParticles();
  }
}

function updateWindLegend(uGrid, vGrid) {
  if (!uGrid || !vGrid) return;
  try {
    const rows = uGrid.shape[0];
    const cols = uGrid.shape[1];
    let minMag = Infinity, maxMag = -Infinity;
    for (let i = 0; i < rows * cols; i++) {
      const u = uGrid.values[i];
      const v = vGrid.values[i];
      if (u === null || v === null) continue;
      const m = Math.sqrt(u*u + v*v);
      if (m < minMag) minMag = m;
      if (m > maxMag) maxMag = m;
    }
    if (!isFinite(minMag)) { minMag = 0; maxMag = 0; }
    legendUnit.textContent = 'm/s';
    legendMin.textContent = (maxMag > 1000) ? minMag.toFixed(0) : minMag.toPrecision(3);
    legendMax.textContent = (maxMag > 1000) ? maxMag.toFixed(0) : maxMag.toPrecision(3);
  } catch (err) {
    console.warn('wind legend error', err);
  }
}

// Particle system for animated wind visualization
let particles = [];
let particleAnimId = null;
const PARTICLE_COUNT = 1200;    // Denser coverage for better wind field visibility
const PARTICLE_FADE = 0.86;     // Slightly shorter trails for snappier response

function seedParticles() {
  if (!windCanvas) return;
  particles = [];
  const w = windCanvas.width;
  const h = windCanvas.height;
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    particles.push({ x: Math.random() * w, y: Math.random() * h, age: Math.random() * 100 });
  }
}

function startParticleAnimation() {
  if (particleAnimId) return;
  function frame() {
    particleTick();
    particleAnimId = requestAnimationFrame(frame);
  }
  particleAnimId = requestAnimationFrame(frame);
}

function stopParticleAnimation() {
  if (particleAnimId) cancelAnimationFrame(particleAnimId);
  particleAnimId = null;
}

function particleTick() {
  if (!windCtx || !windCanvas || !windUGrid || !windVGrid) return;
  const ctx = windCtx;
  const w = windCanvas.width;
  const h = windCanvas.height;
  // fade previous frame
  ctx.fillStyle = `rgba(0,0,0,${1 - PARTICLE_FADE})`;
  ctx.fillRect(0, 0, w, h);

  const rows = windUGrid.shape[0];
  const cols = windUGrid.shape[1];
  const latMin = windUGrid.grid.lat_min;
  const latMax = windUGrid.grid.lat_max;
  const lonMin = windUGrid.grid.lon_min;
  const lonMax = windUGrid.grid.lon_max;

  for (let i = 0; i < particles.length; i++) {
    const p = particles[i];
    // convert pixel to lat/lon and sample wind
    const latlng = map.containerPointToLatLng([p.x, p.y]);
    const lat = latlng.lat;
    const lon = latlng.lng;

    // bilinear interpolation sample for smoother motion
    function bilinearSample(gridObj, lat, lon) {
      const rows = gridObj.shape[0];
      const cols = gridObj.shape[1];
      const latMin = gridObj.grid.lat_min;
      const latMax = gridObj.grid.lat_max;
      const lonMin = gridObj.grid.lon_min;
      const lonMax = gridObj.grid.lon_max;
      // fractional indices
      const fx = ((lon - lonMin) / (lonMax - lonMin)) * (cols - 1);
      const fy = ((latMax - lat) / (latMax - latMin)) * (rows - 1);
      if (!isFinite(fx) || !isFinite(fy)) return 0;
      const ix = Math.floor(fx);
      const iy = Math.floor(fy);
      const dx = fx - ix;
      const dy = fy - iy;

      const ix0 = Math.max(0, Math.min(cols - 1, ix));
      const iy0 = Math.max(0, Math.min(rows - 1, iy));
      const ix1 = Math.max(0, Math.min(cols - 1, ix + 1));
      const iy1 = Math.max(0, Math.min(rows - 1, iy + 1));

      const v00 = gridObj.values[iy0 * cols + ix0];
      const v10 = gridObj.values[iy0 * cols + ix1];
      const v01 = gridObj.values[iy1 * cols + ix0];
      const v11 = gridObj.values[iy1 * cols + ix1];

      // Treat null/undefined as 0 for motion continuity
      const a = (v00 === null || v00 === undefined) ? 0 : v00;
      const b = (v10 === null || v10 === undefined) ? 0 : v10;
      const c = (v01 === null || v01 === undefined) ? 0 : v01;
      const d = (v11 === null || v11 === undefined) ? 0 : v11;

      const vTop = a * (1 - dx) + b * dx;
      const vBot = c * (1 - dx) + d * dx;
      return vTop * (1 - dy) + vBot * dy;
    }

    const u = bilinearSample(windUGrid, lat, lon) || 0;
    const v = bilinearSample(windVGrid, lat, lon) || 0;

    // convert to pixel displacement (empirical scaling)
    // Higher scale = faster, more visible wind motion; 0.6 provides good motion perception
    const scale = 0.6;
    const dx = u * scale;
    const dy = -v * scale;

    const newX = (p.x + dx + w) % w;
    const newY = (p.y + dy + h) % h;

    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(newX, newY);
    ctx.strokeStyle = 'rgba(200,230,255,0.95)';  // Slight blue tint for better contrast on basemap
    ctx.lineWidth = 1.2;  // Slightly thicker for visibility at all zoom levels
    ctx.lineCap = 'round';  // Smooth line caps for better aesthetics
    ctx.stroke();

    p.x = newX;
    p.y = newY;
    p.age += 1;
    if (p.age > 1000) {
      p.x = Math.random() * w;
      p.y = Math.random() * h;
      p.age = 0;
    }
  }
}
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