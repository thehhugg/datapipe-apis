/**
 * Email Finder API — Discover business email addresses
 * 
 * Uses public sources: website scraping, common patterns, WHOIS
 * No paid APIs required.
 * 
 * Endpoints:
 *   GET /api/email-finder/domain?domain=example.com
 *   GET /api/email-finder/pattern?domain=example.com&name=John+Smith
 *   GET /api/email-finder/verify?email=john@example.com
 */

import { Router } from 'express';
import * as cheerio from 'cheerio';

export const emailFinderRouter = Router();

const CACHE = new Map();
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24hr cache for email data

function cached(key) {
  const entry = CACHE.get(key);
  if (entry && Date.now() - entry.ts < CACHE_TTL) return entry.data;
  return null;
}

function setCache(key, data) {
  CACHE.set(key, { data, ts: Date.now() });
  if (CACHE.size > 1000) {
    const oldest = [...CACHE.entries()].sort((a, b) => a[1].ts - b[1].ts);
    oldest.slice(0, 200).forEach(([k]) => CACHE.delete(k));
  }
}

// Common email patterns
const EMAIL_PATTERNS = [
  (first, last) => `${first}@`,
  (first, last) => `${last}@`,
  (first, last) => `${first}.${last}@`,
  (first, last) => `${first[0]}${last}@`,
  (first, last) => `${first}${last[0]}@`,
  (first, last) => `${first}_${last}@`,
  (first, last) => `${first}-${last}@`,
  (first, last) => `${first[0]}.${last}@`,
];

// Scrape emails from a website
async function scrapeEmailsFromSite(domain) {
  const cacheKey = `emails:${domain}`;
  const hit = cached(cacheKey);
  if (hit) return hit;

  const emails = new Set();
  const pagesChecked = [];
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

  // Check common pages
  const paths = ['/', '/contact', '/about', '/team', '/contact-us', '/about-us'];
  
  for (const path of paths) {
    try {
      const url = `https://${domain}${path}`;
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        },
        signal: AbortSignal.timeout(8000),
        redirect: 'follow',
      });

      if (!res.ok) continue;
      pagesChecked.push(path);

      const html = await res.text();
      
      // Find emails in HTML
      const found = html.match(emailRegex) || [];
      found.forEach(e => {
        const email = e.toLowerCase();
        // Filter out common false positives
        if (!email.includes('example.com') && 
            !email.includes('placeholder') &&
            !email.endsWith('.png') &&
            !email.endsWith('.jpg') &&
            !email.includes('wixpress') &&
            !email.includes('sentry.io')) {
          emails.add(email);
        }
      });

      // Check mailto: links
      const $ = cheerio.load(html);
      $('a[href^="mailto:"]').each((_, el) => {
        const mailto = $(el).attr('href').replace('mailto:', '').split('?')[0].trim().toLowerCase();
        if (mailto && mailto.includes('@')) emails.add(mailto);
      });

    } catch { /* skip failed pages */ }
  }

  const result = {
    domain,
    emails: [...emails],
    pagesChecked,
    confidence: emails.size > 0 ? 'found' : 'none_found',
  };

  setCache(cacheKey, result);
  return result;
}

// Generate email pattern guesses
function generatePatterns(firstName, lastName, domain) {
  const first = firstName.toLowerCase().replace(/[^a-z]/g, '');
  const last = lastName.toLowerCase().replace(/[^a-z]/g, '');
  
  if (!first || !last) return [];

  return EMAIL_PATTERNS.map(fn => {
    const local = fn(first, last);
    return `${local}${domain}`;
  });
}

// Basic MX record check via DNS-over-HTTPS
async function checkMXRecord(domain) {
  try {
    const res = await fetch(`https://dns.google/resolve?name=${domain}&type=MX`, {
      signal: AbortSignal.timeout(5000),
    });
    const data = await res.json();
    const mxRecords = (data.Answer || [])
      .filter(a => a.type === 15)
      .map(a => a.data?.split(' ').pop()?.replace(/\.$/, ''))
      .filter(Boolean);
    
    return {
      hasMX: mxRecords.length > 0,
      records: mxRecords,
      provider: mxRecords.some(r => r.includes('google')) ? 'Google Workspace'
        : mxRecords.some(r => r.includes('outlook') || r.includes('microsoft')) ? 'Microsoft 365'
        : mxRecords.some(r => r.includes('zoho')) ? 'Zoho Mail'
        : mxRecords.some(r => r.includes('proton')) ? 'ProtonMail'
        : mxRecords.length > 0 ? 'Other' : 'None',
    };
  } catch {
    return { hasMX: null, records: [], provider: 'unknown' };
  }
}

// GET /api/email-finder/domain
emailFinderRouter.get('/domain', async (req, res) => {
  try {
    const { domain } = req.query;
    if (!domain) return res.status(400).json({ error: 'Missing required parameter: domain' });

    const cleanDomain = domain.replace(/^https?:\/\//, '').replace(/\/.*$/, '').toLowerCase();

    const [emailResult, mxResult] = await Promise.allSettled([
      scrapeEmailsFromSite(cleanDomain),
      checkMXRecord(cleanDomain),
    ]);

    res.json({
      domain: cleanDomain,
      emails: emailResult.status === 'fulfilled' ? emailResult.value.emails : [],
      pagesChecked: emailResult.status === 'fulfilled' ? emailResult.value.pagesChecked : [],
      mx: mxResult.status === 'fulfilled' ? mxResult.value : null,
    });
  } catch (err) {
    res.status(500).json({ error: 'Email search failed', detail: err.message });
  }
});

// GET /api/email-finder/pattern
emailFinderRouter.get('/pattern', async (req, res) => {
  try {
    const { domain, name } = req.query;
    if (!domain || !name) {
      return res.status(400).json({ error: 'Missing required parameters: domain, name (e.g., "John Smith")' });
    }

    const cleanDomain = domain.replace(/^https?:\/\//, '').replace(/\/.*$/, '').toLowerCase();
    const nameParts = name.trim().split(/\s+/);
    const firstName = nameParts[0];
    const lastName = nameParts[nameParts.length - 1];

    const patterns = generatePatterns(firstName, lastName, cleanDomain);
    const mxResult = await checkMXRecord(cleanDomain);

    // Try to find which pattern matches by scraping known emails
    const siteEmails = await scrapeEmailsFromSite(cleanDomain);
    let detectedPattern = null;
    
    if (siteEmails.emails.length > 0) {
      // Analyze found emails to detect pattern
      const foundEmail = siteEmails.emails.find(e => e.endsWith(`@${cleanDomain}`));
      if (foundEmail) {
        const local = foundEmail.split('@')[0];
        if (local.includes('.')) detectedPattern = 'first.last';
        else if (local.length <= 3) detectedPattern = 'initials';
        else detectedPattern = 'first or last';
      }
    }

    res.json({
      name,
      domain: cleanDomain,
      patterns: patterns.map((email, i) => ({
        email,
        confidence: i < 3 ? 'high' : 'medium',
      })),
      detectedPattern,
      mx: mxResult,
      knownEmails: siteEmails.emails.slice(0, 5),
    });
  } catch (err) {
    res.status(500).json({ error: 'Pattern generation failed', detail: err.message });
  }
});

// GET /api/email-finder/verify (basic check — MX + format only)
emailFinderRouter.get('/verify', async (req, res) => {
  try {
    const { email } = req.query;
    if (!email) return res.status(400).json({ error: 'Missing required parameter: email' });

    const emailLower = email.toLowerCase().trim();
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    
    if (!emailRegex.test(emailLower)) {
      return res.json({ email: emailLower, valid: false, reason: 'Invalid format' });
    }

    const domain = emailLower.split('@')[1];
    const mx = await checkMXRecord(domain);

    res.json({
      email: emailLower,
      formatValid: true,
      mxValid: mx.hasMX,
      provider: mx.provider,
      note: 'This checks format and MX records only. It does not verify the specific mailbox exists.',
    });
  } catch (err) {
    res.status(500).json({ error: 'Verification failed', detail: err.message });
  }
});
