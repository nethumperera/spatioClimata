/**
 * spatioClimata - API Configuration
 * 
 * Update this file with your deployment URLs:
 * - For GitHub Pages + Vercel: Set VERCEL_API_URL to your Vercel domain
 * - For local development: Use localhost URLs
 */

window.SPATIOCLIMATA_CONFIG = {
  // Your Vercel deployment URL (e.g., https://spatioclimata.vercel.app)
  // Replace 'spatioclimata.vercel.app' with your actual Vercel domain
  VERCEL_API_URL: 'https://spatioclimata.vercel.app',
  
  // API endpoints
  API_MANIFEST: '/api/manifest',
  API_HEALTH: '/api/health',
  API_INGEST: '/api',
  
  // Development mode
  DEBUG: false,
};

// Auto-detect if running locally
if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
  window.SPATIOCLIMATA_CONFIG.VERCEL_API_URL = 'http://localhost:3000';
}

// Helper function to build API URL
window.SPATIOCLIMATA_CONFIG.getApiUrl = function(endpoint) {
  const isDev = window.location.hostname === 'localhost';
  const base = isDev ? 'http://localhost:3000' : this.VERCEL_API_URL;
  return base + endpoint;
};
