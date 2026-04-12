const root = document.documentElement;
const THEME_STORAGE_KEY = 'spatioclimata-theme';
let signalChart = null;

const revealEls = document.querySelectorAll('[data-reveal]');

const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) {
        return;
      }
      entry.target.classList.add('in');
      observer.unobserve(entry.target);
    });
  },
  {
    threshold: 0.14,
  }
);

revealEls.forEach((el) => {
  el.classList.add('reveal');
  observer.observe(el);
});

function getSystemTheme() {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function getStoredTheme() {
  try {
    const saved = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (saved === 'light' || saved === 'dark') {
      return saved;
    }
  } catch (error) {
    console.debug('Theme storage not available', error);
  }
  return null;
}

function saveTheme(theme) {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch (error) {
    console.debug('Theme could not be persisted', error);
  }
}

function cssVar(name, fallback = '') {
  const value = getComputedStyle(root).getPropertyValue(name).trim();
  return value || fallback;
}

function hexToRgba(hex, alpha = 1) {
  const raw = hex.replace('#', '').trim();
  if (![3, 6].includes(raw.length)) {
    return hex;
  }
  const full = raw.length === 3 ? raw.split('').map((c) => c + c).join('') : raw;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function updateThemeToggleUi(theme) {
  document.querySelectorAll('[data-theme-toggle]').forEach((btn) => {
    const icon = btn.querySelector('i');
    const label = btn.querySelector('[data-theme-label]');
    if (theme === 'dark') {
      icon?.classList.remove('bi-moon-stars-fill');
      icon?.classList.add('bi-sun-fill');
      if (label) {
        label.textContent = 'Light';
      }
    } else {
      icon?.classList.remove('bi-sun-fill');
      icon?.classList.add('bi-moon-stars-fill');
      if (label) {
        label.textContent = 'Dark';
      }
    }
  });
}

function applyChartTheme() {
  if (!signalChart) {
    return;
  }

  const legendColor = cssVar('--ink', '#1f2d25');
  const tickColor = cssVar('--ink-soft', '#496257');
  const lineColor = hexToRgba(cssVar('--line', '#d6dfd5'), 0.45);

  signalChart.options.plugins.legend.labels.color = legendColor;
  signalChart.options.scales.x.ticks.color = tickColor;
  signalChart.options.scales.y.ticks.color = tickColor;
  signalChart.options.scales.x.grid.color = lineColor;
  signalChart.options.scales.y.grid.color = lineColor;
  signalChart.update('none');
}

function applyTheme(theme) {
  root.setAttribute('data-theme', theme);
  updateThemeToggleUi(theme);
  applyChartTheme();
}

function toggleTheme() {
  const current = root.getAttribute('data-theme') || getSystemTheme();
  const next = current === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  saveTheme(next);
}

const initialTheme = getStoredTheme() || getSystemTheme();
applyTheme(initialTheme);

document.querySelectorAll('[data-theme-toggle]').forEach((btn) => {
  btn.addEventListener('click', toggleTheme);
});

document.querySelectorAll('[data-copy]').forEach((copyBtn) => {
  copyBtn.addEventListener('click', async () => {
    const command = copyBtn.getAttribute('data-copy');
    if (!command) {
      return;
    }

    try {
      await navigator.clipboard.writeText(command);
      const previous = copyBtn.textContent;
      copyBtn.textContent = 'Copied';
      setTimeout(() => {
        copyBtn.textContent = previous;
      }, 1200);
    } catch (error) {
      console.error('Copy failed', error);
    }
  });
});

const yearEl = document.querySelector('[data-year]');
if (yearEl) {
  yearEl.textContent = new Date().getFullYear().toString();
}

const counterEls = document.querySelectorAll('[data-counter]');
counterEls.forEach((el) => {
  const target = Number(el.getAttribute('data-counter') || '0');
  let value = 0;
  const duration = 900;
  const stepMs = 16;
  const increment = Math.max(1, Math.round((target * stepMs) / duration));

  const run = () => {
    value += increment;
    if (value >= target) {
      el.textContent = target.toLocaleString();
      return;
    }
    el.textContent = value.toLocaleString();
    requestAnimationFrame(run);
  };

  const trigger = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) {
          return;
        }
        run();
        trigger.unobserve(entry.target);
      });
    },
    { threshold: 0.4 }
  );

  trigger.observe(el);
});

const sourceFreq = document.querySelector('#sourceFreq');
const targetFreq = document.querySelector('#targetFreq');
const freqAdvice = document.querySelector('#freqAdvice');

function updateFrequencyAdvice() {
  if (!sourceFreq || !targetFreq || !freqAdvice) {
    return;
  }

  const source = sourceFreq.value;
  const target = targetFreq.value;

  if (source === target) {
    freqAdvice.textContent = 'Native frequency selected. No aggregation required.';
    return;
  }

  if (source === 'hourly' && target === 'daily') {
    freqAdvice.textContent = 'Recommended: hourly to daily mean aggregation (24 steps per day).';
    return;
  }

  if (source === 'daily' && target === 'monthly') {
    freqAdvice.textContent = 'Recommended: daily to monthly aggregation using monthly start boundary.';
    return;
  }

  if (source === 'hourly' && target === 'monthly') {
    freqAdvice.textContent = 'Pipeline path: hourly to daily to monthly for stable memory and QA checks.';
    return;
  }

  freqAdvice.textContent = 'This transformation is possible with custom post-processing rules.';
}

sourceFreq?.addEventListener('change', updateFrequencyAdvice);
targetFreq?.addEventListener('change', updateFrequencyAdvice);
updateFrequencyAdvice();

const northEl = document.querySelector('#north');
const southEl = document.querySelector('#south');
const eastEl = document.querySelector('#east');
const westEl = document.querySelector('#west');
const areaResult = document.querySelector('#areaResult');

function estimateBasinAreaKm2(north, west, south, east) {
  const latSpan = Math.abs(north - south);
  const lonSpan = Math.abs(east - west);
  const meanLat = ((north + south) / 2) * (Math.PI / 180);
  const kmPerLat = 111.32;
  const kmPerLon = 111.32 * Math.cos(meanLat);
  return latSpan * kmPerLat * lonSpan * kmPerLon;
}

function updateAreaEstimate() {
  if (!northEl || !southEl || !eastEl || !westEl || !areaResult) {
    return;
  }

  const north = Number(northEl.value);
  const south = Number(southEl.value);
  const east = Number(eastEl.value);
  const west = Number(westEl.value);

  if ([north, south, east, west].some((v) => Number.isNaN(v))) {
    areaResult.textContent = 'Enter all four numeric bounds to estimate basin area.';
    return;
  }

  if (north < south) {
    areaResult.textContent = 'North must be greater than or equal to South.';
    return;
  }

  const area = estimateBasinAreaKm2(north, west, south, east);
  areaResult.textContent = `Estimated area: ${area.toFixed(2)} km2 (approximate geographic bounding-box area).`;
}

[northEl, southEl, eastEl, westEl].forEach((el) => {
  el?.addEventListener('input', updateAreaEstimate);
});
updateAreaEstimate();

const chartCanvas = document.querySelector('#signalChart');
const seriesButtons = document.querySelectorAll('[data-series]');

if (chartCanvas && window.Chart) {
  const labels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const datasets = {
    precipitation: {
      label: 'Precipitation (mm/day)',
      data: [4.1, 3.5, 5.2, 7.8, 9.6, 8.3, 7.5, 6.8, 7.1, 9.4, 10.2, 8.9],
      borderColor: '#2e7dbd',
      backgroundColor: 'rgba(46, 125, 189, 0.16)',
      fill: true,
      tension: 0.35,
    },
    discharge: {
      label: 'Discharge (m3/s)',
      data: [22, 20, 24, 35, 47, 44, 39, 36, 33, 41, 49, 43],
      borderColor: '#0e7c68',
      backgroundColor: 'rgba(14, 124, 104, 0.17)',
      fill: true,
      tension: 0.35,
    },
    evaporation: {
      label: 'Potential Evaporation (mm/day)',
      data: [2.9, 3.0, 3.4, 3.8, 4.1, 4.3, 4.4, 4.2, 4.0, 3.7, 3.3, 3.1],
      borderColor: '#d98035',
      backgroundColor: 'rgba(217, 128, 53, 0.16)',
      fill: true,
      tension: 0.35,
    },
  };

  signalChart = new window.Chart(chartCanvas, {
    type: 'line',
    data: {
      labels,
      datasets: [datasets.precipitation],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: {
            color: '#1f2d25',
          },
        },
      },
      scales: {
        x: {
          ticks: { color: '#496257' },
          grid: { color: 'rgba(15, 45, 30, 0.08)' },
        },
        y: {
          ticks: { color: '#496257' },
          grid: { color: 'rgba(15, 45, 30, 0.08)' },
        },
      },
    },
  });

  applyChartTheme();

  seriesButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const key = btn.getAttribute('data-series');
      if (!key || !datasets[key]) {
        return;
      }
      signalChart.data.datasets = [datasets[key]];
      signalChart.update();
      seriesButtons.forEach((other) => other.classList.remove('active'));
      btn.classList.add('active');
    });
  });
}

const DATASET_REGISTRY = [
  {
    id: 'reanalysis-era5-single-levels',
    api: 'cds',
    support: 'native',
    nativeFrequencies: ['hourly'],
    outputFrequencies: ['hourly', 'daily', 'monthly'],
    description: 'Core ERA5 single-level reanalysis with hourly atmospheric and surface variables.',
    copernicusUrl: 'https://cds.climate.copernicus.eu/datasets/reanalysis-era5-single-levels',
    variables: [
      { name: '2m_temperature', unit: 'K', meaning: 'Air temperature at 2 meters above ground.' },
      { name: 'total_precipitation', unit: 'm', meaning: 'Accumulated precipitation over timestep.' },
      { name: 'surface_runoff', unit: 'm', meaning: 'Surface runoff depth over timestep.' },
      { name: 'sub_surface_runoff', unit: 'm', meaning: 'Subsurface runoff depth over timestep.' },
      { name: 'potential_evaporation', unit: 'm', meaning: 'Potential evaporation over timestep.' },
    ],
  },
  {
    id: 'derived-era5-single-levels-daily-statistics',
    api: 'cds',
    support: 'derived',
    nativeFrequencies: ['daily'],
    outputFrequencies: ['daily', 'monthly'],
    description:
      'Derived ERA5 daily statistics product, useful for lower transfer volume and direct daily analytics.',
    copernicusUrl:
      'https://cds.climate.copernicus.eu/datasets/derived-era5-single-levels-daily-statistics',
    variables: [
      { name: '2m_temperature', unit: 'K', meaning: 'Daily statistic over 2m air temperature.' },
      { name: 'total_precipitation', unit: 'm', meaning: 'Daily precipitation statistic.' },
      { name: 'surface_pressure', unit: 'Pa', meaning: 'Daily statistic for surface pressure.' },
      { name: 'surface_runoff', unit: 'm', meaning: 'Daily runoff statistic.' },
    ],
  },
  {
    id: 'cems-glofas-historical',
    api: 'ewds',
    support: 'native',
    nativeFrequencies: ['daily'],
    outputFrequencies: ['daily', 'monthly'],
    description: 'Historical GloFAS discharge datasets for river flow and hydrological analysis.',
    copernicusUrl: 'https://ewds.climate.copernicus.eu/datasets/cems-glofas-historical',
    variables: [
      {
        name: 'river_discharge_in_the_last_24_hours',
        unit: 'm3/s',
        meaning: 'Daily river discharge estimate in the last 24 hours.',
      },
    ],
  },
  {
    id: 'reanalysis-era5-land',
    api: 'cds',
    support: 'planned',
    nativeFrequencies: ['hourly'],
    outputFrequencies: ['hourly', 'daily', 'monthly'],
    description:
      'Land-focused ERA5 reanalysis with high-value soil and land surface variables. Planned adapter.',
    copernicusUrl: 'https://cds.climate.copernicus.eu/datasets/reanalysis-era5-land',
    variables: [
      { name: 'soil_temperature_level_1', unit: 'K', meaning: 'Top soil layer temperature.' },
      {
        name: 'volumetric_soil_water_layer_1',
        unit: 'm3/m3',
        meaning: 'Top layer volumetric soil moisture.',
      },
      { name: 'snow_depth', unit: 'm', meaning: 'Snow depth over land areas.' },
    ],
  },
  {
    id: 'cems-glofas-forecast',
    api: 'ewds',
    support: 'planned',
    nativeFrequencies: ['daily'],
    outputFrequencies: ['daily'],
    description: 'Forecast discharge products suitable for flood outlook workflows. Planned adapter.',
    copernicusUrl: 'https://ewds.climate.copernicus.eu/datasets/cems-glofas-forecast',
    variables: [
      { name: 'river_discharge', unit: 'm3/s', meaning: 'Forecast river discharge values by lead time.' },
      { name: 'return_period', unit: 'categorical', meaning: 'Flood return period indicators.' },
    ],
  },
];

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function renderRegistry() {
  const container = document.querySelector('#registryContainer');
  const summary = document.querySelector('#registrySummary');
  const searchEl = document.querySelector('#registrySearch');
  const apiEl = document.querySelector('#registryApi');
  const supportEl = document.querySelector('#registrySupport');
  const frequencyEl = document.querySelector('#registryFrequency');

  if (!container || !summary || !searchEl || !apiEl || !supportEl || !frequencyEl) {
    return;
  }

  const query = searchEl.value.trim().toLowerCase();
  const apiFilter = apiEl.value;
  const supportFilter = supportEl.value;
  const frequencyFilter = frequencyEl.value;

  const filtered = DATASET_REGISTRY.filter((item) => {
    const searchable = [
      item.id,
      item.description,
      item.api,
      item.support,
      ...item.nativeFrequencies,
      ...item.outputFrequencies,
      ...item.variables.map((v) => `${v.name} ${v.meaning} ${v.unit}`),
    ]
      .join(' ')
      .toLowerCase();

    const queryOk = query.length === 0 || searchable.includes(query);
    const apiOk = apiFilter === 'all' || item.api === apiFilter;
    const supportOk = supportFilter === 'all' || item.support === supportFilter;
    const frequencyOk =
      frequencyFilter === 'all' ||
      item.nativeFrequencies.includes(frequencyFilter) ||
      item.outputFrequencies.includes(frequencyFilter);

    return queryOk && apiOk && supportOk && frequencyOk;
  });

  if (filtered.length === 0) {
    container.innerHTML = '<div class="empty-state">No matching datasets found. Try broadening filters.</div>';
    summary.textContent = '0 datasets matched your filter.';
    return;
  }

  container.innerHTML = filtered
    .map((item) => {
      const variableMarkup = item.variables
        .map(
          (variable) =>
            `<li><strong>${escapeHtml(variable.name)}</strong> (${escapeHtml(variable.unit)}): ${escapeHtml(variable.meaning)}</li>`
        )
        .join('');

      const native = item.nativeFrequencies.map((f) => `<span class="badge">native ${escapeHtml(f)}</span>`).join('');
      const output = item.outputFrequencies.map((f) => `<span class="badge">output ${escapeHtml(f)}</span>`).join('');

      return `
        <article class="dataset-card">
          <div class="dataset-head">
            <h4>${escapeHtml(item.id)}</h4>
            <span class="badge support-${escapeHtml(item.support)}">${escapeHtml(item.support)}</span>
          </div>
          <div class="dataset-meta">
            <span class="badge api-${escapeHtml(item.api)}">API: ${escapeHtml(item.api.toUpperCase())}</span>
            ${native}
            ${output}
          </div>
          <p>${escapeHtml(item.description)}</p>
          <ul class="dataset-variables">
            ${variableMarkup}
          </ul>
          <div class="dataset-links">
            <a href="${escapeHtml(item.copernicusUrl)}" target="_blank" rel="noreferrer">Open Copernicus dataset</a>
            <a href="https://github.com/nethumperera/spatioClimata/issues" target="_blank" rel="noreferrer">Request support / enhancement</a>
          </div>
        </article>
      `;
    })
    .join('');

  summary.textContent = `${filtered.length} dataset(s) matched. Showing support, frequencies, and variable descriptions.`;
}

['#registrySearch', '#registryApi', '#registrySupport', '#registryFrequency'].forEach((selector) => {
  const el = document.querySelector(selector);
  el?.addEventListener('input', renderRegistry);
  el?.addEventListener('change', renderRegistry);
});

renderRegistry();
