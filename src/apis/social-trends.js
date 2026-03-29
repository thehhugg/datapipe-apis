/**
 * Social Trends API — Trending topics from Reddit & Hacker News
 * 
 * Endpoints:
 *   GET /api/social-trends/reddit?subreddit=technology&limit=25
 *   GET /api/social-trends/hackernews?type=top&limit=30
 *   GET /api/social-trends/search?q=AI&source=all
 */

import { Router } from 'express';

export const socialTrendsRouter = Router();

const CACHE = new Map();
const CACHE_TTL = 10 * 60 * 1000; // 10min for trending data

function cached(key) {
  const entry = CACHE.get(key);
  if (entry && Date.now() - entry.ts < CACHE_TTL) return entry.data;
  return null;
}

function setCache(key, data) {
  CACHE.set(key, { data, ts: Date.now() });
  if (CACHE.size > 300) {
    const oldest = [...CACHE.entries()].sort((a, b) => a[1].ts - b[1].ts);
    oldest.slice(0, 50).forEach(([k]) => CACHE.delete(k));
  }
}

async function fetchJSON(url) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'DataPipeAPI/1.0',
      'Accept': 'application/json',
    },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// Reddit (uses public JSON endpoints, no auth needed)
async function getRedditPosts(subreddit = 'technology', sort = 'hot', limit = 25) {
  const cacheKey = `reddit:${subreddit}:${sort}:${limit}`;
  const hit = cached(cacheKey);
  if (hit) return hit;

  const url = `https://www.reddit.com/r/${encodeURIComponent(subreddit)}/${sort}.json?limit=${Math.min(limit, 100)}`;
  const data = await fetchJSON(url);

  const posts = (data.data?.children || []).map(child => {
    const p = child.data;
    return {
      id: p.id,
      title: p.title,
      author: p.author,
      score: p.score,
      upvoteRatio: p.upvote_ratio,
      comments: p.num_comments,
      created: new Date(p.created_utc * 1000).toISOString(),
      url: p.url_overridden_by_dest || `https://reddit.com${p.permalink}`,
      permalink: `https://reddit.com${p.permalink}`,
      selfText: p.selftext?.slice(0, 300) || null,
      flair: p.link_flair_text || null,
      isOriginalContent: p.is_original_content || false,
      subreddit: p.subreddit,
    };
  });

  setCache(cacheKey, posts);
  return posts;
}

// Hacker News via official API
async function getHNStories(type = 'top', limit = 30) {
  const cacheKey = `hn:${type}:${limit}`;
  const hit = cached(cacheKey);
  if (hit) return hit;

  const validTypes = ['top', 'new', 'best', 'ask', 'show'];
  const storyType = validTypes.includes(type) ? type : 'top';

  const idsUrl = `https://hacker-news.firebaseio.com/v0/${storyType}stories.json`;
  const ids = await fetchJSON(idsUrl);
  const topIds = ids.slice(0, Math.min(parseInt(limit), 50));

  const stories = await Promise.allSettled(
    topIds.map(id => fetchJSON(`https://hacker-news.firebaseio.com/v0/item/${id}.json`))
  );

  const posts = stories
    .filter(r => r.status === 'fulfilled' && r.value)
    .map(r => {
      const s = r.value;
      return {
        id: s.id,
        title: s.title,
        author: s.by,
        score: s.score,
        comments: s.descendants || 0,
        created: new Date(s.time * 1000).toISOString(),
        url: s.url || `https://news.ycombinator.com/item?id=${s.id}`,
        hnUrl: `https://news.ycombinator.com/item?id=${s.id}`,
        type: s.type,
      };
    });

  setCache(cacheKey, posts);
  return posts;
}

// GET /api/social-trends/reddit
socialTrendsRouter.get('/reddit', async (req, res) => {
  try {
    const { subreddit = 'technology', sort = 'hot', limit = 25 } = req.query;
    const posts = await getRedditPosts(subreddit, sort, parseInt(limit));
    res.json({
      subreddit,
      sort,
      count: posts.length,
      data: posts,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch Reddit data', detail: err.message });
  }
});

// GET /api/social-trends/hackernews
socialTrendsRouter.get('/hackernews', async (req, res) => {
  try {
    const { type = 'top', limit = 30 } = req.query;
    const posts = await getHNStories(type, parseInt(limit));
    res.json({
      type,
      count: posts.length,
      data: posts,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch HN data', detail: err.message });
  }
});

// GET /api/social-trends/search
socialTrendsRouter.get('/search', async (req, res) => {
  try {
    const { q, source = 'all', subreddit = 'all', limit = 25 } = req.query;
    if (!q) return res.status(400).json({ error: 'Missing required parameter: q' });

    const query = q.toLowerCase();
    const results = [];

    if (source === 'all' || source === 'reddit') {
      const subs = subreddit === 'all' 
        ? ['technology', 'programming', 'startups', 'business', 'entrepreneur']
        : [subreddit];
      
      for (const sub of subs) {
        try {
          const posts = await getRedditPosts(sub, 'hot', 50);
          results.push(...posts.filter(p => 
            p.title.toLowerCase().includes(query) ||
            p.selfText?.toLowerCase().includes(query)
          ).map(p => ({ ...p, source: 'reddit' })));
        } catch { /* skip failed subreddits */ }
      }
    }

    if (source === 'all' || source === 'hackernews') {
      try {
        const stories = await getHNStories('top', 50);
        results.push(...stories.filter(s => 
          s.title.toLowerCase().includes(query)
        ).map(s => ({ ...s, source: 'hackernews' })));
      } catch { /* skip */ }
    }

    // Sort by score
    results.sort((a, b) => (b.score || 0) - (a.score || 0));

    res.json({
      query: q,
      count: results.length,
      data: results.slice(0, parseInt(limit)),
    });
  } catch (err) {
    res.status(500).json({ error: 'Search failed', detail: err.message });
  }
});

// GET /api/social-trends/subreddits
socialTrendsRouter.get('/subreddits', (req, res) => {
  res.json({
    popular: [
      'technology', 'programming', 'startups', 'business', 'entrepreneur',
      'SaaS', 'webdev', 'datascience', 'machinelearning', 'artificial',
      'cryptocurrency', 'stocks', 'realestate', 'smallbusiness', 'freelance',
      'sideproject', 'indiehackers', 'devops', 'cybersecurity', 'marketing',
    ],
    note: 'Any public subreddit name works.',
  });
});
