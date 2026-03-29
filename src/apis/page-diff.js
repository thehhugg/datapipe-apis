/**
 * Page Diff API — Detect and report changes between page versions
 * 
 * Compare two URLs, or compare a URL against its cached previous version.
 * Returns structured diff showing what was added/removed/modified.
 * 
 * Use cases:
 *   - Legal/compliance: track ToS changes
 *   - SEO: detect competitor content changes
 *   - Monitoring: government/regulatory page updates
 *   - Research: track dataset/publication changes
 * 
 * Endpoints:
 *   POST /api/diff/compare  — Compare current page to previous snapshot
 *   POST /api/diff/urls     — Compare two different URLs side-by-side
 */

import { Router } from 'express';
import * as cheerio from 'cheerio';
import { createHash } from 'crypto';

export const pageDiffRouter = Router();

const SNAPSHOTS = new Map(); // url -> { text, html, fetchedAt, hash }

async function fetchPage(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; PageDiffBot/1.0)',
        'Accept': 'text/html,application/xhtml+xml',
      },
    });
    
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    
    const html = await res.text();
    const $ = cheerio.load(html);
    
    // Remove scripts, styles, nav, footer for cleaner comparison
    $('script, style, nav, footer, header, noscript, iframe').remove();
    
    const title = $('title').text().trim();
    const text = $('body').text().replace(/\s+/g, ' ').trim();
    const links = [];
    $('a[href]').each((_, el) => {
      const href = $(el).attr('href');
      const linkText = $(el).text().trim();
      if (href && linkText) links.push({ href, text: linkText });
    });
    
    const images = [];
    $('img[src]').each((_, el) => {
      images.push({ src: $(el).attr('src'), alt: $(el).attr('alt') || '' });
    });
    
    const meta = {};
    $('meta[name], meta[property]').each((_, el) => {
      const key = $(el).attr('name') || $(el).attr('property');
      meta[key] = $(el).attr('content');
    });
    
    return { title, text, links, images, meta, fetchedAt: new Date().toISOString() };
  } finally {
    clearTimeout(timeout);
  }
}

function computeDiff(oldText, newText) {
  const oldWords = oldText.split(/\s+/);
  const newWords = newText.split(/\s+/);
  
  // Simple word-level diff using LCS-like approach
  const oldSet = new Set(oldWords);
  const newSet = new Set(newWords);
  
  const added = newWords.filter(w => !oldSet.has(w));
  const removed = oldWords.filter(w => !newSet.has(w));
  
  // Unique additions/removals (dedupe)
  const uniqueAdded = [...new Set(added)];
  const uniqueRemoved = [...new Set(removed)];
  
  // Compute sentence-level changes for better readability
  const oldSentences = oldText.match(/[^.!?]+[.!?]+/g) || [oldText];
  const newSentences = newText.match(/[^.!?]+[.!?]+/g) || [newText];
  const oldSentenceSet = new Set(oldSentences.map(s => s.trim()));
  const newSentenceSet = new Set(newSentences.map(s => s.trim()));
  
  const addedSentences = newSentences.filter(s => !oldSentenceSet.has(s.trim())).map(s => s.trim());
  const removedSentences = oldSentences.filter(s => !newSentenceSet.has(s.trim())).map(s => s.trim());
  
  const similarity = oldWords.length === 0 && newWords.length === 0 ? 1 :
    1 - (uniqueAdded.length + uniqueRemoved.length) / Math.max(oldWords.length, newWords.length, 1);
  
  return {
    changed: uniqueAdded.length > 0 || uniqueRemoved.length > 0,
    similarity: Math.max(0, Math.min(1, similarity)).toFixed(4),
    wordStats: {
      oldWordCount: oldWords.length,
      newWordCount: newWords.length,
      wordsAdded: uniqueAdded.length,
      wordsRemoved: uniqueRemoved.length,
    },
    sentenceChanges: {
      added: addedSentences.slice(0, 20),  // Cap at 20 for response size
      removed: removedSentences.slice(0, 20),
    },
    topAddedWords: uniqueAdded.slice(0, 50),
    topRemovedWords: uniqueRemoved.slice(0, 50),
  };
}

function diffLinks(oldLinks, newLinks) {
  const oldHrefs = new Set(oldLinks.map(l => l.href));
  const newHrefs = new Set(newLinks.map(l => l.href));
  
  return {
    added: newLinks.filter(l => !oldHrefs.has(l.href)),
    removed: oldLinks.filter(l => !newHrefs.has(l.href)),
  };
}

function diffMeta(oldMeta, newMeta) {
  const changes = {};
  const allKeys = new Set([...Object.keys(oldMeta), ...Object.keys(newMeta)]);
  
  for (const key of allKeys) {
    if (oldMeta[key] !== newMeta[key]) {
      changes[key] = { old: oldMeta[key] || null, new: newMeta[key] || null };
    }
  }
  
  return Object.keys(changes).length > 0 ? changes : null;
}

// POST /api/diff/compare — Compare URL to its previous snapshot
pageDiffRouter.post('/compare', async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: 'url is required' });
    
    const current = await fetchPage(url);
    const urlHash = createHash('md5').update(url).digest('hex');
    const previous = SNAPSHOTS.get(urlHash);
    
    // Store current as new snapshot
    SNAPSHOTS.set(urlHash, current);
    
    if (!previous) {
      return res.json({
        url,
        firstSnapshot: true,
        message: 'First snapshot captured. Call again to compare.',
        current: {
          title: current.title,
          wordCount: current.text.split(/\s+/).length,
          links: current.links.length,
          images: current.images.length,
          fetchedAt: current.fetchedAt,
        },
      });
    }
    
    const textDiff = computeDiff(previous.text, current.text);
    const linkDiff = diffLinks(previous.links, current.links);
    const metaDiff = diffMeta(previous.meta, current.meta);
    const titleChanged = previous.title !== current.title;
    
    res.json({
      url,
      changed: textDiff.changed || titleChanged || linkDiff.added.length > 0 || linkDiff.removed.length > 0,
      previous: { fetchedAt: previous.fetchedAt, title: previous.title },
      current: { fetchedAt: current.fetchedAt, title: current.title },
      titleChanged: titleChanged ? { from: previous.title, to: current.title } : null,
      textDiff,
      linkChanges: linkDiff,
      metaChanges: metaDiff,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to compare', message: err.message });
  }
});

// POST /api/diff/urls — Compare two different URLs
pageDiffRouter.post('/urls', async (req, res) => {
  try {
    const { url1, url2 } = req.body;
    if (!url1 || !url2) return res.status(400).json({ error: 'url1 and url2 are required' });
    
    const [page1, page2] = await Promise.all([fetchPage(url1), fetchPage(url2)]);
    
    const textDiff = computeDiff(page1.text, page2.text);
    const linkDiff = diffLinks(page1.links, page2.links);
    const metaDiff = diffMeta(page1.meta, page2.meta);
    
    res.json({
      url1,
      url2,
      page1: { title: page1.title, wordCount: page1.text.split(/\s+/).length, fetchedAt: page1.fetchedAt },
      page2: { title: page2.title, wordCount: page2.text.split(/\s+/).length, fetchedAt: page2.fetchedAt },
      textDiff,
      linkChanges: linkDiff,
      metaChanges: metaDiff,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to compare URLs', message: err.message });
  }
});
