/**
 * Jobs API — Remote & tech job listings aggregated from multiple sources
 * 
 * Endpoints:
 *   GET /api/jobs/remote?tag=engineering&page=1
 *   GET /api/jobs/search?q=python+developer&location=remote
 *   GET /api/jobs/companies/:company
 */

import { Router } from 'express';
import * as cheerio from 'cheerio';

export const jobsRouter = Router();

const CACHE = new Map();
const CACHE_TTL = 15 * 60 * 1000; // 15 min

function cached(key, ttl = CACHE_TTL) {
  const entry = CACHE.get(key);
  if (entry && Date.now() - entry.ts < ttl) return entry.data;
  return null;
}

function setCache(key, data) {
  CACHE.set(key, { data, ts: Date.now() });
  // Prune old entries
  if (CACHE.size > 500) {
    const oldest = [...CACHE.entries()].sort((a, b) => a[1].ts - b[1].ts);
    oldest.slice(0, 100).forEach(([k]) => CACHE.delete(k));
  }
}

async function fetchWithRetry(url, opts = {}, retries = 2) {
  for (let i = 0; i <= retries; i++) {
    try {
      const res = await fetch(url, {
        ...opts,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
          ...opts.headers,
        },
        signal: AbortSignal.timeout(10000),
      });
      if (res.ok) return res;
    } catch (e) {
      if (i === retries) throw e;
      await new Promise(r => setTimeout(r, 1000 * (i + 1)));
    }
  }
}

// Remote jobs from RemoteOK
async function scrapeRemoteOK(tag = '') {
  const cacheKey = `remoteok:${tag}`;
  const hit = cached(cacheKey);
  if (hit) return hit;

  const url = tag 
    ? `https://remoteok.com/remote-${encodeURIComponent(tag)}-jobs`
    : 'https://remoteok.com/remote-jobs';
  
  const res = await fetchWithRetry(url);
  const html = await res.text();
  const $ = cheerio.load(html);
  const jobs = [];

  $('tr.job').each((i, el) => {
    const $el = $(el);
    jobs.push({
      id: $el.attr('data-id') || `rok-${i}`,
      company: $el.find('.companyLink h3').text().trim(),
      title: $el.find('h2[itemprop="title"]').text().trim(),
      tags: $el.find('.tag').map((_, t) => $(t).text().trim()).get(),
      salary: $el.find('.salary').text().trim() || null,
      location: 'Remote',
      url: `https://remoteok.com${$el.find('a.preventLink').attr('href') || ''}`,
      posted: $el.find('.time time').attr('datetime') || null,
      source: 'remoteok',
    });
  });

  const data = jobs.filter(j => j.title);
  setCache(cacheKey, data);
  return data;
}

// HN Who's Hiring
async function scrapeHNHiring() {
  const cacheKey = 'hn-hiring';
  const hit = cached(cacheKey, 60 * 60 * 1000); // 1hr cache
  if (hit) return hit;

  // Get latest "Who is hiring?" post - sort by date to get most recent
  const searchUrl = 'https://hn.algolia.com/api/v1/search_by_date?query=%22Ask+HN:+Who+is+hiring%22&tags=ask_hn&hitsPerPage=5';
  const searchRes = await fetchWithRetry(searchUrl);
  const searchData = await searchRes.json();
  
  if (!searchData.hits?.length) return [];
  
  const postId = searchData.hits[0].objectID;
  const commentsUrl = `https://hn.algolia.com/api/v1/items/${postId}`;
  const commentsRes = await fetchWithRetry(commentsUrl);
  const commentsData = await commentsRes.json();

  const jobs = (commentsData.children || []).slice(0, 100).map((comment, i) => {
    const text = comment.text || '';
    // Parse first line as company | role | location | salary
    const firstLine = text.replace(/<[^>]+>/g, '').split('\n')[0];
    const parts = firstLine.split('|').map(p => p.trim());
    
    return {
      id: `hn-${comment.id}`,
      company: parts[0] || 'Unknown',
      title: parts[1] || firstLine.slice(0, 100),
      location: parts[2] || null,
      salary: parts[3] || null,
      description: text.replace(/<[^>]+>/g, '').slice(0, 500),
      url: `https://news.ycombinator.com/item?id=${comment.id}`,
      posted: comment.created_at,
      source: 'hackernews',
    };
  });

  setCache(cacheKey, jobs);
  return jobs;
}

// GET /api/jobs/remote
jobsRouter.get('/remote', async (req, res) => {
  try {
    const { tag = '', page = 1, limit = 50 } = req.query;
    const jobs = await scrapeRemoteOK(tag);
    const start = (parseInt(page) - 1) * parseInt(limit);
    const paged = jobs.slice(start, start + parseInt(limit));
    
    res.json({
      count: paged.length,
      total: jobs.length,
      page: parseInt(page),
      data: paged,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch remote jobs', detail: err.message });
  }
});

// GET /api/jobs/hackernews
jobsRouter.get('/hackernews', async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const jobs = await scrapeHNHiring();
    const start = (parseInt(page) - 1) * parseInt(limit);
    const paged = jobs.slice(start, start + parseInt(limit));
    
    res.json({
      count: paged.length,
      total: jobs.length,
      page: parseInt(page),
      data: paged,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch HN jobs', detail: err.message });
  }
});

// GET /api/jobs/search
jobsRouter.get('/search', async (req, res) => {
  try {
    const { q = '', tag = '' } = req.query;
    const [remote, hn] = await Promise.allSettled([
      scrapeRemoteOK(tag),
      scrapeHNHiring(),
    ]);
    
    let all = [
      ...(remote.status === 'fulfilled' ? remote.value : []),
      ...(hn.status === 'fulfilled' ? hn.value : []),
    ];
    
    if (q) {
      const query = q.toLowerCase();
      all = all.filter(j => 
        j.title?.toLowerCase().includes(query) ||
        j.company?.toLowerCase().includes(query) ||
        j.tags?.some(t => t.toLowerCase().includes(query))
      );
    }
    
    res.json({ count: all.length, query: q, data: all.slice(0, 100) });
  } catch (err) {
    res.status(500).json({ error: 'Search failed', detail: err.message });
  }
});
