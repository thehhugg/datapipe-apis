/**
 * Domain Age & History API
 * Check domain registration age, expiry, registrar info.
 * Hugely popular on RapidAPI — trust/authority scoring.
 */

import { Router } from 'express';

const router = Router();

const cache = new Map();
const CACHE_TTL = 30 * 60 * 1000; // 30 min

function getCached(key) {
  const entry = cache.get(key);
  if (entry && Date.now() - entry.ts < CACHE_TTL) return entry.data;
  cache.delete(key);
  return null;
}

function setCache(key, data) {
  cache.set(key, { data, ts: Date.now() });
  if (cache.size > 1000) {
    const oldest = cache.keys().next().value;
    cache.delete(oldest);
  }
}

/**
 * Parse RDAP response for domain age info
 */
function parseRdap(rdap) {
  const events = rdap.events || [];
  const created = events.find(e => e.eventAction === 'registration')?.eventDate;
  const updated = events.find(e => e.eventAction === 'last changed')?.eventDate;
  const expires = events.find(e => e.eventAction === 'expiration')?.eventDate;
  
  // Get registrar from entities
  let registrar = null;
  const entities = rdap.entities || [];
  for (const entity of entities) {
    if (entity.roles?.includes('registrar')) {
      registrar = entity.vcardArray?.[1]?.find(v => v[0] === 'fn')?.[3] 
        || entity.handle 
        || null;
    }
  }
  
  // Calculate age
  let ageInDays = null;
  let ageInYears = null;
  if (created) {
    const createdDate = new Date(created);
    const now = new Date();
    ageInDays = Math.floor((now - createdDate) / (1000 * 60 * 60 * 24));
    ageInYears = parseFloat((ageInDays / 365.25).toFixed(1));
  }
  
  // Days until expiry
  let daysUntilExpiry = null;
  if (expires) {
    const expiryDate = new Date(expires);
    daysUntilExpiry = Math.floor((expiryDate - new Date()) / (1000 * 60 * 60 * 24));
  }
  
  return {
    createdDate: created || null,
    updatedDate: updated || null,
    expiryDate: expires || null,
    registrar,
    ageInDays,
    ageInYears,
    daysUntilExpiry,
    status: rdap.status || [],
    nameservers: (rdap.nameservers || []).map(ns => ns.ldhName || ns.unicodeName).filter(Boolean),
  };
}

/**
 * GET /check?domain=example.com
 * Get domain age and registration details
 */
router.get('/check', async (req, res) => {
  try {
    let { domain } = req.query;
    if (!domain) {
      return res.status(400).json({ error: 'domain parameter required' });
    }
    
    // Clean domain
    domain = domain.replace(/^https?:\/\//, '').replace(/\/.*$/, '').toLowerCase();
    
    const cached = getCached(`age:${domain}`);
    if (cached) return res.json({ ...cached, cached: true });
    
    // Try RDAP first (newer, structured)
    const tld = domain.split('.').pop();
    const rdapServers = {
      com: 'https://rdap.verisign.com/com/v1',
      net: 'https://rdap.verisign.com/net/v1',
      org: 'https://rdap.org/org/v1',
      io: 'https://rdap.nic.io/domain',
      dev: 'https://rdap.nic.google/domain',
      app: 'https://rdap.nic.google/domain',
    };
    
    let rdapBase = rdapServers[tld];
    
    // Fallback: IANA bootstrap
    if (!rdapBase) {
      try {
        const bootstrap = await fetch('https://data.iana.org/rdap/dns.json', {
          signal: AbortSignal.timeout(5000),
        });
        const data = await bootstrap.json();
        for (const service of data.services) {
          if (service[0].includes(tld)) {
            rdapBase = service[1][0];
            break;
          }
        }
      } catch (e) { /* fallback below */ }
    }
    
    if (!rdapBase) {
      return res.status(400).json({ 
        error: `RDAP not available for .${tld} domains`,
        supported: Object.keys(rdapServers),
      });
    }
    
    const rdapUrl = rdapBase.endsWith('/domain') 
      ? `${rdapBase}/${domain}` 
      : `${rdapBase}/domain/${domain}`;
    
    const response = await fetch(rdapUrl, {
      headers: { 'Accept': 'application/rdap+json' },
      signal: AbortSignal.timeout(10000),
    });
    
    if (!response.ok) {
      if (response.status === 404) {
        return res.json({
          domain,
          registered: false,
          message: 'Domain is not registered or RDAP data unavailable',
        });
      }
      return res.status(502).json({ error: `RDAP returned ${response.status}` });
    }
    
    const rdap = await response.json();
    const info = parseRdap(rdap);
    
    // Trust score based on age
    let trustScore = 0;
    if (info.ageInYears !== null) {
      if (info.ageInYears >= 10) trustScore = 90;
      else if (info.ageInYears >= 5) trustScore = 75;
      else if (info.ageInYears >= 2) trustScore = 60;
      else if (info.ageInYears >= 1) trustScore = 40;
      else if (info.ageInYears >= 0.5) trustScore = 25;
      else trustScore = 10;
    }
    
    // Adjust for other signals
    if (info.daysUntilExpiry && info.daysUntilExpiry > 365) trustScore = Math.min(100, trustScore + 5);
    if (info.nameservers.length > 0) trustScore = Math.min(100, trustScore + 5);
    
    const data = {
      domain,
      registered: true,
      ...info,
      trustScore,
      trustLevel: trustScore >= 75 ? 'high' : trustScore >= 40 ? 'medium' : 'low',
      checkedAt: new Date().toISOString(),
    };
    
    setCache(`age:${domain}`, data);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /bulk
 * Check multiple domains at once (up to 20)
 */
router.post('/bulk', async (req, res) => {
  try {
    const { domains } = req.body;
    if (!Array.isArray(domains) || domains.length === 0) {
      return res.status(400).json({ error: 'domains array required' });
    }
    if (domains.length > 20) {
      return res.status(400).json({ error: 'Maximum 20 domains per request' });
    }
    
    const results = await Promise.allSettled(
      domains.map(async (domain) => {
        domain = domain.replace(/^https?:\/\//, '').replace(/\/.*$/, '').toLowerCase();
        const cached = getCached(`age:${domain}`);
        if (cached) return { ...cached, cached: true };
        
        const tld = domain.split('.').pop();
        const rdapServers = {
          com: 'https://rdap.verisign.com/com/v1',
          net: 'https://rdap.verisign.com/net/v1',
          org: 'https://rdap.org/org/v1',
        };
        const rdapBase = rdapServers[tld];
        if (!rdapBase) return { domain, error: `Unsupported TLD: .${tld}` };
        
        const r = await fetch(`${rdapBase}/domain/${domain}`, {
          headers: { 'Accept': 'application/rdap+json' },
          signal: AbortSignal.timeout(10000),
        });
        if (!r.ok) return { domain, registered: false };
        
        const rdap = await r.json();
        const info = parseRdap(rdap);
        const data = { domain, registered: true, ...info };
        setCache(`age:${domain}`, data);
        return data;
      })
    );
    
    res.json({
      results: results.map((r, i) => 
        r.status === 'fulfilled' ? r.value : { domain: domains[i], error: r.reason?.message }
      ),
      checkedAt: new Date().toISOString(),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export { router as domainAgeRouter };
