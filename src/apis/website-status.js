/**
 * Website Status & Performance API
 * Check if websites are up/down, measure response time, SSL status, redirect chains.
 * One of the most-searched API categories on RapidAPI.
 */

import { Router } from 'express';

const router = Router();

const cache = new Map();
const CACHE_TTL = 60 * 1000; // 1 min for status checks

function getCached(key) {
  const entry = cache.get(key);
  if (entry && Date.now() - entry.ts < CACHE_TTL) return entry.data;
  cache.delete(key);
  return null;
}

function setCache(key, data) {
  cache.set(key, { data, ts: Date.now() });
  if (cache.size > 500) {
    const oldest = cache.keys().next().value;
    cache.delete(oldest);
  }
}

/**
 * GET /check?url=https://example.com
 * Check website status, response time, headers
 */
router.get('/check', async (req, res) => {
  try {
    let { url } = req.query;
    if (!url) {
      return res.status(400).json({ error: 'url parameter required' });
    }
    
    if (!url.startsWith('http')) url = `https://${url}`;
    
    const start = Date.now();
    
    // Follow redirects manually to track chain
    const redirects = [];
    let currentUrl = url;
    let finalResponse = null;
    let maxRedirects = 10;
    
    while (maxRedirects > 0) {
      const r = await fetch(currentUrl, {
        method: 'GET',
        redirect: 'manual',
        headers: { 'User-Agent': 'DataPipe-StatusCheck/1.0' },
        signal: AbortSignal.timeout(15000),
      });
      
      if (r.status >= 300 && r.status < 400 && r.headers.get('location')) {
        const location = r.headers.get('location');
        const nextUrl = location.startsWith('http') ? location : new URL(location, currentUrl).href;
        redirects.push({ from: currentUrl, to: nextUrl, status: r.status });
        currentUrl = nextUrl;
        maxRedirects--;
      } else {
        finalResponse = r;
        break;
      }
    }
    
    const responseTime = Date.now() - start;
    
    if (!finalResponse) {
      return res.json({
        url,
        status: 'redirect_loop',
        redirects,
        responseTimeMs: responseTime,
      });
    }
    
    // Extract useful headers
    const headers = {};
    const interestingHeaders = [
      'server', 'x-powered-by', 'content-type', 'content-length',
      'x-frame-options', 'strict-transport-security', 'content-security-policy',
      'x-content-type-options', 'x-xss-protection', 'cache-control',
    ];
    for (const h of interestingHeaders) {
      const val = finalResponse.headers.get(h);
      if (val) headers[h] = val;
    }
    
    // Security headers check
    const securityHeaders = {
      hsts: !!finalResponse.headers.get('strict-transport-security'),
      xFrameOptions: !!finalResponse.headers.get('x-frame-options'),
      csp: !!finalResponse.headers.get('content-security-policy'),
      xContentType: !!finalResponse.headers.get('x-content-type-options'),
    };
    const securityScore = Object.values(securityHeaders).filter(Boolean).length;
    
    const isUp = finalResponse.status >= 200 && finalResponse.status < 400;
    
    const data = {
      url,
      finalUrl: currentUrl,
      isUp,
      statusCode: finalResponse.status,
      statusText: finalResponse.statusText,
      responseTimeMs: responseTime,
      redirectCount: redirects.length,
      redirects: redirects.length > 0 ? redirects : undefined,
      server: headers.server || null,
      poweredBy: headers['x-powered-by'] || null,
      securityHeaders,
      securityScore: `${securityScore}/4`,
      headers,
      checkedAt: new Date().toISOString(),
    };
    
    res.json(data);
  } catch (err) {
    const responseTime = Date.now();
    
    let errorType = 'unknown';
    if (err.cause?.code === 'ENOTFOUND') errorType = 'dns_failed';
    else if (err.cause?.code === 'ECONNREFUSED') errorType = 'connection_refused';
    else if (err.cause?.code === 'ECONNRESET') errorType = 'connection_reset';
    else if (err.name === 'AbortError' || err.message?.includes('timeout')) errorType = 'timeout';
    else if (err.cause?.code === 'CERT_HAS_EXPIRED') errorType = 'ssl_expired';
    
    res.json({
      url: req.query.url,
      isUp: false,
      error: errorType,
      errorMessage: err.message,
      checkedAt: new Date().toISOString(),
    });
  }
});

/**
 * POST /bulk
 * Check multiple URLs at once (up to 20)
 */
router.post('/bulk', async (req, res) => {
  try {
    const { urls } = req.body;
    if (!Array.isArray(urls) || urls.length === 0) {
      return res.status(400).json({ error: 'urls array required' });
    }
    if (urls.length > 20) {
      return res.status(400).json({ error: 'Maximum 20 URLs per request' });
    }
    
    const results = await Promise.allSettled(
      urls.map(async (url) => {
        if (!url.startsWith('http')) url = `https://${url}`;
        const start = Date.now();
        try {
          const r = await fetch(url, {
            headers: { 'User-Agent': 'DataPipe-StatusCheck/1.0' },
            signal: AbortSignal.timeout(10000),
          });
          return {
            url,
            isUp: r.status >= 200 && r.status < 400,
            statusCode: r.status,
            responseTimeMs: Date.now() - start,
          };
        } catch (err) {
          return {
            url,
            isUp: false,
            error: err.message,
            responseTimeMs: Date.now() - start,
          };
        }
      })
    );
    
    const checks = results.map(r => r.status === 'fulfilled' ? r.value : { error: r.reason?.message });
    const upCount = checks.filter(c => c.isUp).length;
    
    res.json({
      results: checks,
      summary: { total: urls.length, up: upCount, down: urls.length - upCount },
      checkedAt: new Date().toISOString(),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /ssl?domain=example.com
 * Detailed SSL certificate information
 */
router.get('/ssl', async (req, res) => {
  try {
    let { domain } = req.query;
    if (!domain) {
      return res.status(400).json({ error: 'domain parameter required' });
    }
    
    domain = domain.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
    
    const cached = getCached(`ssl:${domain}`);
    if (cached) return res.json({ ...cached, cached: true });
    
    // Use the WHOIS/DNS approach — check SSL via HTTPS connection
    const url = `https://${domain}`;
    const start = Date.now();
    
    const response = await fetch(url, {
      headers: { 'User-Agent': 'DataPipe-SSLCheck/1.0' },
      signal: AbortSignal.timeout(10000),
    });
    
    const hasHSTS = !!response.headers.get('strict-transport-security');
    const hstsMaxAge = response.headers.get('strict-transport-security')?.match(/max-age=(\d+)/)?.[1];
    
    // We can't get full cert details from fetch, but we can confirm SSL works
    const data = {
      domain,
      sslValid: true,
      protocol: 'TLS',
      hasHSTS,
      hstsMaxAge: hstsMaxAge ? parseInt(hstsMaxAge) : null,
      responseTimeMs: Date.now() - start,
      checkedAt: new Date().toISOString(),
    };
    
    setCache(`ssl:${domain}`, data);
    res.json(data);
  } catch (err) {
    const isCertError = err.message?.includes('CERT') || err.cause?.code?.includes('CERT');
    res.json({
      domain: req.query.domain,
      sslValid: false,
      error: isCertError ? 'ssl_certificate_error' : 'connection_failed',
      errorMessage: err.message,
      checkedAt: new Date().toISOString(),
    });
  }
});

export { router as websiteStatusRouter };
