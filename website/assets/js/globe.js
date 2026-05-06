import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

/* ================================================================
   spatioClimata — 3D Interactive Globe
   Renders climate data as a heatmap texture on a Three.js globe.
   Data is loaded from Vercel Blob (manifest + per-variable JSON grids).
   ================================================================ */

// ── Configuration ──────────────────────────────────────────────
const EARTH_RADIUS = 1;
const DATA_RADIUS = 1.004;
const STAR_COUNT = 2800;
const DATA_CANVAS_W = 720;
const DATA_CANVAS_H = 361;

// Vercel Blob manifest URL — updated by the ingest pipeline
const MANIFEST_URL = 'https://kndyu62zzumvdajy.public.blob.vercel-storage.com/streaming/manifest.json';

// ── Variable Metadata ──────────────────────────────────────────
const VAR_META = {
  'river_discharge_in_the_last_24_hours': { label: 'River Discharge (24h)', unit: 'm³/s', range: [0, 5000] },
  'soil_wetness_index_root_zone':        { label: 'Soil Wetness Index',     unit: '–',    range: [0, 1] },
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

// ── Turbo Colormap (Google) ────────────────────────────────────
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

// ── Three.js Globals ───────────────────────────────────────────
let scene, camera, renderer, controls;
let earthMesh, dataOverlayMesh;
let dataCanvas, dataCtx, dataTexture;

// ── State ──────────────────────────────────────────────────────
let manifest = null;
let currentVariable = null;
let dates = [];
let currentDateIdx = 0;
let isPlaying = false;
let playInterval = null;
let gridCache = {};

// ── DOM refs ───────────────────────────────────────────────────
const container   = document.getElementById('globe-container');
const canvas      = document.getElementById('globe-canvas');
const varSelect   = document.getElementById('variable-select');
const dateSlider  = document.getElementById('date-slider');
const dateLabel   = document.getElementById('date-label');
const playBtn     = document.getElementById('play-btn');
const playStatus  = document.getElementById('playback-status');
const legendMin   = document.getElementById('legend-min');
const legendMax   = document.getElementById('legend-max');
const legendUnit  = document.getElementById('legend-unit');
const gradientBar = document.querySelector('.gradient-bar');
const infoText    = document.getElementById('info-text');
const loadingEl   = document.getElementById('loading-overlay');

// ================================================================
//  INIT
// ================================================================
function init() {
  // Renderer
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;

  // Scene
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x030614);

  // Camera
  camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 100);
  camera.position.set(0, 0.4, 2.8);

  // Controls
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.minDistance = 1.25;
  controls.maxDistance = 6;
  controls.autoRotate = true;
  controls.autoRotateSpeed = 0.25;
  controls.enablePan = false;

  // Lights — uniform illumination so all sides of the globe are visible
  scene.add(new THREE.AmbientLight(0xffffff, 4));
  scene.add(new THREE.HemisphereLight(0xccddff, 0x444466, 2));

  createStarField();
  createEarth();
  createAtmosphere();
  createDataOverlay();

  window.addEventListener('resize', onResize);
  setupUI();
  animate();
  loadData();
}

// ================================================================
//  SCENE OBJECTS
// ================================================================
function createStarField() {
  const positions = new Float32Array(STAR_COUNT * 3);
  const sizes = new Float32Array(STAR_COUNT);
  for (let i = 0; i < STAR_COUNT; i++) {
    const r = 15 + Math.random() * 35;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    positions[i * 3]     = r * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    positions[i * 3 + 2] = r * Math.cos(phi);
    sizes[i] = 0.3 + Math.random() * 1.2;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
  const mat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.04, sizeAttenuation: true, transparent: true, opacity: 0.85 });
  scene.add(new THREE.Points(geo, mat));
}

function createEarth() {
  const geo = new THREE.SphereGeometry(EARTH_RADIUS, 72, 72);
  const loader = new THREE.TextureLoader();
  const tex = loader.load('https://unpkg.com/three-globe/example/img/earth-night.jpg');
  tex.colorSpace = THREE.SRGBColorSpace;
  // MeshBasicMaterial renders uniformly bright — no dark hemisphere
  const mat = new THREE.MeshBasicMaterial({ map: tex });
  earthMesh = new THREE.Mesh(geo, mat);
  scene.add(earthMesh);
}

function createAtmosphere() {
  const vertSrc = `
    varying vec3 vNormal;
    varying vec3 vPosition;
    void main(){
      vNormal = normalize(normalMatrix * normal);
      vPosition = (modelViewMatrix * vec4(position,1.0)).xyz;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
    }`;
  const fragSrc = `
    varying vec3 vNormal;
    varying vec3 vPosition;
    void main(){
      vec3 viewDir = normalize(-vPosition);
      float rim = 1.0 - max(dot(viewDir, vNormal), 0.0);
      rim = pow(rim, 3.0) * 1.4;
      gl_FragColor = vec4(0.35, 0.65, 1.0, rim * 0.55);
    }`;
  const geo = new THREE.SphereGeometry(EARTH_RADIUS * 1.025, 64, 64);
  const mat = new THREE.ShaderMaterial({
    vertexShader: vertSrc, fragmentShader: fragSrc,
    side: THREE.BackSide, transparent: true, depthWrite: false,
  });
  scene.add(new THREE.Mesh(geo, mat));
}

function createDataOverlay() {
  dataCanvas = document.createElement('canvas');
  dataCanvas.width = DATA_CANVAS_W;
  dataCanvas.height = DATA_CANVAS_H;
  dataCtx = dataCanvas.getContext('2d');

  dataTexture = new THREE.CanvasTexture(dataCanvas);
  dataTexture.minFilter = THREE.LinearFilter;
  dataTexture.magFilter = THREE.LinearFilter;

  const geo = new THREE.SphereGeometry(DATA_RADIUS, 72, 72);
  const mat = new THREE.MeshBasicMaterial({
    map: dataTexture, transparent: true, opacity: 0.72,
    side: THREE.FrontSide, depthWrite: false, blending: THREE.NormalBlending,
  });
  dataOverlayMesh = new THREE.Mesh(geo, mat);
  scene.add(dataOverlayMesh);
}

// ================================================================
//  DATA LOADING
// ================================================================
async function loadData() {
  try {
    const resp = await fetch(MANIFEST_URL);
    if (!resp.ok) throw new Error(`Manifest fetch failed: ${resp.status}`);
    manifest = await resp.json();
    populateUI();
    await loadCurrentGrid();
  } catch (err) {
    console.warn('Manifest not available, using demo data:', err.message);
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

  // Check cache first (covers demo mode and previously loaded grids)
  const cacheKey = `${currentVariable}__${dateStr}`;
  let grid = gridCache[cacheKey];

  // If not cached, try fetching from Blob
  if (!grid) {
    grid = await loadGridForVariableDate(currentVariable, dateStr);
  }

  if (grid) {
    paintDataTexture(grid);
    updateLegend(grid);
    updateInfoBadge(currentVariable, dateStr);
  }
}

// ── Demo Data ──────────────────────────────────────────────────
const DEMO_VARS = [
  { key: '2m_temperature',                      label: '2m Temperature (Demo)',      min: 220, max: 320, gen: (lat, lon, day) => 288 - Math.abs(lat)*1.1 + Math.sin(lon*0.08)*5 + Math.cos(lat*0.12+lon*0.05+day*0.3)*4 },
  { key: 'river_discharge_in_the_last_24_hours', label: 'River Discharge (Demo)',     min: 0,   max: 5000, gen: (lat, lon, day) => Math.max(0, 1200 - Math.abs(lat)*25 + Math.sin(lon*0.06+day*0.5)*800 + Math.cos(lat*0.1)*500) },
  { key: 'total_precipitation',                  label: 'Total Precipitation (Demo)', min: 0,   max: 0.05, gen: (lat, lon, day) => Math.max(0, 0.02 - Math.abs(lat)*0.0003 + Math.sin(lon*0.09+day*0.4)*0.012 + Math.cos(lat*0.15+day*0.2)*0.008) },
];

function buildDemoDates() {
  const out = [];
  const now = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i - 2);
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
      const lon = -180 + c;
      values[r * w + c] = varDef.gen(lat, lon, dayIdx);
    }
  }
  return {
    variable: varDef.key, date: dateStr,
    min: varDef.min, max: varDef.max, shape: [h, w],
    grid: { lat_min: -90, lat_max: 90, lon_min: -180, lon_max: 179, resolution: 1.0 },
    values,
  };
}

function useDemoData() {
  const demoDates = buildDemoDates();

  // Build a fake manifest so loadCurrentGrid works via cache
  manifest = { variables: [] };
  DEMO_VARS.forEach(vd => {
    const datEntries = demoDates.map(d => ({ date: d, url: '' }));
    manifest.variables.push({ name: vd.key, dates: datEntries });
    // Pre-cache all grids
    demoDates.forEach(d => {
      gridCache[`${vd.key}__${d}`] = generateDemoGrid(vd, d);
    });
  });

  // Populate variable selector
  varSelect.innerHTML = '';
  DEMO_VARS.forEach(vd => {
    const opt = document.createElement('option');
    opt.value = vd.key;
    opt.textContent = vd.label;
    varSelect.appendChild(opt);
  });

  currentVariable = DEMO_VARS[0].key;
  varSelect.value = currentVariable;
  dates = demoDates;
  currentDateIdx = dates.length - 1;

  dateSlider.min = 0;
  dateSlider.max = dates.length - 1;
  dateSlider.value = currentDateIdx;
  dateLabel.textContent = dates[currentDateIdx];

  const grid = gridCache[`${currentVariable}__${dates[currentDateIdx]}`];
  paintDataTexture(grid);
  updateLegend(grid);
  updateInfoBadge(currentVariable, dates[currentDateIdx]);
}

// ================================================================
//  DATA → TEXTURE
// ================================================================
function paintDataTexture(grid) {
  const { values, shape, min, max } = grid;
  const [rows, cols] = shape;
  const range = max - min || 1;

  // Scale canvas to data dimensions
  dataCanvas.width = cols * 2;
  dataCanvas.height = rows * 2;
  const imgData = dataCtx.createImageData(cols * 2, rows * 2);
  const px = imgData.data;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const val = values[r * cols + c];
      const isNaN = val === null || val === undefined || Number.isNaN(val);

      let R = 0, G = 0, B = 0, A = 0;
      if (!isNaN) {
        const t = Math.max(0, Math.min(1, (val - min) / range));
        const [cr, cg, cb] = turboColor(t);
        R = Math.round(cr * 255);
        G = Math.round(cg * 255);
        B = Math.round(cb * 255);
        A = 200;
      }

      // 2x upscale for smoothness
      for (let dr = 0; dr < 2; dr++) {
        for (let dc = 0; dc < 2; dc++) {
          const pr = r * 2 + dr;
          const pc = c * 2 + dc;
          const idx = (pr * cols * 2 + pc) * 4;
          px[idx] = R; px[idx + 1] = G; px[idx + 2] = B; px[idx + 3] = A;
        }
      }
    }
  }

  dataCtx.putImageData(imgData, 0, 0);
  dataTexture.needsUpdate = true;
}

// ================================================================
//  UI
// ================================================================
function populateUI() {
  if (!manifest || !manifest.variables) return;

  varSelect.innerHTML = '';
  manifest.variables.forEach(v => {
    const meta = VAR_META[v.name] || { label: v.name };
    const opt = document.createElement('option');
    opt.value = v.name;
    opt.textContent = meta.label;
    varSelect.appendChild(opt);
  });

  currentVariable = manifest.variables[0]?.name;
  varSelect.value = currentVariable;

  rebuildDateSlider();
}

function rebuildDateSlider() {
  if (!manifest || !currentVariable) return;
  const entry = manifest.variables.find(v => v.name === currentVariable);
  dates = entry?.dates?.map(d => d.date).sort() || [];
  currentDateIdx = Math.max(0, dates.length - 1);
  dateSlider.min = 0;
  dateSlider.max = Math.max(0, dates.length - 1);
  dateSlider.value = currentDateIdx;
  dateLabel.textContent = dates[currentDateIdx] || '—';
}

function setupUI() {
  varSelect.addEventListener('change', async () => {
    currentVariable = varSelect.value;
    rebuildDateSlider();
    await loadCurrentGrid();
  });

  dateSlider.addEventListener('input', async () => {
    currentDateIdx = parseInt(dateSlider.value);
    dateLabel.textContent = dates[currentDateIdx] || '—';
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
      dateLabel.textContent = dates[currentDateIdx] || '—';
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
  legendMin.textContent = formatValue(lo);
  legendMax.textContent = formatValue(hi);
  if (legendUnit) legendUnit.textContent = meta.unit || '';
}

function updateInfoBadge(variable, dateStr) {
  const meta = VAR_META[variable] || { label: variable };
  const dateDisplay = dateStr === 'demo' ? 'Demo Data' : dateStr;
  infoText.textContent = `${meta.label}  ·  ${dateDisplay}`;
}

function formatValue(v) {
  if (Math.abs(v) >= 1000) return v.toFixed(0);
  if (Math.abs(v) >= 1) return v.toFixed(1);
  return v.toPrecision(3);
}

// ================================================================
//  ANIMATION LOOP
// ================================================================
function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}

function onResize() {
  camera.aspect = container.clientWidth / container.clientHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(container.clientWidth, container.clientHeight);
}

// ── Start ──────────────────────────────────────────────────────
init();
