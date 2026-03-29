/**
 * Business Data API — Local business lookup & enrichment
 * 
 * Endpoints:
 *   GET /api/businesses/search?q=dentist&city=portland+or
 *   GET /api/businesses/detail?name=Business+Name&city=portland+or
 *   GET /api/businesses/categories
 */

import { Router } from 'express';
import * as cheerio from 'cheerio';

export const businessDataRouter = Router();

const CACHE = new Map();
const CACHE_TTL = 60 * 60 * 1000; // 1hr cache (business data doesn't change fast)

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
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
    },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

// Scrape Yellow Pages for business listings
async function scrapeYellowPages(query, city) {
  const cacheKey = `yp:${query}:${city}`;
  const hit = cached(cacheKey);
  if (hit) return hit;

  const searchCity = city.replace(/\s+/g, '-').toLowerCase();
  const searchQuery = encodeURIComponent(query);
  const url = `https://www.yellowpages.com/search?search_terms=${searchQuery}&geo_location_terms=${searchCity}`;

  try {
    const html = await fetchPage(url);
    const $ = cheerio.load(html);
    const businesses = [];

    $('.result').each((i, el) => {
      const $el = $(el);
      const name = $el.find('.business-name a, .n a').text().trim();
      if (!name) return;

      const phone = $el.find('.phones, .phone').first().text().trim();
      const address = $el.find('.adr, .street-address').text().trim();
      const categories = $el.find('.categories a').map((_, c) => $(c).text().trim()).get();
      const rating = parseFloat($el.find('.ratings .rating-star').attr('class')?.match(/(\d+)/)?.[1] || '0') / 2;
      const reviewCount = parseInt($el.find('.rating-count, .count').text().replace(/[^0-9]/g, '')) || 0;
      const website = $el.find('a.track-visit-website').attr('href') || null;

      businesses.push({
        id: `yp-${i}-${name.replace(/\s/g, '-').slice(0, 30)}`,
        name,
        phone: phone || null,
        address: address || null,
        city,
        categories,
        rating: rating || null,
        reviewCount,
        website,
        source: 'yellowpages',
      });
    });

    setCache(cacheKey, businesses);
    return businesses;
  } catch (err) {
    console.error(`YP scrape failed: ${err.message}`);
    return [];
  }
}

// Scrape BBB for business data
async function scrapeBBB(query, state = '') {
  const cacheKey = `bbb:${query}:${state}`;
  const hit = cached(cacheKey);
  if (hit) return hit;

  const url = `https://www.bbb.org/search?find_country=US&find_text=${encodeURIComponent(query)}&find_loc=${encodeURIComponent(state)}&page=1`;

  try {
    const html = await fetchPage(url);
    const $ = cheerio.load(html);
    const businesses = [];

    $('[data-testid="search-result"]').each((i, el) => {
      const $el = $(el);
      businesses.push({
        name: $el.find('h3, .result-name').text().trim(),
        rating: $el.find('.bbb-rating').text().trim() || null,
        accredited: $el.text().includes('BBB Accredited'),
        source: 'bbb',
      });
    });

    setCache(cacheKey, businesses);
    return businesses;
  } catch {
    return [];
  }
}

// GET /api/businesses/search
businessDataRouter.get('/search', async (req, res) => {
  try {
    const { q, city = 'portland or', page = 1, limit = 25 } = req.query;
    if (!q) return res.status(400).json({ error: 'Missing required parameter: q (search query)' });

    const businesses = await scrapeYellowPages(q, city);
    const start = (parseInt(page) - 1) * parseInt(limit);

    res.json({
      count: businesses.length,
      page: parseInt(page),
      query: q,
      city,
      data: businesses.slice(start, start + parseInt(limit)),
    });
  } catch (err) {
    res.status(500).json({ error: 'Search failed', detail: err.message });
  }
});

// GET /api/businesses/enrich
businessDataRouter.get('/enrich', async (req, res) => {
  try {
    const { name, city = '' } = req.query;
    if (!name) return res.status(400).json({ error: 'Missing required parameter: name' });

    const [ypResults, bbbResults] = await Promise.allSettled([
      scrapeYellowPages(name, city),
      scrapeBBB(name, city),
    ]);

    const yp = ypResults.status === 'fulfilled' ? ypResults.value : [];
    const bbb = bbbResults.status === 'fulfilled' ? bbbResults.value : [];

    // Find best match
    const nameLower = name.toLowerCase();
    const ypMatch = yp.find(b => b.name.toLowerCase().includes(nameLower)) || yp[0];
    const bbbMatch = bbb.find(b => b.name?.toLowerCase().includes(nameLower)) || bbb[0];

    res.json({
      query: name,
      city,
      yellowPages: ypMatch || null,
      bbb: bbbMatch || null,
      sources: {
        yellowPages: yp.length > 0,
        bbb: bbb.length > 0,
      },
    });
  } catch (err) {
    res.status(500).json({ error: 'Enrichment failed', detail: err.message });
  }
});

// GET /api/businesses/categories
businessDataRouter.get('/categories', (req, res) => {
  res.json({
    popular: [
      'Dentists', 'Plumbers', 'Electricians', 'Restaurants', 'Auto Repair',
      'HVAC', 'Lawyers', 'Real Estate Agents', 'Insurance', 'Accountants',
      'Contractors', 'Landscaping', 'Roofing', 'Pet Services', 'Hair Salons',
      'Chiropractors', 'Physical Therapy', 'Pest Control', 'Moving Companies',
      'Cleaning Services',
    ],
    note: 'Any search term works. These are popular categories.',
  });
});
