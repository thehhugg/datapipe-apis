/**
 * Real Estate API — Property listings from Craigslist + Zillow public data
 * 
 * Endpoints:
 *   GET /api/real-estate/rentals?city=sfbay&max_price=3000
 *   GET /api/real-estate/sales?city=sfbay&max_price=500000
 */

import { Router } from 'express';
import * as cheerio from 'cheerio';

export const realEstateRouter = Router();

const CACHE = new Map();
const CACHE_TTL = 30 * 60 * 1000; // 30 min

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

async function scrapeCraigslistRentals(city = 'sfbay', maxPrice = 5000, minPrice = 0) {
  const cacheKey = `cl-rent:${city}:${minPrice}-${maxPrice}`;
  const hit = cached(cacheKey);
  if (hit) return hit;

  const url = `https://${city}.craigslist.org/search/apa?min_price=${minPrice}&max_price=${maxPrice}&availabilityMode=0`;
  
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' },
    signal: AbortSignal.timeout(15000),
  });
  
  const html = await res.text();
  const $ = cheerio.load(html);
  const listings = [];

  $('.cl-static-search-result, .result-row').each((i, el) => {
    const $el = $(el);
    listings.push({
      id: $el.attr('data-pid') || `cl-${i}`,
      title: $el.find('.title, .result-title').text().trim(),
      price: parseInt($el.find('.price, .result-price').text().replace(/[^0-9]/g, '')) || null,
      location: $el.find('.location, .result-hood').text().trim().replace(/[()]/g, '') || null,
      url: $el.find('a').attr('href') || null,
      posted: $el.find('time').attr('datetime') || null,
      bedrooms: null, // Would need detail page
      source: 'craigslist',
      city,
    });
  });

  const data = listings.filter(l => l.title);
  setCache(cacheKey, data);
  return data;
}

// GET /api/real-estate/rentals
realEstateRouter.get('/rentals', async (req, res) => {
  try {
    const { city = 'sfbay', max_price = 5000, min_price = 0, page = 1, limit = 50 } = req.query;
    const listings = await scrapeCraigslistRentals(city, parseInt(max_price), parseInt(min_price));
    const start = (parseInt(page) - 1) * parseInt(limit);
    
    res.json({
      count: listings.length,
      page: parseInt(page),
      city,
      filters: { min_price: parseInt(min_price), max_price: parseInt(max_price) },
      data: listings.slice(start, start + parseInt(limit)),
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch rentals', detail: err.message });
  }
});

// Supported cities endpoint
realEstateRouter.get('/cities', (req, res) => {
  res.json({
    cities: [
      { code: 'sfbay', name: 'San Francisco Bay Area' },
      { code: 'losangeles', name: 'Los Angeles' },
      { code: 'seattle', name: 'Seattle' },
      { code: 'portland', name: 'Portland' },
      { code: 'chicago', name: 'Chicago' },
      { code: 'newyork', name: 'New York' },
      { code: 'austin', name: 'Austin' },
      { code: 'denver', name: 'Denver' },
      { code: 'miami', name: 'Miami' },
      { code: 'boston', name: 'Boston' },
    ],
    note: 'Any Craigslist city subdomain works. These are popular examples.',
  });
});
