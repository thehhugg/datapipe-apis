/**
 * IP Geolocation API — Free, no external keys needed
 * 
 * Uses ip-api.com (free for non-commercial, 45 req/min)
 * and ipinfo.io (50K/mo free) as fallback.
 * 
 * Endpoints:
 *   GET /api/ip/lookup?ip=8.8.8.8
 *   GET /api/ip/bulk (POST with array of IPs)
 *   GET /api/ip/me — caller's IP info
 */

import { Router } from 'express';

export const ipGeolocationRouter = Router();

const CACHE = new Map();
const CACHE_TTL = 6 * 60 * 60 * 1000; // 6hr cache

function cached(key) {
  const entry = CACHE.get(key);
  if (entry && Date.now() - entry.ts < CACHE_TTL) return entry.data;
  return null;
}

function setCache(key, data) {
  CACHE.set(key, { data, ts: Date.now() });
  if (CACHE.size > 5000) {
    const oldest = [...CACHE.entries()].sort((a, b) => a[1].ts - b[1].ts);
    oldest.slice(0, 1000).forEach(([k]) => CACHE.delete(k));
  }
}

async function lookupIP(ip) {
  const hit = cached(`ip:${ip}`);
  if (hit) return hit;

  try {
    // Primary: ip-api.com (free, no key, 45/min)
    const res = await fetch(`http://ip-api.com/json/${ip}?fields=status,message,continent,country,countryCode,region,regionName,city,zip,lat,lon,timezone,isp,org,as,asname,mobile,proxy,hosting,query`, {
      signal: AbortSignal.timeout(5000),
    });
    const data = await res.json();
    
    if (data.status === 'success') {
      const result = {
        ip: data.query,
        continent: data.continent,
        country: data.country,
        countryCode: data.countryCode,
        region: data.regionName,
        regionCode: data.region,
        city: data.city,
        zip: data.zip,
        latitude: data.lat,
        longitude: data.lon,
        timezone: data.timezone,
        isp: data.isp,
        organization: data.org,
        asn: data.as,
        asnName: data.asname,
        isMobile: data.mobile,
        isProxy: data.proxy,
        isHosting: data.hosting,
        source: 'ip-api',
      };
      setCache(`ip:${ip}`, result);
      return result;
    }
  } catch { /* fallback */ }

  // Fallback: ipwho.is (free, no key, no rate limit published)
  try {
    const res = await fetch(`https://ipwho.is/${ip}`, {
      signal: AbortSignal.timeout(5000),
    });
    const data = await res.json();
    
    if (data.success !== false) {
      const result = {
        ip: data.ip,
        continent: data.continent,
        country: data.country,
        countryCode: data.country_code,
        region: data.region,
        regionCode: data.region_code,
        city: data.city,
        zip: data.postal,
        latitude: data.latitude,
        longitude: data.longitude,
        timezone: data.timezone?.id,
        isp: data.connection?.isp,
        organization: data.connection?.org,
        asn: `AS${data.connection?.asn}`,
        asnName: data.connection?.domain,
        isMobile: null,
        isProxy: null,
        isHosting: null,
        source: 'ipwho.is',
      };
      setCache(`ip:${ip}`, result);
      return result;
    }
  } catch { /* both failed */ }

  return { ip, error: 'Lookup failed', source: 'none' };
}

// Single IP lookup
ipGeolocationRouter.get('/lookup', async (req, res) => {
  try {
    const { ip } = req.query;
    if (!ip) return res.status(400).json({ error: 'Missing required parameter: ip' });
    
    const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$|^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
    if (!ipRegex.test(ip) && ip !== 'me') {
      return res.status(400).json({ error: 'Invalid IP address format' });
    }

    const result = await lookupIP(ip);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Lookup failed', detail: err.message });
  }
});

// Caller's own IP
ipGeolocationRouter.get('/me', async (req, res) => {
  try {
    const clientIp = req.headers['x-forwarded-for']?.split(',')[0]?.trim() 
      || req.headers['x-real-ip'] 
      || req.ip 
      || req.connection?.remoteAddress;
    
    if (!clientIp || clientIp === '::1' || clientIp === '127.0.0.1') {
      return res.json({ ip: clientIp, note: 'Running locally — no geolocation available for loopback' });
    }

    const result = await lookupIP(clientIp);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Lookup failed', detail: err.message });
  }
});

// Bulk lookup (POST)
ipGeolocationRouter.post('/bulk', async (req, res) => {
  try {
    const { ips } = req.body;
    if (!ips || !Array.isArray(ips)) {
      return res.status(400).json({ error: 'Body must contain { ips: ["1.2.3.4", ...] }' });
    }
    if (ips.length > 100) {
      return res.status(400).json({ error: 'Maximum 100 IPs per request' });
    }

    const results = await Promise.all(ips.map(ip => lookupIP(ip)));
    res.json({ count: results.length, results });
  } catch (err) {
    res.status(500).json({ error: 'Bulk lookup failed', detail: err.message });
  }
});
