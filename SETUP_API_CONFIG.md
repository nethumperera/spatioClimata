# 🔧 Setup: Configure API URL for GitHub Pages + Vercel

## The Issue

You're accessing the map on **GitHub Pages** (`nethumperera.github.io`), but the API endpoints live on **Vercel**. The map couldn't find the API because it was looking in the wrong place.

```
Error: Unexpected token '<', "<!DOCTYPE "... is not valid JSON
        ↑ This is GitHub Pages sending an HTML 404 instead of JSON
```

## The Fix (3 Easy Steps)

### Step 1: Find Your Vercel Deployment URL

1. Go to: https://vercel.com/dashboard
2. Select your **spatioClimata** project
3. Look at the top - you'll see a URL like:
   ```
   https://spatioclimata.vercel.app
   ```
   Or with a custom domain:
   ```
   https://your-custom-domain.com
   ```

**Copy this URL** (we'll use it in Step 3)

### Step 2: Update the Configuration File

Edit this file in your repository:
```
website/assets/js/config.js
```

Find this line:
```javascript
VERCEL_API_URL: 'https://spatioclimata.vercel.app',
```

Replace `spatioclimata.vercel.app` with **your actual Vercel domain** from Step 1.

**Example:**
```javascript
// If your Vercel URL is: https://my-project.vercel.app
VERCEL_API_URL: 'https://my-project.vercel.app',
```

### Step 3: Deploy to GitHub Pages

Commit and push your change:

```bash
git add website/assets/js/config.js
git commit -m "config: Update Vercel API URL"
git push origin main
```

GitHub Pages will automatically redeploy (usually within 1-2 minutes).

## Test It

1. Wait 1-2 minutes for GitHub Pages to update
2. **Refresh the map page**: `https://nethumperera.github.io/spatioClimata/pages/globe.html`
3. You should now see:
   - Variable selector **loads properly**
   - Color legend appears
   - Error message goes away

## How It Works

```
┌─────────────────────────────────────────────────────────────┐
│ User's Browser                                              │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  1. Load map from GitHub Pages:                              │
│     https://nethumperera.github.io/spatioClimata/globe.html  │
│                          ↓                                    │
│  2. config.js sets API URL to Vercel                         │
│                          ↓                                    │
│  3. map.js calls Vercel API:                                 │
│     https://your-vercel-domain.vercel.app/api/manifest       │
│                          ↓                                    │
│  4. Vercel returns JSON data (with CORS headers)             │
│                          ↓                                    │
│  5. Browser renders Leaflet map with real GloFAS data        │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

## Troubleshooting

### Still Getting "Unexpected token '<'"

1. **Clear browser cache**: Ctrl+Shift+Delete (then refresh)
2. **Check config.js is saved**: Visit https://github.com/nethumperera/spatioClimata/blob/main/website/assets/js/config.js
3. **Verify Vercel URL**: Double-check the domain is correct (no extra slashes)
4. **Wait for GitHub Pages**: Might take 2-3 minutes to redeploy

### Getting CORS Error

This shouldn't happen since we added CORS headers, but if it does:
- Verify your Vercel domain is correct
- Check that `/api/manifest` is accessible:
  ```bash
  curl https://your-vercel-domain.vercel.app/api/manifest
  ```

### Still Showing "No Data Available Yet"

This is normal! It means:
1. ✅ Config is correct (API is reachable)
2. ⏳ But no GloFAS data has been fetched yet

This happens because:
- Cron job hasn't run (scheduled for 6 AM UTC)
- Or no data is available from Copernicus

**To test immediately**: Trigger the ingest manually
```bash
curl -X POST https://your-vercel-domain.vercel.app/api
```

Then check manifest:
```bash
curl https://your-vercel-domain.vercel.app/api/manifest
```

## Verifying Vercel URL

If you're not sure what your Vercel URL is:

```bash
# Option 1: Check git remote (if linked to Vercel)
git remote -v

# Option 2: Visit Vercel dashboard
# https://vercel.com/dashboard → Select project → Copy the URL from the top

# Option 3: Your custom domain (if set up)
# https://your-custom-domain.com
```

## Still Have Issues?

Check these URLs directly in your browser:

1. **Test API is reachable**:
   ```
   https://your-vercel-domain.vercel.app/api/manifest
   ```
   Should show JSON (or demo data)

2. **Test GitHub Pages**:
   ```
   https://nethumperera.github.io/spatioClimata/pages/globe.html
   ```
   Should load and connect to API

3. **Check browser console** (F12):
   - Any error messages?
   - Network tab: Is the API request successful?

---

**The key point**: Update `config.js` with your Vercel URL and push to GitHub. That's it! 🎉
