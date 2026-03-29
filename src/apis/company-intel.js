/**
 * Company Intelligence API — The flagship endpoint
 * 
 * One API call, one domain → complete company profile.
 * This is what Hunter.io ($49-399/mo), Clearbit ($99-999/mo), 
 * and Apollo.io ($49-119/mo) charge big money for.
 * 
 * We build it with public data sources at near-zero cost.
 * 
 * Endpoints:
 *   GET /api/intel/company?domain=stripe.com
 *   GET /api/intel/batch (POST with array of domains)
 *   GET /api/intel/tech?domain=stripe.com
 */

import { Router } from 'express';
import * as cheerio from 'cheerio';

export const companyIntelRouter = Router();

const CACHE = new Map();
const CACHE_TTL = 4 * 60 * 60 * 1000; // 4hr cache

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

function cleanDomain(input) {
  return input.replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/^www\./, '').toLowerCase().trim();
}

async function safeFetch(url, options = {}) {
  try {
    const res = await fetch(url, {
      ...options,
      signal: AbortSignal.timeout(options.timeout || 10000),
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        ...options.headers,
      },
    });
    return res;
  } catch {
    return null;
  }
}

// Extract meta info from homepage
async function scrapeHomepage(domain) {
  const res = await safeFetch(`https://${domain}`);
  if (!res || !res.ok) return null;

  const html = await res.text();
  const $ = cheerio.load(html);

  const title = $('title').text().trim();
  const description = $('meta[name="description"]').attr('content') 
    || $('meta[property="og:description"]').attr('content') || '';
  const ogImage = $('meta[property="og:image"]').attr('content') || '';
  const ogTitle = $('meta[property="og:title"]').attr('content') || '';
  const favicon = $('link[rel="icon"]').attr('href') 
    || $('link[rel="shortcut icon"]').attr('href') || `/favicon.ico`;

  // Find social links
  const socials = {};
  const socialPatterns = {
    twitter: /twitter\.com\/([^"'\s/]+)/i,
    linkedin: /linkedin\.com\/(company|in)\/([^"'\s/]+)/i,
    facebook: /facebook\.com\/([^"'\s/]+)/i,
    instagram: /instagram\.com\/([^"'\s/]+)/i,
    github: /github\.com\/([^"'\s/]+)/i,
    youtube: /youtube\.com\/(channel|c|@)\/([^"'\s/]+)/i,
  };

  for (const [platform, regex] of Object.entries(socialPatterns)) {
    const match = html.match(regex);
    if (match) {
      socials[platform] = match[0].startsWith('http') ? match[0] : `https://${match[0]}`;
    }
  }

  // Find emails on homepage
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const emails = [...new Set((html.match(emailRegex) || [])
    .map(e => e.toLowerCase())
    .filter(e => !e.includes('.png') && !e.includes('.jpg') && !e.includes('.gif')
      && !e.includes('example.com') && !e.includes('email.com')
      && !e.includes('wixpress') && !e.includes('sentry.io')
    ))];

  // Find phone numbers
  const phoneRegex = /(?:\+1[-.\s]?)?\(?[2-9]\d{2}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g;
  const phones = [...new Set((html.match(phoneRegex) || []).slice(0, 3))];

  // Detect tech from HTML/headers
  const techSignals = [];
  if (html.includes('wp-content') || html.includes('wordpress')) techSignals.push('WordPress');
  if (html.includes('shopify')) techSignals.push('Shopify');
  if (html.includes('squarespace')) techSignals.push('Squarespace');
  if (html.includes('wix.com') || html.includes('wixsite')) techSignals.push('Wix');
  if (html.includes('webflow')) techSignals.push('Webflow');
  if (html.includes('react') || html.includes('__NEXT_DATA__')) techSignals.push('React');
  if (html.includes('vue') || html.includes('__VUE__')) techSignals.push('Vue.js');
  if (html.includes('angular')) techSignals.push('Angular');
  if (html.includes('gatsby')) techSignals.push('Gatsby');
  if (html.includes('nuxt')) techSignals.push('Nuxt.js');
  if (html.includes('hubspot')) techSignals.push('HubSpot');
  if (html.includes('intercom')) techSignals.push('Intercom');
  if (html.includes('zendesk')) techSignals.push('Zendesk');
  if (html.includes('drift')) techSignals.push('Drift');
  if (html.includes('google-analytics') || html.includes('gtag')) techSignals.push('Google Analytics');
  if (html.includes('googletagmanager')) techSignals.push('Google Tag Manager');
  if (html.includes('hotjar')) techSignals.push('Hotjar');
  if (html.includes('segment')) techSignals.push('Segment');
  if (html.includes('mixpanel')) techSignals.push('Mixpanel');
  if (html.includes('stripe')) techSignals.push('Stripe');
  if (html.includes('cloudflare')) techSignals.push('Cloudflare');
  if (html.includes('vercel')) techSignals.push('Vercel');
  if (html.includes('netlify')) techSignals.push('Netlify');

  // Response headers tech detection
  const serverHeader = res.headers.get('server') || '';
  const poweredBy = res.headers.get('x-powered-by') || '';
  if (serverHeader) techSignals.push(`Server: ${serverHeader}`);
  if (poweredBy) techSignals.push(`Powered-by: ${poweredBy}`);

  return {
    title,
    ogTitle,
    description,
    ogImage: ogImage ? (ogImage.startsWith('http') ? ogImage : `https://${domain}${ogImage}`) : null,
    favicon: favicon.startsWith('http') ? favicon : `https://${domain}${favicon}`,
    socials,
    emails,
    phones,
    techSignals: [...new Set(techSignals)],
  };
}

// DNS + infrastructure data
async function getDnsProfile(domain) {
  const recordTypes = ['A', 'MX', 'NS', 'TXT'];
  const results = {};

  await Promise.all(recordTypes.map(async (type) => {
    try {
      const res = await fetch(`https://dns.google/resolve?name=${domain}&type=${type}`, {
        signal: AbortSignal.timeout(5000),
      });
      const data = await res.json();
      if (data.Answer?.length > 0) {
        const typeMap = { A: 1, MX: 15, NS: 2, TXT: 16 };
        results[type] = data.Answer
          .filter(a => a.type === typeMap[type])
          .map(a => a.data?.replace(/^"|"$/g, ''));
      }
    } catch {}
  }));

  // Derive providers
  const providers = {};

  if (results.MX) {
    const mx = results.MX.join(' ').toLowerCase();
    if (mx.includes('google')) providers.email = 'Google Workspace';
    else if (mx.includes('outlook') || mx.includes('microsoft')) providers.email = 'Microsoft 365';
    else if (mx.includes('zoho')) providers.email = 'Zoho';
    else if (mx.includes('proton')) providers.email = 'ProtonMail';
    else providers.email = 'Other';
  }

  if (results.NS) {
    const ns = results.NS.join(' ').toLowerCase();
    if (ns.includes('cloudflare')) providers.dns = 'Cloudflare';
    else if (ns.includes('awsdns')) providers.dns = 'AWS Route 53';
    else if (ns.includes('google')) providers.dns = 'Google Cloud DNS';
    else if (ns.includes('domaincontrol') || ns.includes('godaddy')) providers.dns = 'GoDaddy';
    else providers.dns = 'Other';
  }

  // SPF & DMARC
  const security = {};
  if (results.TXT) {
    security.spf = results.TXT.some(r => r?.includes('v=spf1'));
  }
  try {
    const dmarcRes = await fetch(`https://dns.google/resolve?name=_dmarc.${domain}&type=TXT`, {
      signal: AbortSignal.timeout(5000),
    });
    const dmarcData = await dmarcRes.json();
    security.dmarc = (dmarcData.Answer || []).some(a => a.data?.includes('v=DMARC1'));
  } catch { security.dmarc = null; }

  return { providers, security, ip: results.A?.[0] || null };
}

// RDAP/WHOIS data
async function getRegistrationInfo(domain) {
  const tld = domain.split('.').pop();
  const servers = [
    `https://rdap.verisign.com/${tld}/v1/domain/${domain}`,
    `https://rdap.org/domain/${domain}`,
  ];

  for (const url of servers) {
    try {
      const res = await fetch(url, {
        headers: { 'Accept': 'application/rdap+json' },
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) continue;
      const data = await res.json();

      const result = { registrar: null, registered: null, expires: null };
      
      if (data.events) {
        for (const event of data.events) {
          if (event.eventAction === 'registration') result.registered = event.eventDate;
          if (event.eventAction === 'expiration') result.expires = event.eventDate;
        }
      }
      if (data.entities) {
        for (const entity of data.entities) {
          if (entity.roles?.includes('registrar')) {
            result.registrar = entity.vcardArray?.[1]?.find(v => v[0] === 'fn')?.[3]
              || entity.handle || 'Unknown';
          }
        }
      }

      // Calculate domain age
      if (result.registered) {
        const regDate = new Date(result.registered);
        const now = new Date();
        const years = Math.floor((now - regDate) / (365.25 * 24 * 60 * 60 * 1000));
        result.domainAge = `${years} years`;
      }

      return result;
    } catch { continue; }
  }
  return null;
}

// Scrape additional pages for more data
async function scrapeContactPage(domain) {
  const paths = ['/contact', '/contact-us', '/about', '/about-us'];
  const emails = new Set();
  const phones = new Set();
  const addresses = [];

  for (const path of paths) {
    const res = await safeFetch(`https://${domain}${path}`);
    if (!res || !res.ok) continue;

    const html = await res.text();
    
    // Emails
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    (html.match(emailRegex) || []).forEach(e => {
      const email = e.toLowerCase();
      if (!email.includes('.png') && !email.includes('.jpg') && !email.includes('example.com')
        && !email.includes('wixpress') && !email.includes('sentry')) {
        emails.add(email);
      }
    });

    // Phones  
    const phoneRegex = /(?:\+1[-.\s]?)?\(?[2-9]\d{2}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g;
    (html.match(phoneRegex) || []).forEach(p => phones.add(p));
  }

  return {
    emails: [...emails],
    phones: [...phones],
  };
}

// Main company intelligence endpoint
companyIntelRouter.get('/company', async (req, res) => {
  try {
    const { domain } = req.query;
    if (!domain) return res.status(400).json({ error: 'Missing required parameter: domain' });

    const clean = cleanDomain(domain);
    const cacheKey = `intel:${clean}`;
    const hit = cached(cacheKey);
    if (hit) return res.json(hit);

    // Run all lookups in parallel
    const [homepage, dns, registration, contacts] = await Promise.allSettled([
      scrapeHomepage(clean),
      getDnsProfile(clean),
      getRegistrationInfo(clean),
      scrapeContactPage(clean),
    ]);

    const hp = homepage.status === 'fulfilled' ? homepage.value : null;
    const dnsData = dns.status === 'fulfilled' ? dns.value : null;
    const regData = registration.status === 'fulfilled' ? registration.value : null;
    const contactData = contacts.status === 'fulfilled' ? contacts.value : null;

    // Merge emails from all sources
    const allEmails = [...new Set([
      ...(hp?.emails || []),
      ...(contactData?.emails || []),
    ])];

    const allPhones = [...new Set([
      ...(hp?.phones || []),
      ...(contactData?.phones || []),
    ])];

    const result = {
      domain: clean,
      company: {
        name: hp?.ogTitle || hp?.title?.split(/[-|–—]/)[0]?.trim() || clean,
        description: hp?.description || null,
        logo: hp?.ogImage || hp?.favicon || null,
      },
      contact: {
        emails: allEmails,
        phones: allPhones,
        socials: hp?.socials || {},
      },
      technology: {
        stack: hp?.techSignals || [],
        emailProvider: dnsData?.providers?.email || null,
        dnsProvider: dnsData?.providers?.dns || null,
        hosting: dnsData?.ip || null,
      },
      security: {
        spf: dnsData?.security?.spf || false,
        dmarc: dnsData?.security?.dmarc || false,
      },
      domain: {
        name: clean,
        registrar: regData?.registrar || null,
        registered: regData?.registered || null,
        expires: regData?.expires || null,
        age: regData?.domainAge || null,
      },
      queriedAt: new Date().toISOString(),
    };

    setCache(cacheKey, result);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Company intelligence lookup failed', detail: err.message });
  }
});

// Batch lookup — up to 10 domains at once
companyIntelRouter.post('/batch', async (req, res) => {
  try {
    const { domains } = req.body;
    if (!domains || !Array.isArray(domains)) {
      return res.status(400).json({ error: 'Missing required parameter: domains (array)' });
    }
    if (domains.length > 10) {
      return res.status(400).json({ error: 'Maximum 10 domains per batch request' });
    }

    const results = await Promise.allSettled(
      domains.map(async (d) => {
        const clean = cleanDomain(d);
        const cacheKey = `intel:${clean}`;
        const hit = cached(cacheKey);
        if (hit) return hit;

        const [homepage, dns, registration] = await Promise.allSettled([
          scrapeHomepage(clean),
          getDnsProfile(clean),
          getRegistrationInfo(clean),
        ]);

        const hp = homepage.status === 'fulfilled' ? homepage.value : null;
        const dnsData = dns.status === 'fulfilled' ? dns.value : null;
        const regData = registration.status === 'fulfilled' ? registration.value : null;

        const result = {
          domain: clean,
          company: {
            name: hp?.ogTitle || hp?.title?.split(/[-|–—]/)[0]?.trim() || clean,
            description: hp?.description || null,
          },
          contact: {
            emails: hp?.emails || [],
            phones: hp?.phones || [],
            socials: hp?.socials || {},
          },
          technology: {
            stack: hp?.techSignals || [],
            emailProvider: dnsData?.providers?.email || null,
          },
          domain: {
            registrar: regData?.registrar || null,
            age: regData?.domainAge || null,
          },
        };

        setCache(cacheKey, result);
        return result;
      })
    );

    res.json({
      results: results.map((r, i) => ({
        domain: domains[i],
        status: r.status,
        data: r.status === 'fulfilled' ? r.value : null,
        error: r.status === 'rejected' ? r.reason?.message : null,
      })),
      queriedAt: new Date().toISOString(),
    });
  } catch (err) {
    res.status(500).json({ error: 'Batch lookup failed', detail: err.message });
  }
});

// Quick tech stack check
companyIntelRouter.get('/tech', async (req, res) => {
  try {
    const { domain } = req.query;
    if (!domain) return res.status(400).json({ error: 'Missing required parameter: domain' });

    const clean = cleanDomain(domain);
    const [homepage, dns] = await Promise.allSettled([
      scrapeHomepage(clean),
      getDnsProfile(clean),
    ]);

    const hp = homepage.status === 'fulfilled' ? homepage.value : null;
    const dnsData = dns.status === 'fulfilled' ? dns.value : null;

    res.json({
      domain: clean,
      stack: hp?.techSignals || [],
      emailProvider: dnsData?.providers?.email || null,
      dnsProvider: dnsData?.providers?.dns || null,
      hosting: dnsData?.ip || null,
      security: dnsData?.security || {},
      queriedAt: new Date().toISOString(),
    });
  } catch (err) {
    res.status(500).json({ error: 'Tech stack check failed', detail: err.message });
  }
});
