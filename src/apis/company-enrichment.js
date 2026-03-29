/**
 * Company Enrichment API — All-in-one company data from a domain
 * 
 * Combines tech stack, emails, DNS, SSL, social links into one call.
 * This is the PREMIUM API — high value, high demand on RapidAPI.
 * Competitors charge $0.01-0.05/call for similar data.
 * 
 * Endpoints:
 *   GET /api/enrich/company?domain=stripe.com
 *   GET /api/enrich/bulk (POST with { domains: [...] })
 */

import { Router } from 'express';
import * as cheerio from 'cheerio';

export const companyEnrichmentRouter = Router();

const CACHE = new Map();
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24hr cache

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

// Scrape company info from website
async function scrapeCompanyInfo(domain) {
  const urls = [`https://${domain}`, `https://www.${domain}`];
  
  for (const url of urls) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' },
        signal: AbortSignal.timeout(10000),
        redirect: 'follow',
      });
      
      if (!res.ok) continue;
      const html = await res.text();
      const $ = cheerio.load(html);
      
      const info = {
        title: $('title').text().trim() || null,
        description: $('meta[name="description"]').attr('content') 
          || $('meta[property="og:description"]').attr('content') || null,
        favicon: $('link[rel="icon"]').attr('href') || $('link[rel="shortcut icon"]').attr('href') || null,
        language: $('html').attr('lang') || null,
        socialLinks: {},
        emails: [],
        phones: [],
      };
      
      // Extract social links
      const socialPatterns = {
        twitter: /twitter\.com\/|x\.com\//i,
        linkedin: /linkedin\.com\//i,
        facebook: /facebook\.com\//i,
        instagram: /instagram\.com\//i,
        github: /github\.com\//i,
        youtube: /youtube\.com\//i,
        tiktok: /tiktok\.com\//i,
      };
      
      $('a[href]').each((_, el) => {
        const href = $(el).attr('href');
        if (!href) return;
        for (const [platform, pattern] of Object.entries(socialPatterns)) {
          if (pattern.test(href) && !info.socialLinks[platform]) {
            info.socialLinks[platform] = href;
          }
        }
      });
      
      // Extract emails
      const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
      const bodyText = $('body').text();
      const foundEmails = bodyText.match(emailRegex) || [];
      info.emails = [...new Set(foundEmails)].filter(e => 
        !e.includes('example.com') && 
        !e.includes('sentry') &&
        !e.endsWith('.png') && 
        !e.endsWith('.jpg')
      ).slice(0, 10);
      
      // Extract phone numbers
      const phoneRegex = /(?:\+1[-.\s]?)?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}/g;
      const phones = bodyText.match(phoneRegex) || [];
      info.phones = [...new Set(phones)].slice(0, 5);
      
      // Normalize favicon
      if (info.favicon && !info.favicon.startsWith('http')) {
        info.favicon = new URL(info.favicon, url).href;
      }
      
      return info;
    } catch { continue; }
  }
  return null;
}

// Get DNS/infrastructure info
async function getDnsInfo(domain) {
  const result = { mx: null, ns: null, emailProvider: null, dnsProvider: null, spf: false, dmarc: false };
  
  try {
    // MX records
    const mxRes = await fetch(`https://dns.google/resolve?name=${domain}&type=MX`, { signal: AbortSignal.timeout(5000) });
    const mxData = await mxRes.json();
    if (mxData.Answer) {
      result.mx = mxData.Answer.filter(a => a.type === 15).map(a => a.data);
      const mxStr = result.mx.join(' ').toLowerCase();
      if (mxStr.includes('google')) result.emailProvider = 'Google Workspace';
      else if (mxStr.includes('outlook') || mxStr.includes('microsoft')) result.emailProvider = 'Microsoft 365';
      else if (mxStr.includes('zoho')) result.emailProvider = 'Zoho';
      else if (mxStr.includes('proton')) result.emailProvider = 'ProtonMail';
      else result.emailProvider = 'Other';
    }
    
    // NS records
    const nsRes = await fetch(`https://dns.google/resolve?name=${domain}&type=NS`, { signal: AbortSignal.timeout(5000) });
    const nsData = await nsRes.json();
    if (nsData.Answer) {
      result.ns = nsData.Answer.filter(a => a.type === 2).map(a => a.data);
      const nsStr = result.ns.join(' ').toLowerCase();
      if (nsStr.includes('cloudflare')) result.dnsProvider = 'Cloudflare';
      else if (nsStr.includes('awsdns')) result.dnsProvider = 'AWS Route 53';
      else if (nsStr.includes('google')) result.dnsProvider = 'Google Cloud DNS';
      else if (nsStr.includes('domaincontrol')) result.dnsProvider = 'GoDaddy';
      else result.dnsProvider = 'Other';
    }
    
    // SPF
    const txtRes = await fetch(`https://dns.google/resolve?name=${domain}&type=TXT`, { signal: AbortSignal.timeout(5000) });
    const txtData = await txtRes.json();
    result.spf = (txtData.Answer || []).some(a => a.data?.includes('v=spf1'));
    
    // DMARC
    const dmarcRes = await fetch(`https://dns.google/resolve?name=_dmarc.${domain}&type=TXT`, { signal: AbortSignal.timeout(5000) });
    const dmarcData = await dmarcRes.json();
    result.dmarc = (dmarcData.Answer || []).some(a => a.data?.includes('v=DMARC1'));
  } catch { /* partial results are fine */ }
  
  return result;
}

// Detect tech stack (simplified version)
async function detectTechStack(domain) {
  try {
    const res = await fetch(`https://${domain}`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' },
      signal: AbortSignal.timeout(10000),
      redirect: 'follow',
    });
    
    const html = await res.text();
    const headers = Object.fromEntries(res.headers.entries());
    const techs = [];
    
    const checks = [
      { name: 'WordPress', test: () => /wp-content|wp-includes/i.test(html) },
      { name: 'Shopify', test: () => /cdn\.shopify\.com/i.test(html) },
      { name: 'React', test: () => /react|__next/i.test(html) || headers['x-powered-by']?.includes('Next') },
      { name: 'Next.js', test: () => /_next\//i.test(html) || headers['x-powered-by']?.includes('Next') },
      { name: 'Vue.js', test: () => /vue\.js|__nuxt/i.test(html) },
      { name: 'Angular', test: () => /ng-app|angular/i.test(html) },
      { name: 'jQuery', test: () => /jquery/i.test(html) },
      { name: 'Bootstrap', test: () => /bootstrap/i.test(html) },
      { name: 'Tailwind CSS', test: () => /tailwindcss|tailwind/i.test(html) },
      { name: 'Google Analytics', test: () => /google-analytics|gtag|googletagmanager/i.test(html) },
      { name: 'Google Tag Manager', test: () => /googletagmanager\.com\/gtm/i.test(html) },
      { name: 'HubSpot', test: () => /hs-scripts\.com|hubspot/i.test(html) },
      { name: 'Intercom', test: () => /intercom/i.test(html) },
      { name: 'Drift', test: () => /drift\.com/i.test(html) },
      { name: 'Zendesk', test: () => /zendesk/i.test(html) },
      { name: 'Stripe', test: () => /js\.stripe\.com/i.test(html) },
      { name: 'Cloudflare', test: () => headers.server?.toLowerCase().includes('cloudflare') },
      { name: 'nginx', test: () => headers.server?.toLowerCase().includes('nginx') },
      { name: 'Apache', test: () => headers.server?.toLowerCase().includes('apache') },
      { name: 'Vercel', test: () => headers['x-vercel-id'] || headers.server?.includes('Vercel') },
      { name: 'Netlify', test: () => headers.server?.includes('Netlify') || headers['x-nf-request-id'] },
      { name: 'AWS', test: () => headers.server?.includes('AmazonS3') || headers['x-amz-cf-id'] },
      { name: 'Segment', test: () => /cdn\.segment\.com|analytics\.js/i.test(html) },
      { name: 'Mixpanel', test: () => /mixpanel/i.test(html) },
      { name: 'Hotjar', test: () => /hotjar/i.test(html) },
      { name: 'Sentry', test: () => /sentry/i.test(html) },
      { name: 'Crisp', test: () => /crisp\.chat/i.test(html) },
      { name: 'Freshdesk', test: () => /freshdesk/i.test(html) },
      { name: 'Salesforce', test: () => /force\.com|salesforce/i.test(html) },
    ];
    
    for (const check of checks) {
      try { if (check.test()) techs.push(check.name); } catch {}
    }
    
    return { technologies: techs, server: headers.server || null, poweredBy: headers['x-powered-by'] || null };
  } catch {
    return { technologies: [], error: 'Could not fetch site' };
  }
}

// RDAP lookup for registration info
async function getRegistrationInfo(domain) {
  const tld = domain.split('.').pop();
  const servers = [
    `https://rdap.verisign.com/com/v1/domain/${domain}`,
    `https://rdap.verisign.com/net/v1/domain/${domain}`,
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
      
      const result = { registered: null, expires: null, registrar: null };
      for (const event of (data.events || [])) {
        if (event.eventAction === 'registration') result.registered = event.eventDate;
        if (event.eventAction === 'expiration') result.expires = event.eventDate;
      }
      for (const entity of (data.entities || [])) {
        if (entity.roles?.includes('registrar')) {
          result.registrar = entity.vcardArray?.[1]?.find(v => v[0] === 'fn')?.[3] || entity.handle || null;
        }
      }
      return result;
    } catch { continue; }
  }
  return null;
}

// GET /api/enrich/company
companyEnrichmentRouter.get('/company', async (req, res) => {
  try {
    const { domain } = req.query;
    if (!domain) return res.status(400).json({ error: 'Missing required parameter: domain' });
    
    const clean = cleanDomain(domain);
    const cacheKey = `enrich:${clean}`;
    const hit = cached(cacheKey);
    if (hit) return res.json(hit);
    
    // Run all lookups in parallel
    const [companyInfo, dns, techStack, registration] = await Promise.allSettled([
      scrapeCompanyInfo(clean),
      getDnsInfo(clean),
      detectTechStack(clean),
      getRegistrationInfo(clean),
    ]);
    
    const result = {
      domain: clean,
      company: companyInfo.status === 'fulfilled' ? companyInfo.value : null,
      infrastructure: {
        ...(dns.status === 'fulfilled' ? dns.value : {}),
        ...(techStack.status === 'fulfilled' ? techStack.value : {}),
      },
      registration: registration.status === 'fulfilled' ? registration.value : null,
      enrichedAt: new Date().toISOString(),
    };
    
    setCache(cacheKey, result);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Enrichment failed', detail: err.message });
  }
});

// POST /api/enrich/bulk
companyEnrichmentRouter.post('/bulk', async (req, res) => {
  try {
    const { domains } = req.body;
    if (!domains || !Array.isArray(domains)) {
      return res.status(400).json({ error: 'Request body must contain "domains" array' });
    }
    if (domains.length > 10) {
      return res.status(400).json({ error: 'Maximum 10 domains per bulk request' });
    }
    
    const results = await Promise.allSettled(
      domains.map(async (domain) => {
        const clean = cleanDomain(domain);
        const cacheKey = `enrich:${clean}`;
        const hit = cached(cacheKey);
        if (hit) return hit;
        
        const [companyInfo, dns, techStack] = await Promise.allSettled([
          scrapeCompanyInfo(clean),
          getDnsInfo(clean),
          detectTechStack(clean),
        ]);
        
        const result = {
          domain: clean,
          company: companyInfo.status === 'fulfilled' ? companyInfo.value : null,
          infrastructure: {
            ...(dns.status === 'fulfilled' ? dns.value : {}),
            ...(techStack.status === 'fulfilled' ? techStack.value : {}),
          },
          enrichedAt: new Date().toISOString(),
        };
        
        setCache(cacheKey, result);
        return result;
      })
    );
    
    res.json({
      count: results.length,
      data: results.map((r, i) => ({
        domain: domains[i],
        status: r.status === 'fulfilled' ? 'success' : 'error',
        data: r.status === 'fulfilled' ? r.value : { error: r.reason?.message },
      })),
    });
  } catch (err) {
    res.status(500).json({ error: 'Bulk enrichment failed', detail: err.message });
  }
});
