/**
 * SEO Analysis API — On-page SEO audit for any URL
 * 
 * Analyzes: title, meta descriptions, headings, images, links,
 * page speed indicators, structured data, social tags, mobile readiness.
 * 
 * No external APIs needed — pure HTML analysis.
 * 
 * Endpoints:
 *   GET /api/seo/analyze?url=https://example.com
 *   GET /api/seo/headers?url=https://example.com
 *   GET /api/seo/links?url=https://example.com
 *   GET /api/seo/social?url=https://example.com
 */

import { Router } from 'express';
import * as cheerio from 'cheerio';

export const seoAnalysisRouter = Router();

const CACHE = new Map();
const CACHE_TTL = 60 * 60 * 1000; // 1hr

function cached(key) {
  const entry = CACHE.get(key);
  if (entry && Date.now() - entry.ts < CACHE_TTL) return entry.data;
  return null;
}

function setCache(key, data) {
  CACHE.set(key, { data, ts: Date.now() });
  if (CACHE.size > 500) {
    const oldest = [...CACHE.entries()].sort((a, b) => a[1].ts - b[1].ts);
    oldest.slice(0, 100).forEach(([k]) => CACHE.delete(k));
  }
}

async function fetchPage(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; SEOAnalyzer/1.0)',
        'Accept': 'text/html',
      },
      redirect: 'follow',
    });
    const startTime = Date.now();
    const html = await res.text();
    const loadTime = Date.now() - startTime;
    return { 
      html, 
      status: res.status, 
      headers: Object.fromEntries(res.headers.entries()),
      finalUrl: res.url,
      loadTime,
    };
  } finally {
    clearTimeout(timeout);
  }
}

function analyzeTitle($) {
  const title = $('title').text().trim();
  const issues = [];
  if (!title) issues.push('Missing title tag');
  else if (title.length < 30) issues.push('Title too short (< 30 chars)');
  else if (title.length > 60) issues.push('Title too long (> 60 chars)');
  return { 
    text: title || null, 
    length: title ? title.length : 0,
    optimal: title && title.length >= 30 && title.length <= 60,
    issues,
  };
}

function analyzeMetaDescription($) {
  const desc = $('meta[name="description"]').attr('content') || '';
  const issues = [];
  if (!desc) issues.push('Missing meta description');
  else if (desc.length < 120) issues.push('Meta description too short (< 120 chars)');
  else if (desc.length > 160) issues.push('Meta description too long (> 160 chars)');
  return { 
    text: desc || null, 
    length: desc.length,
    optimal: desc && desc.length >= 120 && desc.length <= 160,
    issues,
  };
}

function analyzeHeadings($) {
  const headings = {};
  for (let i = 1; i <= 6; i++) {
    const tags = $(`h${i}`);
    if (tags.length > 0) {
      headings[`h${i}`] = {
        count: tags.length,
        texts: tags.map((_, el) => $(el).text().trim().substring(0, 100)).get(),
      };
    }
  }
  const issues = [];
  if (!headings.h1) issues.push('Missing H1 tag');
  else if (headings.h1.count > 1) issues.push(`Multiple H1 tags (${headings.h1.count})`);
  return { headings, issues };
}

function analyzeImages($) {
  const images = $('img');
  let total = 0, withAlt = 0, withoutAlt = 0, withLazyLoad = 0;
  const missingAlt = [];

  images.each((_, el) => {
    total++;
    const alt = $(el).attr('alt');
    const src = $(el).attr('src') || $(el).attr('data-src') || '';
    if (alt && alt.trim()) withAlt++;
    else {
      withoutAlt++;
      if (src) missingAlt.push(src.substring(0, 100));
    }
    if ($(el).attr('loading') === 'lazy') withLazyLoad++;
  });

  const issues = [];
  if (withoutAlt > 0) issues.push(`${withoutAlt} images missing alt text`);
  if (total > 0 && withLazyLoad === 0) issues.push('No images use lazy loading');

  return { total, withAlt, withoutAlt, withLazyLoad, missingAlt: missingAlt.slice(0, 10), issues };
}

function analyzeLinks($, baseUrl) {
  const links = $('a[href]');
  let internal = 0, external = 0, nofollow = 0, broken = 0;
  const externalDomains = new Set();

  try {
    const baseDomain = new URL(baseUrl).hostname.replace(/^www\./, '');
    links.each((_, el) => {
      const href = $(el).attr('href') || '';
      const rel = $(el).attr('rel') || '';
      if (href.startsWith('#') || href.startsWith('javascript:') || href.startsWith('mailto:')) return;
      
      try {
        const url = new URL(href, baseUrl);
        const linkDomain = url.hostname.replace(/^www\./, '');
        if (linkDomain === baseDomain) internal++;
        else {
          external++;
          externalDomains.add(linkDomain);
        }
      } catch {
        broken++;
      }
      if (rel.includes('nofollow')) nofollow++;
    });
  } catch {}

  return { 
    total: links.length, 
    internal, 
    external, 
    nofollow, 
    broken,
    externalDomains: [...externalDomains].slice(0, 20),
  };
}

function analyzeSocialTags($) {
  const og = {};
  $('meta[property^="og:"]').each((_, el) => {
    const prop = $(el).attr('property').replace('og:', '');
    og[prop] = $(el).attr('content');
  });

  const twitter = {};
  $('meta[name^="twitter:"]').each((_, el) => {
    const name = $(el).attr('name').replace('twitter:', '');
    twitter[name] = $(el).attr('content');
  });

  const issues = [];
  if (!og.title) issues.push('Missing og:title');
  if (!og.description) issues.push('Missing og:description');
  if (!og.image) issues.push('Missing og:image');
  if (!twitter.card) issues.push('Missing twitter:card');

  return { openGraph: og, twitter, issues };
}

function analyzeStructuredData($, html) {
  const ldJsonScripts = $('script[type="application/ld+json"]');
  const schemas = [];
  ldJsonScripts.each((_, el) => {
    try {
      const data = JSON.parse($(el).html());
      schemas.push({
        type: data['@type'] || 'Unknown',
        context: data['@context'] || null,
      });
    } catch {}
  });

  const microdata = $('[itemtype]').length;
  
  return {
    jsonLd: schemas,
    microdataElements: microdata,
    hasStructuredData: schemas.length > 0 || microdata > 0,
  };
}

function analyzePerformanceHints($, html, headers) {
  const issues = [];
  const hints = [];

  // Check for render-blocking resources
  const syncScripts = $('script:not([async]):not([defer]):not([type="application/ld+json"])').length;
  if (syncScripts > 3) issues.push(`${syncScripts} synchronous scripts may block rendering`);

  // Check for CSS in head
  const stylesheets = $('link[rel="stylesheet"]').length;
  if (stylesheets > 5) hints.push(`${stylesheets} external stylesheets — consider bundling`);

  // Inline CSS size
  let inlineCSSSize = 0;
  $('style').each((_, el) => { inlineCSSSize += ($(el).html() || '').length; });
  if (inlineCSSSize > 50000) hints.push('Large inline CSS (> 50KB)');

  // HTML size
  const htmlSize = html.length;
  if (htmlSize > 500000) issues.push('Very large HTML document (> 500KB)');

  // Compression
  const encoding = headers['content-encoding'] || 'none';

  // Caching
  const cacheControl = headers['cache-control'] || 'not set';

  return {
    htmlSize,
    compression: encoding,
    cacheControl,
    syncScripts,
    stylesheets,
    inlineCSSBytes: inlineCSSSize,
    issues,
    hints,
  };
}

function analyzeMobileFriendliness($) {
  const viewport = $('meta[name="viewport"]').attr('content') || null;
  const issues = [];
  
  if (!viewport) issues.push('Missing viewport meta tag');
  else if (!viewport.includes('width=device-width')) issues.push('Viewport not set to device-width');

  // Check for fixed-width elements
  const hasMediaQueries = $('style').text().includes('@media');
  
  return {
    hasViewport: !!viewport,
    viewport,
    hasMediaQueries,
    issues,
  };
}

function calculateScore(allIssues) {
  let score = 100;
  const critical = allIssues.filter(i => 
    i.includes('Missing title') || i.includes('Missing H1') || i.includes('Missing viewport')
  ).length;
  const warnings = allIssues.filter(i => 
    i.includes('too short') || i.includes('too long') || i.includes('Missing meta description')
  ).length;
  const info = allIssues.length - critical - warnings;

  score -= critical * 15;
  score -= warnings * 5;
  score -= info * 2;

  return {
    score: Math.max(0, Math.min(100, score)),
    critical,
    warnings,
    info: info,
    grade: score >= 90 ? 'A' : score >= 80 ? 'B' : score >= 70 ? 'C' : score >= 60 ? 'D' : 'F',
  };
}

// Full SEO analysis
seoAnalysisRouter.get('/analyze', async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'url parameter required' });

  try {
    const cacheKey = `seo:${url}`;
    const hit = cached(cacheKey);
    if (hit) return res.json(hit);

    const { html, status, headers, finalUrl, loadTime } = await fetchPage(url);
    const $ = cheerio.load(html);

    const title = analyzeTitle($);
    const metaDescription = analyzeMetaDescription($);
    const headingAnalysis = analyzeHeadings($);
    const images = analyzeImages($);
    const links = analyzeLinks($, finalUrl);
    const social = analyzeSocialTags($);
    const structuredData = analyzeStructuredData($, html);
    const performance = analyzePerformanceHints($, html, headers);
    const mobile = analyzeMobileFriendliness($);

    const allIssues = [
      ...title.issues,
      ...metaDescription.issues,
      ...headingAnalysis.issues,
      ...images.issues,
      ...social.issues,
      ...performance.issues,
      ...mobile.issues,
    ];

    const score = calculateScore(allIssues);

    const result = {
      url: finalUrl,
      analyzedAt: new Date().toISOString(),
      httpStatus: status,
      responseTimeMs: loadTime,
      score,
      title,
      metaDescription,
      headings: headingAnalysis,
      images,
      links,
      social,
      structuredData,
      performance,
      mobile,
      allIssues,
      canonical: $('link[rel="canonical"]').attr('href') || null,
      robots: $('meta[name="robots"]').attr('content') || null,
      language: $('html').attr('lang') || null,
    };

    setCache(cacheKey, result);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Analysis failed', message: err.message });
  }
});

// Headers-only analysis
seoAnalysisRouter.get('/headers', async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'url parameter required' });

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const response = await fetch(url, {
      signal: controller.signal,
      method: 'HEAD',
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SEOAnalyzer/1.0)' },
      redirect: 'follow',
    });
    clearTimeout(timeout);

    const headers = Object.fromEntries(response.headers.entries());
    const securityHeaders = {
      'strict-transport-security': headers['strict-transport-security'] || 'missing',
      'content-security-policy': headers['content-security-policy'] ? 'present' : 'missing',
      'x-frame-options': headers['x-frame-options'] || 'missing',
      'x-content-type-options': headers['x-content-type-options'] || 'missing',
      'referrer-policy': headers['referrer-policy'] || 'missing',
      'permissions-policy': headers['permissions-policy'] ? 'present' : 'missing',
    };

    res.json({
      url,
      finalUrl: response.url,
      status: response.status,
      headers,
      securityHeaders,
      server: headers.server || 'hidden',
      poweredBy: headers['x-powered-by'] || 'hidden',
    });
  } catch (err) {
    res.status(500).json({ error: 'Header check failed', message: err.message });
  }
});

// Link analysis
seoAnalysisRouter.get('/links', async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'url parameter required' });

  try {
    const { html, finalUrl } = await fetchPage(url);
    const $ = cheerio.load(html);
    const links = analyzeLinks($, finalUrl);
    res.json({ url: finalUrl, ...links });
  } catch (err) {
    res.status(500).json({ error: 'Link analysis failed', message: err.message });
  }
});

// Social/OG tag analysis
seoAnalysisRouter.get('/social', async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'url parameter required' });

  try {
    const { html, finalUrl } = await fetchPage(url);
    const $ = cheerio.load(html);
    const social = analyzeSocialTags($);
    res.json({ url: finalUrl, ...social });
  } catch (err) {
    res.status(500).json({ error: 'Social tag analysis failed', message: err.message });
  }
});
