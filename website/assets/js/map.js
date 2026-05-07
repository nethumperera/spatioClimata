/**
 * spatioClimata — 2D Interactive Map with Live GloFAS Data
 * Renders hydrological data from Vercel Blob or local cache.
 */

// ── Configuration ──────────────────────────────────────────────
const MANIFEST_URL = '/api/manifest';
const VIRIDIS_COLORMAP = [
  '#440154', '#482475', '#3e4a89', '#31688e', '#26828e',
  '#35b779', '#6ece58', '#b5de2b', '#fde724'
];

// ── Global State ───────────────────────────────────────────────
let manifest = null;
let map = null;
let currentLayer = null;
let currentVariable = null;
let currentDate = null;
let dates = [];
let currentDateIdx = 0;
let isPlaying = false;
let playInterval = null;
let dataCache = {};

// ── DOM References ────────────────────────────────────────────
const varSelect = document.getElementById('variable-select');
const dateSlider = document.getElementById('date-slider');
const dateLabel = document.getElementById('date-label');
const playBtn = document.getElementById('play-btn');
const infoText = document.getElementById('info-text');
const loadingOverlay = document.getElementById('loading-overlay');
const varLabel = document.getElementById('var-label');
const varUnit = document.getElementById('var-unit');
const legendMin = document.getElementById('legend-min');
const legendMax = document.getElementById('legend-max');

// ── Init ───────────────────────────────────────────────────────
async function init() {
  showLoading();
  
  try {
    // Fetch manifest
    const response = await fetch(MANIFEST_URL);
    manifest = await response.json();
    console.log('Manifest loaded:', manifest);

    // Initialize map
    initMap();

    // Populate variables
    populateVariables();

    // Set first variable
    if (manifest.variables && manifest.variables.length > 0) {
      const firstVar = manifest.variables[0];
      varSelect.value = firstVar.name;
      await onVariableChange();
    }

    hideLoading();
    updateInfo('Ready');
  } catch (error) {
    console.error('Failed to load manifest:', error);
    updateInfo('Error loading data: ' + error.message);
    hideLoading();
  }
}

function initMap() {
  // Create Leaflet map centered on global view
  map = L.map('map').setView([20, 0], 3);

  // Add basemap tiles (OpenStreetMap)
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap contributors',
    opacity: 0.7,
  }).addTo(map);

  // Add dark background for better contrast with data
  const attribution = L.control.attribution();
  attribution.setPosition('bottomright');
}

function populateVariables() {
  if (!manifest.variables) return;

  varSelect.innerHTML = '';
  manifest.variables.forEach((varMeta) => {
    const option = document.createElement('option');
    option.value = varMeta.name;
    option.textContent = varMeta.label || varMeta.name;
    varSelect.appendChild(option);
  });
}

async function onVariableChange() {
  const varName = varSelect.value;
  const varMeta = manifest.variables.find((v) => v.name === varName);

  if (!varMeta) return;

  currentVariable = varMeta;
  currentDateIdx = 0;
  dates = varMeta.dates || [];

  // Update legend
  varLabel.textContent = varMeta.label || varName;
  varUnit.textContent = varMeta.unit || '';

  // Update date slider
  dateSlider.max = Math.max(0, dates.length - 1);
  dateSlider.value = 0;
  updateDateDisplay();

  // Load and render first date
  await renderDate(0);
}

async function renderDate(dateIdx) {
  if (dateIdx < 0 || dateIdx >= dates.length) return;

  currentDateIdx = dateIdx;
  const dateData = dates[dateIdx];
  const varName = currentVariable.name;
  const cacheKey = `${varName}__${dateData.date}`;

  updateDateDisplay();

  // Fetch data if not cached
  if (!dataCache[cacheKey]) {
    try {
      showLoading();
      const response = await fetch(dateData.url);
      const data = await response.json();
      dataCache[cacheKey] = data;
      console.log('Data loaded for', varName, dateData.date, data);
    } catch (error) {
      console.error('Failed to load data:', error);
      updateInfo('Error loading data for ' + dateData.date);
      hideLoading();
      return;
    }
  }

  const data = dataCache[cacheKey];

  // Remove old layer
  if (currentLayer) {
    map.removeLayer(currentLayer);
  }

  // Create raster layer from grid data
  try {
    currentLayer = createRasterLayer(data, currentVariable);
    map.addLayer(currentLayer);
    hideLoading();
    updateInfo('Displaying: ' + dateData.date);
  } catch (error) {
    console.error('Failed to render layer:', error);
    updateInfo('Error rendering layer: ' + error.message);
    hideLoading();
  }
}

function createRasterLayer(gridData, varMeta) {
  // gridData format: { variable, date, min, max, shape, grid, values }
  const { values, grid, min: dataMin, max: dataMax } = gridData;
  const [rows, cols] = gridData.shape;

  // Create canvas for raster
  const canvas = document.createElement('canvas');
  canvas.width = cols;
  canvas.height = rows;
  const ctx = canvas.getContext('2d');

  // Color scale
  const range = dataMax - dataMin || 1;

  // Draw pixels with viridis colormap
  const imageData = ctx.createImageData(cols, rows);
  const data = imageData.data;

  for (let i = 0; i < values.length; i++) {
    const val = values[i];
    const pixelIdx = i * 4;

    if (val === null || val === undefined) {
      // Transparent for no-data
      data[pixelIdx + 3] = 0;
    } else {
      // Normalize value to [0, 1]
      const norm = Math.max(0, Math.min(1, (val - dataMin) / range));
      const colorIdx = Math.floor(norm * (VIRIDIS_COLORMAP.length - 1));
      const color = VIRIDIS_COLORMAP[colorIdx];
      const rgb = hexToRgb(color);

      data[pixelIdx] = rgb.r;
      data[pixelIdx + 1] = rgb.g;
      data[pixelIdx + 2] = rgb.b;
      data[pixelIdx + 3] = 200; // Alpha
    }
  }

  ctx.putImageData(imageData, 0, 0);

  // Create image overlay from canvas
  const bounds = [
    [grid.lat_min, grid.lon_min],
    [grid.lat_max, grid.lon_max],
  ];

  const layer = L.imageOverlay(canvas.toDataURL(), bounds, {
    opacity: 0.8,
    interactive: false,
  });

  // Update legend
  legendMin.textContent = dataMin.toFixed(2);
  legendMax.textContent = dataMax.toFixed(2);

  return layer;
}

function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : { r: 0, g: 0, b: 0 };
}

function updateDateDisplay() {
  if (dates.length === 0) {
    dateLabel.textContent = '—';
    return;
  }
  const dateData = dates[currentDateIdx];
  dateLabel.textContent = dateData.date || '—';
}

function togglePlayback() {
  isPlaying = !isPlaying;
  playBtn.innerHTML = isPlaying
    ? '<i class="bi bi-pause-fill"></i>'
    : '<i class="bi bi-play-fill"></i>';

  if (isPlaying) {
    playInterval = setInterval(() => {
      currentDateIdx = (currentDateIdx + 1) % dates.length;
      dateSlider.value = currentDateIdx;
      renderDate(currentDateIdx);
    }, 500); // 500ms per frame
  } else {
    clearInterval(playInterval);
  }
}

function updateInfo(text) {
  infoText.textContent = text;
}

function showLoading() {
  loadingOverlay.style.display = 'flex';
}

function hideLoading() {
  loadingOverlay.style.display = 'none';
}

// ── Event Listeners ────────────────────────────────────────────
varSelect.addEventListener('change', onVariableChange);

dateSlider.addEventListener('input', (e) => {
  renderDate(parseInt(e.target.value));
});

playBtn.addEventListener('click', togglePlayback);

// ── Startup ────────────────────────────────────────────────────
init();
