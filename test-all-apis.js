/**
 * Comprehensive API test suite for the RapidAPI Data Bundle
 * Tests all endpoints and reports results
 */

const BASE = 'http://localhost:3000';

const tests = [
  // Tier 1 — Core APIs (no external keys needed)
  { name: 'Health Check', method: 'GET', path: '/health' },
  { name: 'API Index', method: 'GET', path: '/' },
  
  // Social Trends
  { name: 'Reddit Trending', method: 'GET', path: '/api/social-trends/reddit?subreddit=technology&limit=3' },
  { name: 'HN Trending', method: 'GET', path: '/api/social-trends/hackernews?type=top&limit=3' },
  
  // WHOIS/DNS
  { name: 'WHOIS Lookup', method: 'GET', path: '/api/whois/lookup?domain=google.com' },
  { name: 'DNS Records', method: 'GET', path: '/api/whois/dns?domain=google.com' },
  { name: 'SSL Info', method: 'GET', path: '/api/whois/ssl?domain=google.com' },
  { name: 'Domain Availability', method: 'GET', path: '/api/whois/availability?domain=thisisatestdomain12345678.com' },
  
  // Tech Stack
  { name: 'Tech Stack Detect', method: 'GET', path: '/api/tech-stack/detect?url=https://stripe.com' },
  
  // Email Finder
  { name: 'Email Finder', method: 'GET', path: '/api/email-finder/domain?domain=basecamp.com' },
  { name: 'Email Pattern', method: 'GET', path: '/api/email-finder/pattern?domain=basecamp.com&name=John+Doe' },
  
  // Company Enrichment
  { name: 'Company Enrichment', method: 'GET', path: '/api/enrich/company?domain=notion.so' },
  
  // Company Intel
  { name: 'Company Intel', method: 'GET', path: '/api/intel/company?domain=stripe.com' },
  { name: 'Tech Intel', method: 'GET', path: '/api/intel/tech?domain=stripe.com' },
  
  // Text Analysis
  { name: 'Text Analysis', method: 'POST', path: '/api/text/analyze', body: { text: 'The quick brown fox jumps over the lazy dog. This is a wonderful day for testing APIs.' } },
  
  // Content Extractor
  { name: 'Content Extract', method: 'GET', path: '/api/content/extract?url=https://example.com' },
  
  // SEO Analysis
  { name: 'SEO Analysis', method: 'GET', path: '/api/seo/analyze?url=https://example.com' },
  
  // IP Geolocation
  { name: 'IP Geolocation', method: 'GET', path: '/api/ip/lookup?ip=8.8.8.8' },
  
  // QR Code
  { name: 'QR Code Generate', method: 'GET', path: '/api/qr/generate?data=https://example.com' },
  
  // Email Validator
  { name: 'Email Validate', method: 'GET', path: '/api/email/validate?email=test@gmail.com' },
  
  // URL Metadata
  { name: 'URL Metadata', method: 'GET', path: '/api/url/metadata?url=https://github.com' },
  { name: 'URL Expand', method: 'GET', path: '/api/url/expand?url=https://github.com' },
  
  // Page Diff (POST)
  { name: 'Page Compare', method: 'POST', path: '/api/diff/compare', body: { url: 'https://example.com' } },
  
  // Price Monitor (POST)
  { name: 'Price Monitor', method: 'POST', path: '/api/monitor/track', body: { url: 'https://example.com', selector: 'h1' } },
];

async function runTests() {
  console.log('🧪 Testing RapidAPI Data Bundle\n');
  console.log('=' .repeat(70));
  
  let passed = 0, failed = 0, errors = [];
  
  for (const test of tests) {
    try {
      const opts = { method: test.method, headers: { 'Content-Type': 'application/json' } };
      if (test.body) opts.body = JSON.stringify(test.body);
      
      const start = Date.now();
      const res = await fetch(`${BASE}${test.path}`, opts);
      const ms = Date.now() - start;
      
      const contentType = res.headers.get('content-type') || '';
      let body;
      if (contentType.includes('json')) {
        body = await res.json();
      } else if (contentType.includes('image')) {
        body = `[IMAGE: ${(await res.arrayBuffer()).byteLength} bytes]`;
      } else {
        body = await res.text();
        body = body.substring(0, 100);
      }
      
      const status = res.status < 400 ? '✅' : '❌';
      if (res.status < 400) {
        passed++;
        console.log(`${status} ${test.name.padEnd(25)} ${String(res.status).padEnd(5)} ${ms}ms`);
      } else {
        failed++;
        const errMsg = typeof body === 'object' ? (body.error || body.message || JSON.stringify(body).substring(0, 80)) : String(body).substring(0, 80);
        errors.push({ name: test.name, status: res.status, error: errMsg });
        console.log(`${status} ${test.name.padEnd(25)} ${String(res.status).padEnd(5)} ${ms}ms — ${errMsg}`);
      }
    } catch (e) {
      failed++;
      errors.push({ name: test.name, status: 'ERR', error: e.message });
      console.log(`❌ ${test.name.padEnd(25)} ERR   — ${e.message.substring(0, 60)}`);
    }
  }
  
  console.log('\n' + '='.repeat(70));
  console.log(`\n📊 Results: ${passed} passed, ${failed} failed out of ${tests.length} tests`);
  
  if (errors.length > 0) {
    console.log('\n❌ Failures:');
    errors.forEach(e => console.log(`   - ${e.name}: ${e.status} — ${e.error}`));
  }
  
  console.log(`\n💰 Revenue-ready APIs: ${passed - 2} (excluding health + index)`);
}

runTests().catch(console.error);
