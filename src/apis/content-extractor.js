/**
 * Content Extractor API — Clean Article/Page Extraction
 * 
 * Given a URL, extracts the main content, strips ads/navigation,
 * returns clean text + metadata. Like a read-mode/reader-view API.
 * 
 * High demand: content aggregators, AI training pipelines, SEO tools,
 * research tools, bookmark managers.
 */

import { Router } from 'express';

const router = Router();

// Simple HTML tag stripper
function stripTags(html) {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
    .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
    .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
    .replace(/<aside[^>]*>[\s\S]*?<\/aside>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

// Extract meta tags
function extractMeta(html) {
  const meta = {};
  
  // Title
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  meta.title = titleMatch ? titleMatch[1].trim() : null;
  
  // Meta description
  const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i) ||
                    html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*name=["']description["']/i);
  meta.description = descMatch ? descMatch[1].trim() : null;
  
  // OG tags
  const ogTags = {};
  const ogMatches = html.matchAll(/<meta[^>]*property=["']og:([^"']+)["'][^>]*content=["']([^"']+)["']/gi);
  for (const match of ogMatches) {
    ogTags[match[1]] = match[2];
  }
  if (Object.keys(ogTags).length > 0) meta.openGraph = ogTags;
  
  // Author
  const authorMatch = html.match(/<meta[^>]*name=["']author["'][^>]*content=["']([^"']+)["']/i);
  meta.author = authorMatch ? authorMatch[1].trim() : null;
  
  // Published date
  const dateMatch = html.match(/<meta[^>]*(?:property=["']article:published_time["']|name=["']date["'])[^>]*content=["']([^"']+)["']/i) ||
                    html.match(/<time[^>]*datetime=["']([^"']+)["']/i);
  meta.publishedDate = dateMatch ? dateMatch[1].trim() : null;
  
  // Canonical URL
  const canonMatch = html.match(/<link[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["']/i);
  meta.canonicalUrl = canonMatch ? canonMatch[1].trim() : null;
  
  // Language
  const langMatch = html.match(/<html[^>]*lang=["']([^"']+)["']/i);
  meta.language = langMatch ? langMatch[1].trim() : null;
  
  return meta;
}

// Extract links
function extractLinks(html, baseUrl) {
  const links = [];
  const seen = new Set();
  const linkMatches = html.matchAll(/<a[^>]*href=["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi);
  
  for (const match of linkMatches) {
    let href = match[1].trim();
    const text = stripTags(match[2]).trim();
    if (!href || href.startsWith('javascript:') || href.startsWith('mailto:')) continue;
    
    try {
      href = new URL(href, baseUrl).href;
    } catch { continue; }
    
    if (!seen.has(href) && text.length > 0) {
      seen.add(href);
      links.push({ url: href, text: text.substring(0, 200) });
    }
  }
  return links.slice(0, 50);
}

// Extract images
function extractImages(html, baseUrl) {
  const images = [];
  const imgMatches = html.matchAll(/<img[^>]*src=["']([^"']+)["'][^>]*>/gi);
  
  for (const match of imgMatches) {
    let src = match[1].trim();
    const altMatch = match[0].match(/alt=["']([^"']+)["']/i);
    const alt = altMatch ? altMatch[1].trim() : null;
    
    try {
      src = new URL(src, baseUrl).href;
    } catch { continue; }
    
    // Skip tiny tracking pixels and data URIs
    if (src.startsWith('data:') || src.includes('1x1') || src.includes('pixel')) continue;
    
    images.push({ url: src, alt });
  }
  return images.slice(0, 20);
}

// Main content extraction (heuristic-based)
function extractMainContent(html) {
  // Try article tag first
  const articleMatch = html.match(/<article[^>]*>([\s\S]*?)<\/article>/i);
  if (articleMatch) return stripTags(articleMatch[1]);
  
  // Try main tag
  const mainMatch = html.match(/<main[^>]*>([\s\S]*?)<\/main>/i);
  if (mainMatch) return stripTags(mainMatch[1]);
  
  // Try common content div patterns
  const contentPatterns = [
    /<div[^>]*class=["'][^"']*(?:article|content|post|entry|story|body)[^"']*["'][^>]*>([\s\S]*?)<\/div>/i,
    /<div[^>]*id=["'](?:article|content|post|entry|story|main)[^"']*["'][^>]*>([\s\S]*?)<\/div>/i,
  ];
  
  for (const pattern of contentPatterns) {
    const match = html.match(pattern);
    if (match) {
      const text = stripTags(match[1]);
      if (text.length > 200) return text;
    }
  }
  
  // Fallback: strip everything and return body content
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  return stripTags(bodyMatch ? bodyMatch[1] : html);
}

// Word count
function wordCount(text) {
  return text.split(/\s+/).filter(w => w.length > 0).length;
}

// ── Routes ──

// Full content extraction
router.get('/extract', async (req, res) => {
  try {
    const { url, format = 'text' } = req.query;
    if (!url) return res.status(400).json({ error: 'url parameter required' });
    
    let parsedUrl;
    try {
      parsedUrl = new URL(url);
    } catch {
      return res.status(400).json({ error: 'Invalid URL' });
    }
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; ContentExtractor/1.0)',
        'Accept': 'text/html,application/xhtml+xml',
      },
      signal: AbortSignal.timeout(10000),
    });
    
    if (!response.ok) {
      return res.status(502).json({ error: `Failed to fetch URL: ${response.status}` });
    }
    
    const html = await response.text();
    const meta = extractMeta(html);
    const content = extractMainContent(html);
    const links = extractLinks(html, url);
    const images = extractImages(html, url);
    
    res.json({
      url,
      meta,
      content: content.substring(0, 50000), // Cap at 50K chars
      wordCount: wordCount(content),
      links,
      images,
      fetchedAt: new Date().toISOString(),
    });
  } catch (err) {
    if (err.name === 'TimeoutError') {
      return res.status(504).json({ error: 'URL fetch timed out (10s limit)' });
    }
    res.status(500).json({ error: 'Extraction failed', message: err.message });
  }
});

// Metadata only (fast, minimal parsing)
router.get('/meta', async (req, res) => {
  try {
    const { url } = req.query;
    if (!url) return res.status(400).json({ error: 'url parameter required' });
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; ContentExtractor/1.0)',
        'Accept': 'text/html,application/xhtml+xml',
      },
      signal: AbortSignal.timeout(8000),
    });
    
    if (!response.ok) {
      return res.status(502).json({ error: `Failed to fetch: ${response.status}` });
    }
    
    // Only read first 50KB for meta extraction
    const reader = response.body.getReader();
    let html = '';
    while (html.length < 50000) {
      const { done, value } = await reader.read();
      if (done) break;
      html += new TextDecoder().decode(value);
    }
    reader.cancel();
    
    res.json({
      url,
      ...extractMeta(html),
      fetchedAt: new Date().toISOString(),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Links extraction
router.get('/links', async (req, res) => {
  try {
    const { url, limit = 50 } = req.query;
    if (!url) return res.status(400).json({ error: 'url parameter required' });
    
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ContentExtractor/1.0)' },
      signal: AbortSignal.timeout(10000),
    });
    
    if (!response.ok) {
      return res.status(502).json({ error: `Failed to fetch: ${response.status}` });
    }
    
    const html = await response.text();
    const links = extractLinks(html, url).slice(0, Math.min(parseInt(limit), 100));
    
    res.json({ url, count: links.length, links });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export { router as contentExtractorRouter };
