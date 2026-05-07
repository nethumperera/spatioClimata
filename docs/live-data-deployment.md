# Live GloFAS Data Visualization - Deployment Guide

## Overview

The spatioClimata platform now includes a **2D interactive map** showing live GloFAS hydrological data with:

- ✅ **2D Leaflet Map** - Better visibility of all regions (replaces 3D globe)
- ✅ **Real-time Data Visualization** - Displays raster layers from GloFAS (river discharge, soil moisture, runoff)
- ✅ **Timeline Animation** - Scrub through 7-day rolling window with play/pause controls
- ✅ **Variable Selector** - Switch between discharge, soil wetness, and runoff variables
- ✅ **Automatic Updates** - Daily cron job at 6 AM UTC fetches latest data

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Vercel Deployment                        │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  Cron Job (6 AM UTC)                                         │
│  ↓                                                            │
│  /api/index.py (Ingest)                                      │
│  ├─ Fetch GloFAS data from EWDS                              │
│  ├─ Process & downsample to 1° grid                          │
│  ├─ Upload JSON to Vercel Blob Storage                       │
│  └─ Generate manifest.json                                   │
│                                                               │
│  GitHub Pages (Static Site)                                  │
│  ├─ /index.html (Landing page)                               │
│  ├─ /pages/globe.html (2D Map UI)                            │
│  └─ /assets/js/map.js (Data binding & animation)             │
│                                                               │
│  API Endpoints                                               │
│  ├─ GET /api/manifest → Manifest with data URLs              │
│  ├─ GET /api/health → System status & diagnostics            │
│  └─ POST /api → Trigger ingest manually (testing)            │
│                                                               │
│  Vercel Blob Storage                                         │
│  └─ streaming/manifest.json (Metadata)                       │
│  └─ streaming/{variable}/{date}.json (Raster data)           │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

## Setup Instructions

### 1. Prerequisites

Ensure you have:
- Copernicus CDS API key (for ERA5 data) - Get from https://cds.climate.copernicus.eu
- Vercel Blob Read/Write Token (for data storage) - Get from Vercel project settings
- Vercel project linked to GitHub repo

### 2. Environment Variables (Vercel)

In your Vercel project settings, add these environment variables:

```env
# Copernicus API Key
SPATIOCLIMATA_API_KEY=your-cds-api-key-here

# Vercel Blob Storage Token (for uploading data)
BLOB_READ_WRITE_TOKEN=vercel_blob_rw_xxxxx

# Optional: Custom output path (defaults to ./data)
DATA_OUTPUT_PATH=/tmp/spatioclimata
```

### 3. Cron Job Configuration

The system is already configured for **daily execution at 6 AM UTC** via `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api",
      "schedule": "0 6 * * *"
    }
  ]
}
```

To modify the schedule, edit `vercel.json` and update the crontab expression:
- `0 6 * * *` = Every day at 06:00 UTC
- `0 12 * * *` = Every day at 12:00 UTC
- `*/6 * * * *` = Every 6 hours

### 4. Testing the Pipeline

#### Check System Status
```bash
# Health check endpoint
curl https://your-domain.vercel.app/api/health
```

#### Trigger Ingest Manually (Testing)
```bash
# POST request to manually run the ingest
curl -X POST https://your-domain.vercel.app/api

# Or with specific variable
curl -X POST https://your-domain.vercel.app/api?variable=river_discharge_in_the_last_24_hours
```

#### Check Available Data
```bash
# Fetch manifest with all available dates and data URLs
curl https://your-domain.vercel.app/api/manifest
```

### 5. View Live Data

Once data is available (after first cron run):

1. **Visit the map**: `https://your-domain.vercel.app/pages/globe.html`
2. **Select a variable**: Choose from dropdown (River Discharge, Soil Wetness, Runoff)
3. **Animate through time**: Use the date slider or click Play button
4. **Zoom & Pan**: Use map controls to explore different regions

## Data Flow

### Daily Ingest (6 AM UTC)

```
1. Vercel Cron triggers GET /api
   ↓
2. api/index.py → streaming/ingest.py
   ├─ Load config (variables, area, retention)
   ├─ Compute date window (7-day rolling)
   ├─ Fetch GloFAS from Copernicus EWDS
   ├─ Process NetCDF files
   └─ Downsample to 1° grid
   ↓
3. Upload to Vercel Blob
   ├─ streaming/{variable}/{date}.json (raster grid)
   └─ streaming/manifest.json (index of all data)
   ↓
4. Manifest generation
   ├─ Group by variable
   ├─ Include date ranges
   └─ Store download URLs
   ↓
5. Frontend fetches manifest
   ├─ /api/manifest returns all available data
   ├─ Load selected variable + date
   └─ Render as raster layer on map
```

## File Structure

```
spatioClimata/
├── api/
│   ├── index.py        # Ingest cron handler
│   ├── manifest.py     # Manifest API endpoint
│   └── health.py       # Health check endpoint
├── streaming/
│   ├── config.json     # Ingest configuration
│   └── ingest.py       # Data processing script
├── website/
│   ├── index.html      # Landing page
│   └── pages/
│       ├── globe.html  # 2D Map UI (NEW)
│       ├── docs.html
│       └── examples.html
│   └── assets/
│       ├── js/
│       │   ├── map.js  # Data binding & visualization (NEW)
│       │   └── globe.js (deprecated)
│       └── css/
│           └── globe.css (updated for Leaflet)
├── vercel.json         # Cron schedule
└── README.md
```

## Features

### 2D Map Interface

- **Leaflet-based** - Lightweight, no 3D GPU overhead
- **Zoom & Pan** - Explore any region easily
- **Raster Visualization** - Display gridded climate data
- **Color Legend** - Viridis colormap with min/max values

### Timeline Controls

- **Date Slider** - Scrub through available dates
- **Play/Pause** - Animate through time series at 500ms/frame
- **Variable Selector** - Switch between GloFAS variables:
  - `river_discharge_in_the_last_24_hours` (m³/s)
  - `soil_wetness_index_root_zone` (0-1)
  - `runoff_water_equivalent` (kg/m²)

### Data Retention

- **Rolling Window** - Keeps 7 days of data
- **Daily Updates** - Old data auto-deleted when new data arrives
- **Global Coverage** - Full Earth (90°N to 90°S, 180°W to 180°E)

## Troubleshooting

### Map Shows "No Data Available Yet"

**Cause**: Cron job hasn't run or manifest is empty

**Solution**:
1. Check if cron schedule is correct in `vercel.json`
2. Manually trigger: `curl -X POST /api`
3. Monitor Vercel Function Logs: https://vercel.com/dashboard/project/settings/functions
4. Verify environment variables are set: `SPATIOCLIMATA_API_KEY`, `BLOB_READ_WRITE_TOKEN`

### Map Shows Demo Data Instead of Real Data

**Cause**: Manifest fetch succeeded but returned demo data (fallback)

**Solution**:
1. Check Vercel Blob storage: Has `/api/manifest` been uploaded?
2. Verify Blob token: Is `BLOB_READ_WRITE_TOKEN` valid?
3. Check logs: `vercel logs` to see ingest errors

### Data Is Outdated

**Cause**: Cron job failed or data fetch timed out

**Solution**:
1. Check Vercel Function Logs for errors
2. Verify Copernicus API is accessible: `ping data.cds.climate.copernicus.eu`
3. Check API key expiration: https://cds.climate.copernicus.eu/profile
4. Verify EWDS service status: https://confluence.ecmwf.int/display/EWDS

### Map Performance Issues

**Cause**: Browser struggling with large raster layers

**Solution**:
1. Disable animations (click Pause)
2. Use smaller date range
3. Try different variable (smaller data size)
4. Update browser to latest version

## Configuration

### Modify Ingest Settings

Edit `streaming/config.json`:

```json
{
  "dataset": "cems-glofas-historical",
  "variables": [
    "river_discharge_in_the_last_24_hours",
    "soil_wetness_index_root_zone",
    "runoff_water_equivalent"
  ],
  "frequency": "daily",
  "area": [90, -180, -90, 180],
  "retention_days": 7,
  "lag_days": 2,
  "extra_params": {
    "product_type": "intermediate",
    "hydrological_model": "lisflood"
  }
}
```

**Parameters**:
- `retention_days`: How many days to keep (rolling window)
- `lag_days`: Delay before fetching (EWDS usually has 2-3 day lag)
- `area`: [lat_max, lon_min, lat_min, lon_max] - Global = [90, -180, -90, 180]

### Change Cron Schedule

Edit `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api",
      "schedule": "0 */6 * * *"  // Every 6 hours instead of daily
    }
  ]
}
```

## Performance Optimization

### Current Limits (Vercel Hobby Plan)

- **Max Function Duration**: 300 seconds
- **Max File Size**: 4.5 MB
- **Blob Storage**: Free tier available

### If Hitting Timeout Issues

1. **Reduce Area**: Process smaller geographic regions
2. **Skip Variables**: Only fetch essential variables
3. **Increase Lag**: Give EWDS more time to produce data (lag_days: 3-5)
4. **Upgrade Plan**: Switch to Vercel Pro for longer timeouts

## API Reference

### GET /api/manifest

Returns available data with download URLs.

**Response**:
```json
{
  "generated_at": "2025-05-07T10:30:00Z",
  "window_start": "2025-04-30",
  "window_end": "2025-05-07",
  "variables": [
    {
      "name": "river_discharge_in_the_last_24_hours",
      "label": "River Discharge (24h)",
      "unit": "m³/s",
      "range": [0, 5000],
      "dates": [
        {
          "date": "2025-05-07",
          "url": "https://blob.vercel-storage.com/streaming/river_discharge/.../2025-05-07.json"
        }
      ]
    }
  ]
}
```

### GET /api/health

Returns system status and diagnostic information.

**Response**:
```json
{
  "status": "ok",
  "message": "GloFAS streaming pipeline is configured",
  "endpoints": { ... },
  "next_steps": [ ... ]
}
```

### POST /api

Manually trigger data ingest (for testing).

**Query Parameters**:
- `variable` (optional): Fetch specific variable only

**Response**:
```json
{
  "status": "triggered",
  "message": "Ingest job triggered manually",
  "check_manifest": "/api/manifest"
}
```

## Next Steps

1. ✅ Deploy code to Vercel
2. ✅ Set environment variables
3. ⏳ Wait for first cron run (6 AM UTC) or trigger manually
4. 🗺️ Visit `/pages/globe.html` to view data
5. 📊 Explore different variables and dates

## Support

For issues or questions:
- Check Vercel Function Logs: https://vercel.com/dashboard
- Review cron execution history: Vercel → Crons tab
- Check API health: `/api/health` endpoint
- File an issue: https://github.com/nethumperera/spatioClimata/issues

---

**Last Updated**: 2025-05-07
**System**: spatioClimata v2.0 with Live GloFAS Visualization
