/**
 * Government Contracts API — Federal contract opportunities from SAM.gov
 * 
 * Endpoints:
 *   GET /api/gov-contracts/search?q=cybersecurity&limit=25
 *   GET /api/gov-contracts/recent?days=7
 *   GET /api/gov-contracts/categories
 */

import { Router } from 'express';

export const govContractsRouter = Router();

const CACHE = new Map();
const CACHE_TTL = 30 * 60 * 1000;

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

// SAM.gov public API (no key needed for basic search)
async function searchSAM(keyword = '', limit = 25, postedDays = 30) {
  const cacheKey = `sam:${keyword}:${limit}:${postedDays}`;
  const hit = cached(cacheKey);
  if (hit) return hit;

  const postedFrom = new Date(Date.now() - postedDays * 86400000).toISOString().split('T')[0];
  const apiKey = process.env.SAM_GOV_API_KEY || '';
  
  // SAM.gov public opportunities API
  const params = new URLSearchParams({
    ...(apiKey && { api_key: apiKey }),
    limit: String(Math.min(parseInt(limit), 100)),
    postedFrom,
    ...(keyword && { q: keyword }),
    ptype: 'o', // opportunities
  });

  const url = `https://api.sam.gov/opportunities/v2/search?${params}`;

  try {
    const res = await fetch(url, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(20000),
    });

    if (!res.ok) {
      // Fallback: return structured empty with note
      return { opportunities: [], note: 'SAM.gov API unavailable. Provide SAM_GOV_API_KEY for full access.' };
    }

    const data = await res.json();
    const opportunities = (data.opportunitiesData || []).map(opp => ({
      id: opp.noticeId || opp.solicitationNumber,
      title: opp.title,
      type: opp.type,
      agency: opp.fullParentPathName || opp.department,
      postedDate: opp.postedDate,
      responseDeadline: opp.responseDeadline || opp.archiveDate,
      naicsCode: opp.naicsCode,
      setAside: opp.typeOfSetAside || null,
      placeOfPerformance: opp.placeOfPerformance?.city 
        ? `${opp.placeOfPerformance.city}, ${opp.placeOfPerformance.state}`
        : null,
      url: `https://sam.gov/opp/${opp.noticeId}/view`,
      pointOfContact: opp.pointOfContact?.[0] ? {
        name: opp.pointOfContact[0].fullName,
        email: opp.pointOfContact[0].email,
        phone: opp.pointOfContact[0].phone,
      } : null,
      description: opp.description?.slice(0, 500) || null,
    }));

    const result = { opportunities, total: data.totalRecords || opportunities.length };
    setCache(cacheKey, result);
    return result;
  } catch (err) {
    console.error(`SAM.gov error: ${err.message}`);
    return { opportunities: [], error: err.message };
  }
}

// GET /api/gov-contracts/search
govContractsRouter.get('/search', async (req, res) => {
  try {
    const { q = '', limit = 25, days = 30 } = req.query;
    const result = await searchSAM(q, limit, parseInt(days));
    res.json({
      query: q,
      days: parseInt(days),
      count: result.opportunities.length,
      total: result.total || 0,
      data: result.opportunities,
      ...(result.note && { note: result.note }),
    });
  } catch (err) {
    res.status(500).json({ error: 'Search failed', detail: err.message });
  }
});

// GET /api/gov-contracts/recent
govContractsRouter.get('/recent', async (req, res) => {
  try {
    const { days = 7, limit = 50 } = req.query;
    const result = await searchSAM('', limit, parseInt(days));
    res.json({
      period: `Last ${days} days`,
      count: result.opportunities.length,
      data: result.opportunities,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch recent contracts', detail: err.message });
  }
});

// GET /api/gov-contracts/categories
govContractsRouter.get('/categories', (req, res) => {
  res.json({
    popular_keywords: [
      'cybersecurity', 'software development', 'IT services', 'cloud computing',
      'artificial intelligence', 'data analytics', 'consulting', 'construction',
      'healthcare', 'logistics', 'training', 'maintenance',
    ],
    set_asides: [
      'Small Business', 'HUBZone', 'Woman-Owned', 'Veteran-Owned',
      'Service-Disabled Veteran-Owned', '8(a)',
    ],
    note: 'Search any keyword. Categories are suggestions only.',
  });
});
