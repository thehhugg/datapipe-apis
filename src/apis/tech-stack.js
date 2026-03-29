/**
 * Website Tech Stack Detector API
 * 
 * Detects technologies used by any website: CMS, frameworks, analytics,
 * CDN, hosting, e-commerce platforms, marketing tools, etc.
 * 
 * High demand on RapidAPI — competitors charge $0.005-0.02/call.
 * Our approach: header analysis + HTML pattern matching + DNS checks.
 * No external APIs required.
 * 
 * Endpoints:
 *   GET /api/tech-stack/detect?url=example.com
 *   GET /api/tech-stack/categories
 */

import { Router } from 'express';
import * as cheerio from 'cheerio';

export const techStackRouter = Router();

const CACHE = new Map();
const CACHE_TTL = 6 * 60 * 60 * 1000; // 6hr cache

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

// Tech detection signatures
const SIGNATURES = {
  cms: [
    { name: 'WordPress', patterns: [/wp-content/i, /wp-includes/i, /wp-json/i], headers: { 'x-powered-by': /WordPress/i }, meta: { generator: /WordPress/i } },
    { name: 'Shopify', patterns: [/cdn\.shopify\.com/i, /shopify\.com\/s/i, /Shopify\.theme/i], headers: { 'x-shopify-stage': /./ } },
    { name: 'Wix', patterns: [/wix\.com/i, /wixsite\.com/i, /X-Wix/i, /wix-code/i] },
    { name: 'Squarespace', patterns: [/squarespace\.com/i, /squarespace-cdn/i, /static\.squarespace/i], headers: { 'x-servedby': /squarespace/i } },
    { name: 'Webflow', patterns: [/webflow\.com/i, /assets\.website-files\.com/i], headers: { 'x-powered-by': /Webflow/i } },
    { name: 'Ghost', patterns: [/ghost\.io/i, /ghost\.org/i], meta: { generator: /Ghost/i } },
    { name: 'Drupal', patterns: [/sites\/default\/files/i, /drupal\.js/i, /drupal\.org/i], headers: { 'x-drupal-cache': /./ }, meta: { generator: /Drupal/i } },
    { name: 'Joomla', patterns: [/\/media\/jui/i, /\/media\/system\/js/i, /joomla\.org/i], meta: { generator: /Joomla/i } },
    { name: 'HubSpot CMS', patterns: [/hubspot\.net/i, /hs-scripts\.com/i, /hubs\.ly/i] },
    { name: 'Contentful', patterns: [/contentful\.com/i, /ctfassets\.net/i] },
    { name: 'Strapi', patterns: [/strapi\.io/i, /\/admin\/plugins/i], headers: { 'x-powered-by': /Strapi/i } },
    { name: 'Gatsby', patterns: [/gatsby/i, /page-data\.json/i, /__gatsby/i] },
    { name: 'Next.js', patterns: [/_next\//i, /__next/i, /next\/dist/i], headers: { 'x-powered-by': /Next\.js/i } },
    { name: 'Nuxt.js', patterns: [/_nuxt\//i, /__nuxt/i], headers: { 'x-powered-by': /Nuxt/i } },
    { name: 'Hugo', meta: { generator: /Hugo/i } },
    { name: 'Jekyll', meta: { generator: /Jekyll/i } },
    { name: 'Astro', meta: { generator: /Astro/i } },
  ],
  ecommerce: [
    { name: 'Shopify', patterns: [/cdn\.shopify\.com/i, /Shopify\.theme/i] },
    { name: 'WooCommerce', patterns: [/wp-content\/plugins\/woocommerce/i, /wc-ajax/i, /woocommerce-(?:page|product|cart|checkout)/i, /class="woocommerce/i] },
    { name: 'Magento', patterns: [/mage\/cookies/i, /varien\/js/i, /Magento_Ui/i, /requirejs\/require\.js/i], headers: { 'x-magento': /./ } },
    { name: 'BigCommerce', patterns: [/bigcommerce\.com/i, /cdn11\.bigcommerce/i] },
    { name: 'PrestaShop', patterns: [/prestashop\.com/i, /\/modules\/prestashop/i, /PrestaShop/] },
    { name: 'Salesforce Commerce', patterns: [/demandware\.net/i, /salesforcecommerce/i] },
    { name: 'Stripe', patterns: [/js\.stripe\.com/i, /stripe\.js/i] },
    { name: 'PayPal', patterns: [/paypal\.com\/sdk/i, /paypalobjects\.com/i] },
    { name: 'Square', patterns: [/squareup\.com/i, /square\.site/i] },
  ],
  analytics: [
    { name: 'Google Analytics', patterns: [/google-analytics\.com/i, /googletagmanager\.com/i, /gtag\/js/i, /ga\.js/i, /analytics\.js/i] },
    { name: 'Google Tag Manager', patterns: [/googletagmanager\.com\/gtm/i, /gtm\.js/i] },
    { name: 'Facebook Pixel', patterns: [/connect\.facebook\.net/i, /fbevents\.js/i, /fbq\(/i] },
    { name: 'Hotjar', patterns: [/hotjar\.com/i, /static\.hotjar\.com/i] },
    { name: 'Mixpanel', patterns: [/mixpanel\.com/i, /cdn\.mxpnl\.com/i] },
    { name: 'Segment', patterns: [/segment\.com\/analytics/i, /cdn\.segment\.com/i] },
    { name: 'Amplitude', patterns: [/amplitude\.com/i, /cdn\.amplitude\.com/i] },
    { name: 'Plausible', patterns: [/plausible\.io/i] },
    { name: 'Fathom', patterns: [/usefathom\.com/i, /cdn\.usefathom\.com/i] },
    { name: 'Heap', patterns: [/heap-analytics\.com/i, /heapanalytics\.com/i] },
    { name: 'Clarity', patterns: [/clarity\.ms/i] },
    { name: 'PostHog', patterns: [/posthog\.com/i, /app\.posthog\.com/i] },
    { name: 'Matomo', patterns: [/matomo\.js/i, /piwik\.js/i] },
  ],
  frameworks: [
    { name: 'React', patterns: [/react\.production/i, /react-dom/i, /__react/i, /data-reactroot/i, /data-reactid/i] },
    { name: 'Vue.js', patterns: [/vue\.js/i, /vue\.min\.js/i, /data-v-[a-f0-9]/i, /__vue/i] },
    { name: 'Angular', patterns: [/angular\.js/i, /ng-version/i, /ng-app/i, /angular\.min\.js/i] },
    { name: 'Svelte', patterns: [/svelte/i, /__svelte/i] },
    { name: 'jQuery', patterns: [/jquery\.min\.js/i, /jquery-\d/i, /jquery\.js/i] },
    { name: 'Bootstrap', patterns: [/bootstrap\.min\.(css|js)/i, /bootstrap\.(css|js)/i, /cdn\.jsdelivr\.net\/npm\/bootstrap/i] },
    { name: 'Tailwind CSS', patterns: [/tailwindcss/i, /tailwind\.min\.css/i] },
    { name: 'Alpine.js', patterns: [/alpine\.js/i, /x-data/i, /x-bind/i] },
    { name: 'HTMX', patterns: [/htmx\.org/i, /htmx\.min\.js/i, /hx-get/i, /hx-post/i] },
    { name: 'Ember.js', patterns: [/ember\.js/i, /ember\.min/i] },
    { name: 'Backbone.js', patterns: [/backbone\.js/i, /backbone\.min/i] },
    { name: 'Lit', patterns: [/lit-html/i, /lit-element/i] },
  ],
  cdn: [
    { name: 'Cloudflare', headers: { 'cf-ray': /./, 'server': /cloudflare/i, 'cf-cache-status': /./ } },
    { name: 'Fastly', headers: { 'x-served-by': /cache/i, 'via': /varnish/i, 'x-fastly': /./ } },
    { name: 'AWS CloudFront', headers: { 'x-amz-cf-id': /./, 'via': /cloudfront/i, 'x-amz-cf-pop': /./ } },
    { name: 'Akamai', headers: { 'x-akamai': /./, 'server': /AkamaiGHost/i } },
    { name: 'Vercel', headers: { 'x-vercel-id': /./, 'server': /Vercel/i, 'x-vercel-cache': /./ } },
    { name: 'Netlify', headers: { 'x-nf': /./, 'server': /Netlify/i } },
    { name: 'KeyCDN', headers: { 'server': /keycdn/i } },
    { name: 'Bunny CDN', headers: { 'server': /BunnyCDN/i, 'cdn-pullzone': /./ } },
    { name: 'StackPath', headers: { 'x-sp': /./ } },
    { name: 'Google Cloud CDN', headers: { 'via': /google/i, 'server': /gws/i } },
  ],
  hosting: [
    { name: 'AWS', headers: { 'server': /AmazonS3|Amazon/i, 'x-amz': /./ } },
    { name: 'Google Cloud', headers: { 'server': /gws|Google/i, 'x-goog': /./ } },
    { name: 'Azure', headers: { 'x-azure': /./, 'x-ms': /./ } },
    { name: 'Heroku', headers: { 'via': /heroku/i, 'server': /heroku/i } },
    { name: 'DigitalOcean', headers: { 'server': /digitalocean/i } },
    { name: 'Render', headers: { 'server': /render/i } },
    { name: 'Railway', headers: { 'server': /railway/i } },
    { name: 'Fly.io', headers: { 'fly-request-id': /./, 'server': /Fly/i } },
    { name: 'GitHub Pages', headers: { 'server': /GitHub\.com/i }, patterns: [/github\.io/i] },
    { name: 'Nginx', headers: { 'server': /nginx/i } },
    { name: 'Apache', headers: { 'server': /Apache/i } },
    { name: 'LiteSpeed', headers: { 'server': /LiteSpeed/i } },
  ],
  marketing: [
    { name: 'Mailchimp', patterns: [/mailchimp\.com/i, /chimpstatic\.com/i, /mc\.us/i] },
    { name: 'HubSpot', patterns: [/hubspot\.com/i, /hs-scripts\.com/i, /hubs\.ly/i, /hsforms\.com/i] },
    { name: 'Intercom', patterns: [/intercom\.io/i, /intercomcdn\.com/i, /widget\.intercom/i] },
    { name: 'Drift', patterns: [/drift\.com/i, /js\.driftt\.com/i] },
    { name: 'Zendesk', patterns: [/zendesk\.com/i, /zdassets\.com/i] },
    { name: 'Freshdesk', patterns: [/freshdesk\.com/i] },
    { name: 'Crisp', patterns: [/crisp\.chat/i, /client\.crisp\.chat/i] },
    { name: 'Tawk.to', patterns: [/tawk\.to/i, /embed\.tawk\.to/i] },
    { name: 'LiveChat', patterns: [/livechat\.com/i, /livechatinc\.com/i] },
    { name: 'Calendly', patterns: [/calendly\.com/i, /assets\.calendly\.com/i] },
    { name: 'OptinMonster', patterns: [/optinmonster\.com/i, /optin\.monster/i] },
    { name: 'Sumo', patterns: [/sumo\.com/i, /load\.sumo\.com/i] },
    { name: 'ConvertKit', patterns: [/convertkit\.com/i, /convertkit-mail/i] },
    { name: 'ActiveCampaign', patterns: [/activecampaign\.com/i, /trackcmp\.net/i] },
    { name: 'Klaviyo', patterns: [/klaviyo\.com/i, /static\.klaviyo\.com/i] },
  ],
  security: [
    { name: 'SSL/TLS', custom: 'ssl_check' },
    { name: 'HSTS', headers: { 'strict-transport-security': /./ } },
    { name: 'Content-Security-Policy', headers: { 'content-security-policy': /./ } },
    { name: 'X-Frame-Options', headers: { 'x-frame-options': /./ } },
    { name: 'reCAPTCHA', patterns: [/recaptcha/i, /google\.com\/recaptcha/i] },
    { name: 'hCaptcha', patterns: [/hcaptcha\.com/i] },
    { name: 'Cloudflare Bot Management', headers: { 'cf-mitigated': /./ } },
  ]
};

async function fetchSite(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      signal: controller.signal,
      redirect: 'follow',
    });
    clearTimeout(timeout);
    
    const headers = {};
    response.headers.forEach((value, key) => { headers[key.toLowerCase()] = value; });
    const html = await response.text();
    
    return { headers, html, status: response.status, finalUrl: response.url };
  } catch (err) {
    clearTimeout(timeout);
    throw err;
  }
}

function detectFromHeaders(headers, sigs) {
  const detected = [];
  for (const sig of sigs) {
    if (!sig.headers) continue;
    for (const [header, pattern] of Object.entries(sig.headers)) {
      if (headers[header] && pattern.test(headers[header])) {
        detected.push(sig.name);
        break;
      }
    }
  }
  return [...new Set(detected)];
}

function detectFromHtml(html, sigs) {
  const detected = [];
  for (const sig of sigs) {
    if (!sig.patterns) continue;
    for (const pattern of sig.patterns) {
      if (pattern.test(html)) {
        detected.push(sig.name);
        break;
      }
    }
  }
  return [...new Set(detected)];
}

function detectFromMeta($, sigs) {
  const detected = [];
  for (const sig of sigs) {
    if (!sig.meta) continue;
    for (const [metaName, pattern] of Object.entries(sig.meta)) {
      const content = $(`meta[name="${metaName}"]`).attr('content') || '';
      if (pattern.test(content)) {
        detected.push(sig.name);
        break;
      }
    }
  }
  return [...new Set(detected)];
}

async function checkDNS(domain) {
  const results = {};
  try {
    // Check MX records
    const mxRes = await fetch(`https://dns.google/resolve?name=${domain}&type=MX`, {
      signal: AbortSignal.timeout(5000)
    });
    const mxData = await mxRes.json();
    const mx = (mxData.Answer || []).filter(a => a.type === 15).map(a => a.data);
    
    if (mx.some(r => /google/i.test(r))) results.email = 'Google Workspace';
    else if (mx.some(r => /outlook|microsoft/i.test(r))) results.email = 'Microsoft 365';
    else if (mx.some(r => /zoho/i.test(r))) results.email = 'Zoho Mail';
    else if (mx.some(r => /proton/i.test(r))) results.email = 'ProtonMail';
    else if (mx.length > 0) results.email = 'Other';

    // Check TXT for SPF/DMARC
    const txtRes = await fetch(`https://dns.google/resolve?name=${domain}&type=TXT`, {
      signal: AbortSignal.timeout(5000)
    });
    const txtData = await txtRes.json();
    const txt = (txtData.Answer || []).map(a => a.data).join(' ');
    
    results.spf = /v=spf1/i.test(txt);
    results.dmarc_domain = true; // We checked
    
    // DMARC check
    const dmarcRes = await fetch(`https://dns.google/resolve?name=_dmarc.${domain}&type=TXT`, {
      signal: AbortSignal.timeout(5000)
    });
    const dmarcData = await dmarcRes.json();
    const dmarc = (dmarcData.Answer || []).map(a => a.data).join(' ');
    results.dmarc = /v=DMARC1/i.test(dmarc);
    
  } catch { /* DNS checks are best-effort */ }
  return results;
}

// GET /api/tech-stack/detect
techStackRouter.get('/detect', async (req, res) => {
  try {
    const { url: inputUrl, dns: includeDns = 'true' } = req.query;
    if (!inputUrl) return res.status(400).json({ error: 'Missing required parameter: url' });

    let cleanUrl = inputUrl.replace(/^https?:\/\//, '').replace(/\/+$/, '');
    const domain = cleanUrl.split('/')[0];
    const fullUrl = `https://${cleanUrl}`;

    // Check cache
    const cacheKey = `tech:${domain}`;
    const hit = cached(cacheKey);
    if (hit) return res.json(hit);

    const { headers, html, status, finalUrl } = await fetchSite(fullUrl);
    const $ = cheerio.load(html);

    const result = {
      url: fullUrl,
      finalUrl,
      domain,
      status,
      technologies: {},
      summary: {
        totalDetected: 0,
        categories: [],
      },
      meta: {
        title: $('title').first().text().trim() || null,
        description: $('meta[name="description"]').attr('content') || null,
        ogImage: $('meta[property="og:image"]').attr('content') || null,
      },
      scannedAt: new Date().toISOString(),
    };

    // Detect technologies in each category
    for (const [category, sigs] of Object.entries(SIGNATURES)) {
      const fromHeaders = detectFromHeaders(headers, sigs);
      const fromHtml = detectFromHtml(html, sigs);
      const fromMeta = detectFromMeta($, sigs);
      
      const all = [...new Set([...fromHeaders, ...fromHtml, ...fromMeta])];
      
      if (all.length > 0) {
        result.technologies[category] = all.map(name => ({
          name,
          confidence: fromHeaders.includes(name) ? 'high' : fromMeta.includes(name) ? 'high' : 'medium',
        }));
      }
    }

    // DNS-based detection
    if (includeDns !== 'false') {
      const dnsInfo = await checkDNS(domain);
      if (Object.keys(dnsInfo).length > 0) {
        result.dns = dnsInfo;
      }
    }

    // Security headers summary
    result.securityHeaders = {
      https: finalUrl.startsWith('https'),
      hsts: !!headers['strict-transport-security'],
      csp: !!headers['content-security-policy'],
      xFrameOptions: !!headers['x-frame-options'],
      xContentTypeOptions: !!headers['x-content-type-options'],
      referrerPolicy: !!headers['referrer-policy'],
      score: 0,
    };
    // Simple security score
    const sh = result.securityHeaders;
    sh.score = [sh.https, sh.hsts, sh.csp, sh.xFrameOptions, sh.xContentTypeOptions, sh.referrerPolicy]
      .filter(Boolean).length;
    sh.grade = sh.score >= 5 ? 'A' : sh.score >= 4 ? 'B' : sh.score >= 3 ? 'C' : sh.score >= 2 ? 'D' : 'F';

    // Summary
    const cats = Object.keys(result.technologies);
    result.summary.categories = cats;
    result.summary.totalDetected = Object.values(result.technologies).reduce((sum, arr) => sum + arr.length, 0);

    setCache(cacheKey, result);
    res.json(result);
  } catch (err) {
    if (err.name === 'AbortError') {
      return res.status(504).json({ error: 'Timeout — site took too long to respond' });
    }
    res.status(500).json({ error: 'Detection failed', detail: err.message });
  }
});

// GET /api/tech-stack/categories
techStackRouter.get('/categories', (req, res) => {
  const cats = {};
  for (const [category, sigs] of Object.entries(SIGNATURES)) {
    cats[category] = sigs.map(s => s.name);
  }
  res.json({
    categories: Object.keys(cats),
    technologies: cats,
    totalSignatures: Object.values(cats).reduce((sum, arr) => sum + arr.length, 0),
  });
});
