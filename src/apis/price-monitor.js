/**
 * Price & Change Monitor API — Track changes on any webpage
 * 
 * Users provide a URL and optional CSS selector. We fetch the page,
 * extract the target content, and compare it against previous snapshots.
 * Returns: current value, previous value, changed (bool), history.
 * 
 * Use cases:
 *   - E-commerce price tracking
 *   - Stock availability monitoring  
 *   - Job posting changes
 *   - Competitor pricing
 *   - Any "notify me when X changes" scenario
 * 
 * Endpoints:
 *   POST /api/monitor/check    — Check a URL now, compare to last snapshot
 *   POST /api/monitor/track    — Add a URL to tracking (returns tracking_id)
 *   GET  /api/monitor/history   — Get change history for a tracking_id
 *   GET  /api/monitor/status    — Check tracking status
 */

import { Router } from 'express';
import * as cheerio from 'cheerio';
import { createHash } from 'crypto';

export const priceMonitorRouter = Router();

// In-memory store (production would use Redis/SQLite)
const TRACKING = new Map();  // tracking_id -> { url, selector, label, snapshots: [] }
const MAX_SNAPSHOTS = 100;

function generateId(url, selector) {
  return createHash('sha256').update(`${url}|${selector || ''}`).digest('hex').slice(0, 16);
}

async function fetchAndExtract(url, selector) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; PriceMonitorBot/1.0)',
        'Accept': 'text/html,application/xhtml+xml',
      },
    });
    
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    
    const html = await res.text();
    const $ = cheerio.load(html);
    
    let extractedValue;
    let extractedHtml;
    
    if (selector) {
      const elements = $(selector);
      if (elements.length === 0) {
        return { error: `Selector "${selector}" not found on page`, status: res.status };
      }
      extractedValue = elements.first().text().trim();
      extractedHtml = elements.first().html();
    } else {
      // Without selector, extract page title + meta description as the "value"
      const title = $('title').text().trim();
      const desc = $('meta[name="description"]').attr('content') || '';
      extractedValue = `${title} | ${desc}`.trim();
    }
    
    // Also try to extract a price if it looks like one
    const priceMatch = extractedValue.match(/[\$\€\£]\s*[\d,]+\.?\d*/);
    const numericPrice = priceMatch ? parseFloat(priceMatch[0].replace(/[\$\€\£,]/g, '')) : null;
    
    return {
      value: extractedValue,
      html: extractedHtml || null,
      price: numericPrice,
      status: res.status,
      fetchedAt: new Date().toISOString(),
    };
  } finally {
    clearTimeout(timeout);
  }
}

// POST /api/monitor/check — One-shot check with comparison
priceMonitorRouter.post('/check', async (req, res) => {
  try {
    const { url, selector, label } = req.body;
    
    if (!url) {
      return res.status(400).json({ error: 'url is required' });
    }
    
    const trackingId = generateId(url, selector);
    const result = await fetchAndExtract(url, selector);
    
    if (result.error) {
      return res.status(422).json({ error: result.error, status: result.status });
    }
    
    // Get previous snapshot if tracking exists
    const tracking = TRACKING.get(trackingId);
    const previousSnapshot = tracking?.snapshots?.[tracking.snapshots.length - 1];
    
    // Store this snapshot
    if (!TRACKING.has(trackingId)) {
      TRACKING.set(trackingId, {
        url,
        selector: selector || null,
        label: label || url,
        created: new Date().toISOString(),
        snapshots: [],
      });
    }
    
    const snapshot = {
      value: result.value,
      price: result.price,
      fetchedAt: result.fetchedAt,
      hash: createHash('md5').update(result.value).digest('hex'),
    };
    
    const entry = TRACKING.get(trackingId);
    entry.snapshots.push(snapshot);
    if (entry.snapshots.length > MAX_SNAPSHOTS) {
      entry.snapshots = entry.snapshots.slice(-MAX_SNAPSHOTS);
    }
    
    const changed = previousSnapshot ? snapshot.hash !== previousSnapshot.hash : false;
    const priceChanged = previousSnapshot?.price != null && result.price != null
      ? result.price !== previousSnapshot.price
      : false;
    const priceDelta = priceChanged
      ? {
          from: previousSnapshot.price,
          to: result.price,
          change: result.price - previousSnapshot.price,
          percentChange: ((result.price - previousSnapshot.price) / previousSnapshot.price * 100).toFixed(2) + '%',
        }
      : null;
    
    res.json({
      trackingId,
      url,
      selector: selector || null,
      current: {
        value: result.value,
        price: result.price,
        fetchedAt: result.fetchedAt,
      },
      previous: previousSnapshot ? {
        value: previousSnapshot.value,
        price: previousSnapshot.price,
        fetchedAt: previousSnapshot.fetchedAt,
      } : null,
      changed,
      priceChanged,
      priceDelta,
      totalSnapshots: entry.snapshots.length,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to check URL', message: err.message });
  }
});

// POST /api/monitor/track — Register a URL for tracking
priceMonitorRouter.post('/track', async (req, res) => {
  try {
    const { url, selector, label } = req.body;
    
    if (!url) {
      return res.status(400).json({ error: 'url is required' });
    }
    
    const trackingId = generateId(url, selector);
    
    // Initial fetch
    const result = await fetchAndExtract(url, selector);
    
    if (result.error) {
      return res.status(422).json({ error: result.error });
    }
    
    TRACKING.set(trackingId, {
      url,
      selector: selector || null,
      label: label || url,
      created: new Date().toISOString(),
      snapshots: [{
        value: result.value,
        price: result.price,
        fetchedAt: result.fetchedAt,
        hash: createHash('md5').update(result.value).digest('hex'),
      }],
    });
    
    res.json({
      trackingId,
      url,
      selector: selector || null,
      label: label || url,
      initialValue: result.value,
      initialPrice: result.price,
      message: 'Tracking started. Use POST /check with the same URL to detect changes.',
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to start tracking', message: err.message });
  }
});

// GET /api/monitor/history?id=xxx
priceMonitorRouter.get('/history', (req, res) => {
  const { id } = req.query;
  
  if (!id) {
    return res.status(400).json({ error: 'id (tracking_id) is required' });
  }
  
  const tracking = TRACKING.get(id);
  if (!tracking) {
    return res.status(404).json({ error: 'Tracking ID not found' });
  }
  
  // Calculate changes between consecutive snapshots
  const changes = [];
  for (let i = 1; i < tracking.snapshots.length; i++) {
    const prev = tracking.snapshots[i - 1];
    const curr = tracking.snapshots[i];
    if (curr.hash !== prev.hash) {
      changes.push({
        from: prev.value,
        to: curr.value,
        priceFrom: prev.price,
        priceTo: curr.price,
        detectedAt: curr.fetchedAt,
      });
    }
  }
  
  res.json({
    trackingId: id,
    url: tracking.url,
    selector: tracking.selector,
    label: tracking.label,
    created: tracking.created,
    totalSnapshots: tracking.snapshots.length,
    totalChanges: changes.length,
    latestValue: tracking.snapshots[tracking.snapshots.length - 1]?.value,
    latestPrice: tracking.snapshots[tracking.snapshots.length - 1]?.price,
    changes,
  });
});

// GET /api/monitor/status
priceMonitorRouter.get('/status', (req, res) => {
  const tracked = [...TRACKING.entries()].map(([id, t]) => ({
    trackingId: id,
    url: t.url,
    selector: t.selector,
    label: t.label,
    snapshots: t.snapshots.length,
    lastChecked: t.snapshots[t.snapshots.length - 1]?.fetchedAt,
    lastValue: t.snapshots[t.snapshots.length - 1]?.value?.slice(0, 100),
  }));
  
  res.json({
    totalTracked: tracked.length,
    items: tracked,
  });
});
