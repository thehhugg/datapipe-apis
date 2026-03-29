/**
 * Website Screenshot API
 * 
 * Captures screenshots of any URL. Uses a headless browser approach
 * or falls back to third-party screenshot services.
 * 
 * High demand on RapidAPI — competitors charge $0.01-0.05/call.
 * 
 * Endpoints:
 *   GET /api/screenshot/capture?url=example.com&width=1280&height=720&fullPage=false
 *   GET /api/screenshot/thumbnail?url=example.com&width=300
 */

import { Router } from 'express';

export const screenshotRouter = Router();

const CACHE = new Map();
const CACHE_TTL = 60 * 60 * 1000; // 1hr cache

function cached(key) {
  const entry = CACHE.get(key);
  if (entry && Date.now() - entry.ts < CACHE_TTL) return entry.data;
  return null;
}
function setCache(key, data) {
  CACHE.set(key, { data, ts: Date.now() });
  if (CACHE.size > 200) {
    const oldest = [...CACHE.entries()].sort((a, b) => a[1].ts - b[1].ts);
    oldest.slice(0, 50).forEach(([k]) => CACHE.delete(k));
  }
}

/**
 * Generate screenshot using microlink.io (free tier: 50/day)
 * or screenshotone.com as fallback
 * In production, use Playwright/Puppeteer on the server
 */
async function captureScreenshot(url, options = {}) {
  const {
    width = 1280,
    height = 800,
    fullPage = false,
    format = 'png',
    quality = 80,
    delay = 0,
  } = options;

  const cleanUrl = url.startsWith('http') ? url : `https://${url}`;
  
  // Strategy 1: Use Puppeteer if available (production)
  if (process.env.PUPPETEER_AVAILABLE === 'true') {
    return await captureWithPuppeteer(cleanUrl, { width, height, fullPage, format, quality, delay });
  }

  // Strategy 2: Use screenshotone.com API if key available
  if (process.env.SCREENSHOTONE_API_KEY) {
    const params = new URLSearchParams({
      access_key: process.env.SCREENSHOTONE_API_KEY,
      url: cleanUrl,
      viewport_width: String(width),
      viewport_height: String(height),
      full_page: String(fullPage),
      format,
      image_quality: String(quality),
      delay: String(delay),
      block_ads: 'true',
      block_cookie_banners: 'true',
    });
    
    const apiUrl = `https://api.screenshotone.com/take?${params}`;
    const res = await fetch(apiUrl, { signal: AbortSignal.timeout(30000) });
    
    if (!res.ok) throw new Error(`Screenshot service returned ${res.status}`);
    
    const buffer = await res.arrayBuffer();
    return {
      image: Buffer.from(buffer).toString('base64'),
      format,
      width,
      height,
      url: cleanUrl,
      method: 'screenshotone',
    };
  }

  // Strategy 3: Use Google PageSpeed Insights screenshot (free, no key needed)
  const psiUrl = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(cleanUrl)}&category=PERFORMANCE&strategy=DESKTOP`;
  const psiRes = await fetch(psiUrl, { signal: AbortSignal.timeout(30000) });
  
  if (!psiRes.ok) throw new Error(`PageSpeed API returned ${psiRes.status}`);
  
  const psiData = await psiRes.json();
  const screenshot = psiData?.lighthouseResult?.audits?.['final-screenshot']?.details?.data;
  
  if (!screenshot) throw new Error('No screenshot available from PageSpeed');
  
  // Extract base64 data (format: "data:image/jpeg;base64,...")
  const base64 = screenshot.split(',')[1] || screenshot;
  
  return {
    image: base64,
    format: 'jpeg',
    width: psiData?.lighthouseResult?.audits?.['final-screenshot']?.details?.width || width,
    height: psiData?.lighthouseResult?.audits?.['final-screenshot']?.details?.height || height,
    url: cleanUrl,
    method: 'pagespeed',
    note: 'Screenshot captured via Google PageSpeed. For higher quality, upgrade to Pro plan.',
  };
}

async function captureWithPuppeteer(url, options) {
  // This would use puppeteer in production
  // Placeholder for when deployed with puppeteer installed
  throw new Error('Puppeteer not available in this environment');
}

// GET /api/screenshot/capture
screenshotRouter.get('/capture', async (req, res) => {
  try {
    const { url, width, height, fullPage, format, quality, delay } = req.query;
    if (!url) return res.status(400).json({ error: 'Missing required parameter: url' });

    const cacheKey = `ss:${url}:${width || 1280}:${height || 800}:${fullPage || false}`;
    const hit = cached(cacheKey);
    if (hit) return res.json(hit);

    const result = await captureScreenshot(url, {
      width: parseInt(width) || 1280,
      height: parseInt(height) || 800,
      fullPage: fullPage === 'true',
      format: format || 'png',
      quality: parseInt(quality) || 80,
      delay: parseInt(delay) || 0,
    });

    const response = {
      success: true,
      url: result.url,
      screenshot: {
        data: result.image,
        format: result.format,
        width: result.width,
        height: result.height,
        encoding: 'base64',
      },
      method: result.method,
      capturedAt: new Date().toISOString(),
    };

    if (result.note) response.note = result.note;

    setCache(cacheKey, response);
    res.json(response);
  } catch (err) {
    res.status(500).json({
      success: false,
      error: 'Screenshot capture failed',
      detail: err.message,
      suggestion: 'If this persists, the target site may be blocking automated access.',
    });
  }
});

// GET /api/screenshot/thumbnail — smaller, faster
screenshotRouter.get('/thumbnail', async (req, res) => {
  try {
    const { url, width = '400' } = req.query;
    if (!url) return res.status(400).json({ error: 'Missing required parameter: url' });

    const thumbWidth = Math.min(parseInt(width) || 400, 800);
    const cacheKey = `thumb:${url}:${thumbWidth}`;
    const hit = cached(cacheKey);
    if (hit) return res.json(hit);

    const result = await captureScreenshot(url, {
      width: thumbWidth,
      height: Math.round(thumbWidth * 0.625),
      format: 'jpeg',
      quality: 60,
    });

    const response = {
      success: true,
      url: result.url,
      thumbnail: {
        data: result.image,
        format: result.format,
        width: thumbWidth,
        encoding: 'base64',
      },
      capturedAt: new Date().toISOString(),
    };

    setCache(cacheKey, response);
    res.json(response);
  } catch (err) {
    res.status(500).json({ success: false, error: 'Thumbnail failed', detail: err.message });
  }
});
