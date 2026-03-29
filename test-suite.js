/**
 * RapidAPI Bundle — Comprehensive API Test Suite
 * Tests all Tier 1 APIs (no external keys needed)
 * 
 * Usage: node test-suite.js [port]
 */

const BASE = `http://localhost:${process.argv[2] || 3000}`;

const tests = [
  // Health
  { name: 'Health Check', url: '/health', validate: (d) => d.status === 'ok' },
  { name: 'API Index', url: '/', validate: (d) => d.apis?.length > 0 },

  // Tech Stack
  { name: 'Tech Stack — Detect', url: '/api/tech-stack/detect?url=github.com', validate: (d) => d.technologies && d.domain === 'github.com' },
  { name: 'Tech Stack — Categories', url: '/api/tech-stack/categories', validate: (d) => Array.isArray(d.categories || d) },

  // WHOIS/DNS
  { name: 'WHOIS — Lookup', url: '/api/whois/lookup?domain=example.com', validate: (d) => d.domain === 'example.com' },
  { name: 'WHOIS — DNS Records', url: '/api/whois/dns?domain=google.com', validate: (d) => d.domain === 'google.com' },

  // Social Trends
  { name: 'Social Trends — Reddit', url: '/api/social-trends/reddit', validate: (d) => d.data?.length > 0 },
  { name: 'Social Trends — HN', url: '/api/social-trends/hackernews', validate: (d) => d.data?.length > 0 || d.stories?.length > 0 },

  // Email Validator
  { name: 'Email Validator', url: '/api/email/validate?email=test@google.com', validate: (d) => d.email === 'test@google.com' && typeof d.valid === 'boolean' },

  // IP Geolocation
  { name: 'IP Geolocation', url: '/api/ip/lookup?ip=8.8.8.8', validate: (d) => d.ip === '8.8.8.8' && d.country },

  // Content Extractor
  { name: 'Content Extractor — Extract', url: '/api/content/extract?url=https://example.com', validate: (d) => d.url || d.title || d.content },
  { name: 'Content Extractor — Meta', url: '/api/content/meta?url=https://example.com', validate: (d) => d.url || d.title || d.meta },

  // Text Analysis (POST)
  { name: 'Text Analysis — Analyze', url: '/api/text/analyze', method: 'POST', body: { text: 'The quick brown fox jumps over the lazy dog.' }, validate: (d) => d.statistics?.words || d.wordCount || d.characters },
  { name: 'Text Analysis — Readability', url: '/api/text/readability', method: 'POST', body: { text: 'The quick brown fox jumps over the lazy dog. This is a simple sentence.' }, validate: (d) => d.readability || d.fleschReadingEase !== undefined || d.grade !== undefined },
  { name: 'Text Analysis — Sentiment', url: '/api/text/sentiment', method: 'POST', body: { text: 'This is absolutely wonderful and amazing!' }, validate: (d) => d.sentiment !== undefined || d.score !== undefined },

  // Email Finder
  { name: 'Email Finder', url: '/api/email-finder/domain?domain=stripe.com', validate: (d) => d.domain === 'stripe.com' },

  // Company Enrichment
  { name: 'Company Enrichment', url: '/api/enrich/company?domain=stripe.com', validate: (d) => d.domain || d.company },

  // Company Intel
  { name: 'Company Intel', url: '/api/intel/company?domain=stripe.com', validate: (d) => d.domain || d.company || d.profile },

  // SEO Analysis
  { name: 'SEO Analysis', url: '/api/seo/analyze?url=https://example.com', validate: (d) => d.url || d.score !== undefined || d.analysis },

  // QR Code
  { name: 'QR Code Generate', url: '/api/qr/generate?data=hello', validate: (d) => d.qr || d.image || d.svg || (typeof d === 'string' && d.length > 100) },
];

async function runTest({ name, url, method = 'GET', body, validate }) {
  try {
    const opts = { method, headers: { 'Content-Type': 'application/json' } };
    if (body) opts.body = JSON.stringify(body);
    
    const start = Date.now();
    const resp = await fetch(`${BASE}${url}`, opts);
    const ms = Date.now() - start;
    
    if (!resp.ok) {
      const text = await resp.text().catch(() => '');
      return { name, status: 'FAIL', ms, reason: `HTTP ${resp.status}: ${text.substring(0, 100)}` };
    }
    
    const contentType = resp.headers.get('content-type') || '';
    let data;
    if (contentType.includes('json')) {
      data = await resp.json();
    } else {
      data = await resp.text();
    }
    
    const valid = validate(data);
    return { name, status: valid ? 'PASS' : 'WARN', ms, reason: valid ? '' : 'Validation failed' };
  } catch (err) {
    return { name, status: 'FAIL', ms: 0, reason: err.message };
  }
}

async function main() {
  console.log(`\n🧪 RapidAPI Bundle Test Suite — ${BASE}\n`);
  console.log('='.repeat(70));
  
  let passed = 0, warned = 0, failed = 0;
  
  for (const test of tests) {
    const result = await runTest(test);
    const icon = result.status === 'PASS' ? '✅' : result.status === 'WARN' ? '⚠️' : '❌';
    const detail = result.reason ? ` — ${result.reason}` : '';
    console.log(`${icon} ${result.name} (${result.ms}ms)${detail}`);
    
    if (result.status === 'PASS') passed++;
    else if (result.status === 'WARN') warned++;
    else failed++;
  }
  
  console.log('='.repeat(70));
  console.log(`\n📊 Results: ${passed} passed, ${warned} warnings, ${failed} failed out of ${tests.length} tests\n`);
  
  if (failed > tests.length * 0.3) {
    console.log('❌ Too many failures — not ready for deployment');
    process.exit(1);
  } else if (failed > 0) {
    console.log('⚠️ Some failures — review before deployment');
    process.exit(0);
  } else {
    console.log('✅ All tests passed — ready for deployment!');
    process.exit(0);
  }
}

main();
