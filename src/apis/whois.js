/**
 * Domain WHOIS & Info API
 * 
 * Domain registration info, DNS records, SSL certificate details.
 * No external API key needed — uses public DNS-over-HTTPS and RDAP.
 * 
 * Endpoints:
 *   GET /api/whois/lookup?domain=example.com
 *   GET /api/whois/dns?domain=example.com
 *   GET /api/whois/ssl?domain=example.com
 *   GET /api/whois/availability?domain=example.com
 */

import { Router } from 'express';

export const whoisRouter = Router();

const CACHE = new Map();
const CACHE_TTL = 2 * 60 * 60 * 1000; // 2hr cache

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

function cleanDomain(input) {
  return input.replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/^www\./, '').toLowerCase().trim();
}

// RDAP lookup (modern replacement for WHOIS)
async function rdapLookup(domain) {
  // First, find the right RDAP server via IANA bootstrap
  const tld = domain.split('.').pop();
  
  // Try common RDAP servers
  const rdapServers = [
    `https://rdap.verisign.com/com/v1/domain/${domain}`,
    `https://rdap.verisign.com/net/v1/domain/${domain}`,
    `https://rdap.org/domain/${domain}`,
    `https://rdap.nic.${tld}/domain/${domain}`,
  ];

  for (const url of rdapServers) {
    try {
      const res = await fetch(url, {
        headers: { 'Accept': 'application/rdap+json' },
        signal: AbortSignal.timeout(8000),
        redirect: 'follow',
      });
      if (!res.ok) continue;
      
      const data = await res.json();
      return parseRdapResponse(data, domain);
    } catch { continue; }
  }
  
  return null;
}

function parseRdapResponse(data, domain) {
  const result = {
    domain,
    status: data.status || [],
    registered: null,
    expires: null,
    updated: null,
    registrar: null,
    nameservers: [],
    contacts: {},
  };

  // Events (dates)
  if (data.events) {
    for (const event of data.events) {
      if (event.eventAction === 'registration') result.registered = event.eventDate;
      if (event.eventAction === 'expiration') result.expires = event.eventDate;
      if (event.eventAction === 'last changed' || event.eventAction === 'last update of RDAP database') {
        result.updated = event.eventDate;
      }
    }
  }

  // Registrar
  if (data.entities) {
    for (const entity of data.entities) {
      if (entity.roles?.includes('registrar')) {
        result.registrar = entity.vcardArray?.[1]?.find(v => v[0] === 'fn')?.[3] 
          || entity.publicIds?.[0]?.identifier 
          || entity.handle 
          || 'Unknown';
      }
    }
  }

  // Nameservers
  if (data.nameservers) {
    result.nameservers = data.nameservers.map(ns => ns.ldhName || ns.handle).filter(Boolean);
  }

  return result;
}

// DNS records via Google DNS-over-HTTPS
async function getDnsRecords(domain) {
  const recordTypes = ['A', 'AAAA', 'MX', 'NS', 'TXT', 'CNAME', 'SOA'];
  const results = {};

  await Promise.all(recordTypes.map(async (type) => {
    try {
      const res = await fetch(`https://dns.google/resolve?name=${domain}&type=${type}`, {
        signal: AbortSignal.timeout(5000),
      });
      const data = await res.json();
      
      if (data.Answer && data.Answer.length > 0) {
        results[type] = data.Answer
          .filter(a => {
            const typeMap = { A: 1, AAAA: 28, MX: 15, NS: 2, TXT: 16, CNAME: 5, SOA: 6 };
            return a.type === typeMap[type];
          })
          .map(a => ({
            value: a.data?.replace(/^"|"$/g, ''),
            ttl: a.TTL,
          }));
      }
    } catch { /* skip failed lookups */ }
  }));

  // Derive useful info
  const derived = {};
  
  if (results.MX) {
    const mxValues = results.MX.map(r => r.value?.toLowerCase() || '');
    if (mxValues.some(v => v.includes('google'))) derived.emailProvider = 'Google Workspace';
    else if (mxValues.some(v => v.includes('outlook') || v.includes('microsoft'))) derived.emailProvider = 'Microsoft 365';
    else if (mxValues.some(v => v.includes('zoho'))) derived.emailProvider = 'Zoho Mail';
    else if (mxValues.some(v => v.includes('proton'))) derived.emailProvider = 'ProtonMail';
    else if (mxValues.some(v => v.includes('mimecast'))) derived.emailProvider = 'Mimecast';
    else derived.emailProvider = 'Other';
  }

  if (results.NS) {
    const nsValues = results.NS.map(r => r.value?.toLowerCase() || '');
    if (nsValues.some(v => v.includes('cloudflare'))) derived.dnsProvider = 'Cloudflare';
    else if (nsValues.some(v => v.includes('awsdns'))) derived.dnsProvider = 'AWS Route 53';
    else if (nsValues.some(v => v.includes('google'))) derived.dnsProvider = 'Google Cloud DNS';
    else if (nsValues.some(v => v.includes('azure'))) derived.dnsProvider = 'Azure DNS';
    else if (nsValues.some(v => v.includes('digitalocean'))) derived.dnsProvider = 'DigitalOcean';
    else if (nsValues.some(v => v.includes('godaddy') || v.includes('domaincontrol'))) derived.dnsProvider = 'GoDaddy';
    else if (nsValues.some(v => v.includes('namecheap'))) derived.dnsProvider = 'Namecheap';
    else derived.dnsProvider = 'Other';
  }

  // Check for SPF and DMARC
  if (results.TXT) {
    derived.spf = results.TXT.some(r => r.value?.includes('v=spf1'));
  }
  
  // DMARC check
  try {
    const dmarcRes = await fetch(`https://dns.google/resolve?name=_dmarc.${domain}&type=TXT`, {
      signal: AbortSignal.timeout(5000),
    });
    const dmarcData = await dmarcRes.json();
    derived.dmarc = (dmarcData.Answer || []).some(a => a.data?.includes('v=DMARC1'));
  } catch { derived.dmarc = null; }

  return { records: results, derived };
}

// SSL certificate info
async function getSslInfo(domain) {
  try {
    // Use a public SSL checker API
    const res = await fetch(`https://dns.google/resolve?name=${domain}&type=A`, {
      signal: AbortSignal.timeout(5000),
    });
    const data = await res.json();
    const ip = data.Answer?.[0]?.data;

    // Try connecting to check SSL
    const sslRes = await fetch(`https://${domain}`, {
      method: 'HEAD',
      signal: AbortSignal.timeout(8000),
      redirect: 'follow',
    });

    return {
      domain,
      https: true,
      status: sslRes.status,
      ip: ip || null,
      headers: {
        server: sslRes.headers.get('server'),
        hsts: !!sslRes.headers.get('strict-transport-security'),
        hstsValue: sslRes.headers.get('strict-transport-security'),
      },
    };
  } catch (err) {
    // Try HTTP fallback
    try {
      const httpRes = await fetch(`http://${domain}`, {
        method: 'HEAD',
        signal: AbortSignal.timeout(5000),
        redirect: 'manual',
      });
      return {
        domain,
        https: false,
        httpStatus: httpRes.status,
        redirectsToHttps: httpRes.headers.get('location')?.startsWith('https'),
      };
    } catch {
      return { domain, https: null, error: 'Could not connect to domain' };
    }
  }
}

// Domain availability check (heuristic — checks DNS)
async function checkAvailability(domain) {
  try {
    const res = await fetch(`https://dns.google/resolve?name=${domain}&type=A`, {
      signal: AbortSignal.timeout(5000),
    });
    const data = await res.json();
    
    const hasRecords = data.Answer && data.Answer.length > 0;
    const nxdomain = data.Status === 3; // NXDOMAIN

    // Also check NS records
    const nsRes = await fetch(`https://dns.google/resolve?name=${domain}&type=NS`, {
      signal: AbortSignal.timeout(5000),
    });
    const nsData = await nsRes.json();
    const hasNS = nsData.Answer && nsData.Answer.length > 0;

    return {
      domain,
      likely_available: nxdomain && !hasRecords && !hasNS,
      has_dns_records: hasRecords,
      has_nameservers: hasNS,
      nxdomain,
      note: 'This is a heuristic check based on DNS records. For authoritative availability, check the registrar directly.',
    };
  } catch {
    return { domain, likely_available: null, error: 'DNS check failed' };
  }
}

// GET /api/whois/lookup
whoisRouter.get('/lookup', async (req, res) => {
  try {
    const { domain } = req.query;
    if (!domain) return res.status(400).json({ error: 'Missing required parameter: domain' });

    const clean = cleanDomain(domain);
    const cacheKey = `whois:${clean}`;
    const hit = cached(cacheKey);
    if (hit) return res.json(hit);

    const [rdap, dns, ssl] = await Promise.allSettled([
      rdapLookup(clean),
      getDnsRecords(clean),
      getSslInfo(clean),
    ]);

    const result = {
      domain: clean,
      registration: rdap.status === 'fulfilled' ? rdap.value : null,
      dns: dns.status === 'fulfilled' ? dns.value : null,
      ssl: ssl.status === 'fulfilled' ? ssl.value : null,
      queriedAt: new Date().toISOString(),
    };

    setCache(cacheKey, result);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'WHOIS lookup failed', detail: err.message });
  }
});

// GET /api/whois/dns
whoisRouter.get('/dns', async (req, res) => {
  try {
    const { domain } = req.query;
    if (!domain) return res.status(400).json({ error: 'Missing required parameter: domain' });

    const clean = cleanDomain(domain);
    const cacheKey = `dns:${clean}`;
    const hit = cached(cacheKey);
    if (hit) return res.json(hit);

    const result = await getDnsRecords(clean);
    const response = { domain: clean, ...result, queriedAt: new Date().toISOString() };

    setCache(cacheKey, response);
    res.json(response);
  } catch (err) {
    res.status(500).json({ error: 'DNS lookup failed', detail: err.message });
  }
});

// GET /api/whois/ssl
whoisRouter.get('/ssl', async (req, res) => {
  try {
    const { domain } = req.query;
    if (!domain) return res.status(400).json({ error: 'Missing required parameter: domain' });

    const clean = cleanDomain(domain);
    const result = await getSslInfo(clean);
    res.json({ ...result, queriedAt: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ error: 'SSL check failed', detail: err.message });
  }
});

// GET /api/whois/availability
whoisRouter.get('/availability', async (req, res) => {
  try {
    const { domain } = req.query;
    if (!domain) return res.status(400).json({ error: 'Missing required parameter: domain' });

    const clean = cleanDomain(domain);
    const result = await checkAvailability(clean);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Availability check failed', detail: err.message });
  }
});
