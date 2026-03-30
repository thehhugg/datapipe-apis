/**
 * Sitemap Parser API
 * Parse XML sitemaps, discover all URLs, get page counts and metadata.
 * High demand from SEO tools, crawlers, and content auditors.
 */

import { Router } from 'express';

const router = Router();

// In-memory cache (5 min TTL)
const cache = new Map();
const CACHE_TTL = 5 * 60 * 1000;

function getCached(key) {
  const entry = cache.get(key);
  if (entry && Date.now() - entry.ts < CACHE_TTL) return entry.data;
  cache.delete(key);
  return null;
}

function setCache(key, data) {
  cache.set(key, { data, ts: Date.now() });
  if (cache.size > 500) {
    const oldest = cache.keys().next().value;
    cache.delete(oldest);
  }
}

/**
 * Parse XML sitemap content
 */
function parseSitemap(xml) {
  const urls = [];
  
  // Check if it's a sitemap index
  const isIndex = xml.includes('<sitemapindex');
  
  if (isIndex) {
    // Parse sitemap index — extract child sitemap URLs
    const sitemapRegex = /<sitemap>\s*<loc>([^<]+)<\/loc>(?:\s*<lastmod>([^<]+)<\/lastmod>)?/g;
    let match;
    while ((match = sitemapRegex.exec(xml)) !== null) {
      urls.push({
        url: match[1].trim(),
        lastmod: match[2]?.trim() || null,
        type: 'sitemap',
      });
    }
    return { type: 'sitemapindex', sitemaps: urls, urlCount: urls.length };
  }
  
  // Parse regular sitemap
  const urlRegex = /<url>\s*<loc>([^<]+)<\/loc>(?:\s*<lastmod>([^<]+)<\/lastmod>)?(?:\s*<changefreq>([^<]+)<\/changefreq>)?(?:\s*<priority>([^<]+)<\/priority>)?/g;
  let match;
  while ((match = urlRegex.exec(xml)) !== null) {
    urls.push({
      url: match[1].trim(),
      lastmod: match[2]?.trim() || null,
      changefreq: match[3]?.trim() || null,
      priority: match[4] ? parseFloat(match[4]) : null,
    });
  }
  
  // Also try a simpler pattern for sitemaps with different ordering
  if (urls.length === 0) {
    const simpleLoc = /<loc>([^<]+)<\/loc>/g;
    let m;
    while ((m = simpleLoc.exec(xml)) !== null) {
      urls.push({ url: m[1].trim(), lastmod: null, changefreq: null, priority: null });
    }
  }
  
  return { type: 'urlset', urls, urlCount: urls.length };
}

/**
 * GET /parse?url=https://example.com/sitemap.xml
 * Parse a sitemap URL and return structured data
 */
router.get('/parse', async (req, res) => {
  try {
    let { url } = req.query;
    if (!url) {
      return res.status(400).json({ error: 'url parameter required' });
    }
    
    // If just a domain, try common sitemap paths
    if (!url.includes('sitemap') && !url.endsWith('.xml')) {
      url = url.replace(/\/$/, '') + '/sitemap.xml';
    }
    
    const cached = getCached(`sitemap:${url}`);
    if (cached) return res.json({ ...cached, cached: true });
    
    const response = await fetch(url, {
      headers: { 'User-Agent': 'DataPipe-SitemapParser/1.0' },
      signal: AbortSignal.timeout(15000),
    });
    
    if (!response.ok) {
      return res.status(404).json({ 
        error: 'Sitemap not found', 
        status: response.status,
        url,
        suggestion: 'Try /discover?domain=example.com to find sitemaps'
      });
    }
    
    const xml = await response.text();
    const result = parseSitemap(xml);
    
    const data = {
      source: url,
      ...result,
      fetchedAt: new Date().toISOString(),
    };
    
    setCache(`sitemap:${url}`, data);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /discover?domain=example.com
 * Discover sitemaps for a domain by checking common locations + robots.txt
 */
router.get('/discover', async (req, res) => {
  try {
    const { domain } = req.query;
    if (!domain) {
      return res.status(400).json({ error: 'domain parameter required' });
    }
    
    const cached = getCached(`discover:${domain}`);
    if (cached) return res.json({ ...cached, cached: true });
    
    const base = domain.startsWith('http') ? domain : `https://${domain}`;
    const found = [];
    
    // Check robots.txt for sitemap directives
    try {
      const robotsRes = await fetch(`${base}/robots.txt`, {
        headers: { 'User-Agent': 'DataPipe-SitemapParser/1.0' },
        signal: AbortSignal.timeout(10000),
      });
      if (robotsRes.ok) {
        const robotsTxt = await robotsRes.text();
        const sitemapLines = robotsTxt.match(/^Sitemap:\s*(.+)$/gmi) || [];
        for (const line of sitemapLines) {
          const url = line.replace(/^Sitemap:\s*/i, '').trim();
          found.push({ url, source: 'robots.txt' });
        }
      }
    } catch (e) { /* ignore */ }
    
    // Check common sitemap locations
    const commonPaths = [
      '/sitemap.xml', '/sitemap_index.xml', '/sitemap-index.xml',
      '/sitemaps.xml', '/sitemap1.xml', '/post-sitemap.xml',
      '/page-sitemap.xml', '/wp-sitemap.xml',
    ];
    
    const checks = commonPaths.map(async (path) => {
      const url = `${base}${path}`;
      // Skip if already found in robots.txt
      if (found.some(f => f.url === url)) return null;
      try {
        const r = await fetch(url, {
          method: 'HEAD',
          headers: { 'User-Agent': 'DataPipe-SitemapParser/1.0' },
          signal: AbortSignal.timeout(5000),
        });
        if (r.ok && r.headers.get('content-type')?.includes('xml')) {
          return { url, source: 'common-path' };
        }
      } catch (e) { /* ignore */ }
      return null;
    });
    
    const results = await Promise.all(checks);
    for (const r of results) {
      if (r) found.push(r);
    }
    
    const data = {
      domain,
      sitemaps: found,
      count: found.length,
      checkedAt: new Date().toISOString(),
    };
    
    setCache(`discover:${domain}`, data);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /stats?url=https://example.com/sitemap.xml
 * Get statistics about a sitemap without returning all URLs
 */
router.get('/stats', async (req, res) => {
  try {
    let { url } = req.query;
    if (!url) {
      return res.status(400).json({ error: 'url parameter required' });
    }
    
    if (!url.includes('sitemap') && !url.endsWith('.xml')) {
      url = url.replace(/\/$/, '') + '/sitemap.xml';
    }
    
    const response = await fetch(url, {
      headers: { 'User-Agent': 'DataPipe-SitemapParser/1.0' },
      signal: AbortSignal.timeout(15000),
    });
    
    if (!response.ok) {
      return res.status(404).json({ error: 'Sitemap not found', status: response.status });
    }
    
    const xml = await response.text();
    const parsed = parseSitemap(xml);
    
    // Calculate stats
    const items = parsed.urls || parsed.sitemaps || [];
    const lastmods = items.map(i => i.lastmod).filter(Boolean).sort();
    const priorities = items.map(i => i.priority).filter(p => p !== null);
    
    const stats = {
      source: url,
      type: parsed.type,
      totalUrls: parsed.urlCount,
      hasLastmod: items.filter(i => i.lastmod).length,
      oldestEntry: lastmods[0] || null,
      newestEntry: lastmods[lastmods.length - 1] || null,
      avgPriority: priorities.length > 0 ? (priorities.reduce((a, b) => a + b, 0) / priorities.length).toFixed(2) : null,
      fetchedAt: new Date().toISOString(),
    };
    
    // URL pattern analysis
    if (parsed.urls) {
      const patterns = {};
      for (const u of parsed.urls) {
        try {
          const path = new URL(u.url).pathname;
          const segments = path.split('/').filter(Boolean);
          const pattern = segments.length > 0 ? `/${segments[0]}/...` : '/';
          patterns[pattern] = (patterns[pattern] || 0) + 1;
        } catch (e) { /* skip */ }
      }
      stats.topPatterns = Object.entries(patterns)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([pattern, count]) => ({ pattern, count }));
    }
    
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export { router as sitemapParserRouter };
