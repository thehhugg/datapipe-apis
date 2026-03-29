/**
 * URL Metadata & Shortener API
 * 
 * Extracts rich metadata from any URL (OpenGraph, Twitter Cards, favicon, etc.)
 * Also provides URL validation, expansion (unshorten), and redirect tracing.
 * 
 * Endpoints:
 *   GET /api/url/metadata?url=https://example.com
 *   GET /api/url/expand?url=https://t.co/abc123
 *   GET /api/url/validate?url=https://example.com
 */

import { Router } from 'express';
import * as cheerio from 'cheerio';

export const urlRouter = Router();

const CACHE = new Map();
const CACHE_TTL = 60 * 60 * 1000; // 1hr

function cached(key) {
  const entry = CACHE.get(key);
  if (entry && Date.now() - entry.ts < CACHE_TTL) return entry.data;
  return null;
}

function setCache(key, data) {
  CACHE.set(key, { data, ts: Date.now() });
  if (CACHE.size > 2000) {
    const oldest = [...CACHE.entries()].sort((a, b) => a[1].ts - b[1].ts);
    oldest.slice(0, 500).forEach(([k]) => CACHE.delete(k));
  }
}

// Extract rich metadata from URL
async function extractMetadata(url) {
  const hit = cached(`meta:${url}`);
  if (hit) return hit;

  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; MetadataBot/1.0)',
      'Accept': 'text/html',
    },
    signal: AbortSignal.timeout(10000),
    redirect: 'follow',
  });

  const finalUrl = res.url;
  const html = await res.text();
  const $ = cheerio.load(html);

  const getMeta = (name) => {
    return $(`meta[property="${name}"]`).attr('content') 
      || $(`meta[name="${name}"]`).attr('content')
      || null;
  };

  const result = {
    url,
    finalUrl,
    statusCode: res.status,
    title: $('title').text().trim() || null,
    description: getMeta('description') || getMeta('og:description') || null,
    
    // OpenGraph
    openGraph: {
      title: getMeta('og:title'),
      description: getMeta('og:description'),
      image: getMeta('og:image'),
      type: getMeta('og:type'),
      url: getMeta('og:url'),
      siteName: getMeta('og:site_name'),
      locale: getMeta('og:locale'),
    },

    // Twitter Card
    twitter: {
      card: getMeta('twitter:card'),
      site: getMeta('twitter:site'),
      creator: getMeta('twitter:creator'),
      title: getMeta('twitter:title'),
      description: getMeta('twitter:description'),
      image: getMeta('twitter:image'),
    },

    // Favicon
    favicon: $('link[rel="icon"]').attr('href') 
      || $('link[rel="shortcut icon"]').attr('href')
      || `${new URL(finalUrl).origin}/favicon.ico`,

    // Canonical URL
    canonical: $('link[rel="canonical"]').attr('href') || null,

    // Language
    language: $('html').attr('lang') || getMeta('language') || null,

    // Author
    author: getMeta('author') || null,

    // Keywords
    keywords: getMeta('keywords')?.split(',').map(k => k.trim()).filter(Boolean) || [],

    // Robots
    robots: getMeta('robots') || null,

    fetchedAt: new Date().toISOString(),
  };

  setCache(`meta:${url}`, result);
  return result;
}

// Rich metadata extraction
urlRouter.get('/metadata', async (req, res) => {
  try {
    const { url } = req.query;
    if (!url) return res.status(400).json({ error: 'Missing required parameter: url' });
    
    try { new URL(url); } catch { 
      return res.status(400).json({ error: 'Invalid URL format' }); 
    }

    const result = await extractMetadata(url);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Metadata extraction failed', detail: err.message });
  }
});

// URL expansion (unshorten)
urlRouter.get('/expand', async (req, res) => {
  try {
    const { url } = req.query;
    if (!url) return res.status(400).json({ error: 'Missing required parameter: url' });

    const redirects = [];
    let currentUrl = url;
    let hops = 0;
    const MAX_HOPS = 10;

    while (hops < MAX_HOPS) {
      const response = await fetch(currentUrl, {
        method: 'HEAD',
        redirect: 'manual',
        signal: AbortSignal.timeout(5000),
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; URLExpander/1.0)' },
      });

      const location = response.headers.get('location');
      if (location && (response.status >= 300 && response.status < 400)) {
        const next = new URL(location, currentUrl).href;
        redirects.push({ from: currentUrl, to: next, status: response.status });
        currentUrl = next;
        hops++;
      } else {
        break;
      }
    }

    res.json({
      originalUrl: url,
      expandedUrl: currentUrl,
      redirectCount: redirects.length,
      redirects,
      isShortened: redirects.length > 0,
    });
  } catch (err) {
    res.status(500).json({ error: 'URL expansion failed', detail: err.message });
  }
});

// URL validation
urlRouter.get('/validate', async (req, res) => {
  try {
    const { url } = req.query;
    if (!url) return res.status(400).json({ error: 'Missing required parameter: url' });

    let parsedUrl;
    try { parsedUrl = new URL(url); } catch {
      return res.json({ url, valid: false, reason: 'Invalid URL format', reachable: false });
    }

    // Check if reachable
    try {
      const response = await fetch(url, {
        method: 'HEAD',
        signal: AbortSignal.timeout(10000),
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; URLValidator/1.0)' },
      });

      res.json({
        url,
        valid: true,
        reachable: true,
        statusCode: response.status,
        contentType: response.headers.get('content-type'),
        protocol: parsedUrl.protocol,
        hostname: parsedUrl.hostname,
        ssl: parsedUrl.protocol === 'https:',
      });
    } catch (fetchErr) {
      res.json({
        url,
        valid: true,
        reachable: false,
        reason: fetchErr.message,
        protocol: parsedUrl.protocol,
        hostname: parsedUrl.hostname,
        ssl: parsedUrl.protocol === 'https:',
      });
    }
  } catch (err) {
    res.status(500).json({ error: 'Validation failed', detail: err.message });
  }
});
