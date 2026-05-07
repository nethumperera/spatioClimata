# 🌍 Live GloFAS Map - Quick Start

## What's New?

Your spatioClimata system now has a **live 2D interactive map** showing real-time GloFAS hydrological data with:

✅ **2D Leaflet Map** - Shows all regions clearly (no zoom/visibility issues)
✅ **Real Data on Map** - Displays raster layers instead of demo markers  
✅ **Timeline Animation** - Play/pause through 7 days of data
✅ **Variable Selector** - Switch between 3 GloFAS variables
✅ **Automatic Daily Updates** - Cron job at 6 AM UTC fetches latest data

## Access the Map

### URL
```
https://your-domain.vercel.app/pages/globe.html
```

### What You'll See

1. **2D Map** - Full-screen Leaflet map of Earth
2. **Control Panel** (top-right) with:
   - Variable selector dropdown
   - Date slider and Play/Pause button
   - Color legend showing data range
3. **Zoom/Pan Controls** - Explore any region
4. **Status Indicator** - Shows current variable and date

## How to Use

### 1. Select a Variable
Click the dropdown to choose:
- **River Discharge (24h)** - Water flowing in rivers (m³/s)
- **Soil Wetness Index** - Ground moisture level (0-1)
- **Runoff Water Equivalent** - Water running off surface (kg/m²)

### 2. Navigate Through Time
- **Drag Slider** - Jump to specific date
- **Click Play** - Auto-animate through dates (500ms per frame)
- **Click Pause** - Stop animation

### 3. Explore the Map
- **Zoom In/Out** - Use +/- buttons or scroll wheel
- **Pan** - Click and drag the map
- **Identify Regions** - Hover over colored areas to see values

## How It Works

### Data Flow

```
Daily at 6 AM UTC:
  ↓
Vercel Cron Job
  ↓
Download GloFAS data from Copernicus
  ↓
Process & downsample to 1° grid
  ↓
Upload to Vercel Blob Storage
  ↓
Generate manifest with URLs
  ↓
Frontend fetches manifest
  ↓
Display on 2D Leaflet map
```

### Files That Make It Work

| File | Purpose |
|------|---------|
| `/api/index.py` | Daily cron job - fetches & processes data |
| `/api/manifest.py` | Serves data URLs & metadata |
| `/pages/globe.html` | 2D map UI (Leaflet-based) |
| `/assets/js/map.js` | Data binding & animation logic |
| `/vercel.json` | Cron schedule configuration |

## Troubleshooting

### Map Shows "Demo Data"

**Problem**: Map displays demo markers instead of real GloFAS data

**Solution**:
1. Check if cron job has run:
   ```bash
   curl https://your-domain.vercel.app/api/manifest
   ```
   Should show real dates, not "demo" status

2. If still demo, manually trigger:
   ```bash
   curl -X POST https://your-domain.vercel.app/api
   ```

3. Check environment variables in Vercel:
   - `SPATIOCLIMATA_API_KEY` ✓ Set?
   - `BLOB_READ_WRITE_TOKEN` ✓ Set?

### Map Won't Load / Blank Screen

**Problem**: Page loads but map is empty

**Solution**:
1. Open browser console (F12) and check for errors
2. Check if manifest endpoint works:
   ```bash
   curl https://your-domain.vercel.app/api/manifest
   ```
3. Verify Vercel deployment was successful
4. Clear browser cache and reload

### Slow Animation or Lag

**Problem**: Timeline animation stutters or feels slow

**Solution**:
1. Click Pause to stop animation
2. Use slider to navigate instead
3. Try different variable (smaller data size)
4. Use modern browser (Chrome, Firefox, Edge)

### Data Is Outdated

**Problem**: Map shows old dates, not latest data

**Solution**:
1. Wait for next cron run (6 AM UTC next day)
2. Manually trigger for testing:
   ```bash
   curl -X POST https://your-domain.vercel.app/api
   ```
3. Check Vercel Function Logs for errors

## Features

### Map Controls

| Control | Action |
|---------|--------|
| `+` / `-` buttons | Zoom in/out |
| Mouse scroll | Zoom with scroll wheel |
| Click & drag | Pan around map |
| Variable dropdown | Switch between variables |
| Date slider | Scrub through timeline |
| Play button | Auto-animate through dates |

### Data Visualization

- **Raster Grid** - 1° resolution (~110 km)
- **Viridis Colormap** - Scientific color scale (purple → yellow)
- **7-Day Window** - Always shows last 7 days of data
- **Global Coverage** - All land and sea areas

### Browser Compatibility

- ✅ Chrome/Chromium 60+
- ✅ Firefox 55+
- ✅ Safari 12+
- ✅ Edge 79+
- ⚠️ Mobile browsers may have limited functionality

## Advanced Usage

### Modify Cron Schedule

Edit `vercel.json`:
```json
{
  "crons": [
    {
      "path": "/api",
      "schedule": "0 12 * * *"  // Change 6 AM to 12 PM
    }
  ]
}
```

Common schedules:
- `0 6 * * *` = Daily 6 AM
- `0 12 * * *` = Daily 12 PM
- `0 */6 * * *` = Every 6 hours
- `*/30 * * * *` = Every 30 minutes

### Change Data Retention

Edit `streaming/config.json`:
```json
{
  "retention_days": 7,  // Keep 7 days (default)
  "lag_days": 2         // Wait 2 days for EWDS data
}
```

### Select Different Variables

Edit `streaming/config.json`:
```json
{
  "variables": [
    "river_discharge_in_the_last_24_hours",
    "soil_wetness_index_root_zone",
    "runoff_water_equivalent"
  ]
}
```

## Performance Notes

### Vercel Hobby Plan Limits

- ⏱️ **Max Function Time**: 300 seconds
- 📦 **Max Output Size**: 4.5 MB
- 💾 **Blob Storage**: Free tier available

### If Hitting Timeout

1. Reduce area of interest (smaller region)
2. Fetch fewer variables
3. Increase lag_days to skip old data
4. Upgrade to Vercel Pro plan

## Support & Resources

### Check System Health
```bash
curl https://your-domain.vercel.app/api/health
```

### Get Available Data
```bash
curl https://your-domain.vercel.app/api/manifest
```

### Trigger Data Fetch
```bash
curl -X POST https://your-domain.vercel.app/api
```

### Vercel Logs
Visit: https://vercel.com/dashboard → Select Project → Functions/Logs

## Next Steps

1. ✅ Cron job is configured for 6 AM UTC
2. ⏳ Wait for first data fetch or trigger manually
3. 🗺️ Visit `/pages/globe.html` to view live data
4. 🎬 Use timeline to explore different dates
5. 📊 Select different variables to see more data

---

**🚀 System is ready!** Just wait for the cron job to run, then you'll see real GloFAS data on your map.

For detailed documentation, see: [`docs/live-data-deployment.md`](./live-data-deployment.md)
