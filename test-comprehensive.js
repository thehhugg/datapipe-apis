/**
 * Comprehensive API Test Suite
 * Tests all endpoints with correct paths
 * Run: node test-comprehensive.js [port]
 */

const BASE = `http://localhost:${process.argv[2] || 3000}`;
const results = [];

async function test(name, method, path, body = null) {
  try {
    const opts = { method, headers: { 'Content-Type': 'application/json' } };
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(`${BASE}${path}`, opts);
    const contentType = res.headers.get('content-type') || '';
    
    if (contentType.includes('image') || contentType.includes('svg')) {
      results.push({ name, status: res.ok ? 'PASS' : 'FAIL', note: `${res.status} ${contentType}` });
      return;
    }
    
    const data = await res.json().catch(() => null);
    if (res.ok && data) {
      results.push({ name, status: 'PASS', note: Object.keys(data).slice(0, 3).join(', ') });
    } else {
      results.push({ name, status: 'FAIL', note: `${res.status}: ${JSON.stringify(data).slice(0, 100)}` });
    }
  } catch (err) {
    results.push({ name, status: 'FAIL', note: err.message });
  }
}

async function run() {
  console.log(`\n🧪 Testing RapidAPI Bundle at ${BASE}\n`);

  // WHOIS / DNS
  await test('WHOIS Lookup', 'GET', '/api/whois/lookup?domain=example.com');
  await test('DNS Records', 'GET', '/api/whois/dns?domain=example.com');
  await test('SSL Info', 'GET', '/api/whois/ssl?domain=example.com');
  await test('Domain Availability', 'GET', '/api/whois/availability?domain=example.com');

  // Tech Stack
  await test('Tech Stack Detect', 'GET', '/api/tech-stack/detect?url=https://example.com');

  // Company Enrichment
  await test('Company Enrich', 'GET', '/api/enrich/company?domain=stripe.com');

  // Company Intel
  await test('Company Intel', 'GET', '/api/intel/company?domain=stripe.com');

  // Email Finder
  await test('Email Finder Domain', 'GET', '/api/email-finder/domain?domain=hubspot.com');
  await test('Email Pattern', 'GET', '/api/email-finder/pattern?domain=hubspot.com&name=John+Smith');

  // Email Validator
  await test('Email Validate', 'GET', '/api/email/validate?email=test@gmail.com');

  // Social Trends
  await test('Reddit Trends', 'GET', '/api/social-trends/reddit?subreddit=technology&limit=3');
  await test('HN Trends', 'GET', '/api/social-trends/hackernews?type=top&limit=3');

  // Text Analysis
  await test('Text Analyze', 'POST', '/api/text/analyze', { text: 'This is a test of the text analysis API for readability and sentiment.' });

  // Content Extractor
  await test('Content Extract', 'GET', '/api/content/extract?url=https://example.com');

  // SEO Analysis
  await test('SEO Audit', 'GET', '/api/seo/analyze?url=https://example.com');
  await test('SEO Headers', 'GET', '/api/seo/headers?url=https://example.com');

  // IP Geolocation
  await test('IP Lookup', 'GET', '/api/ip/lookup?ip=8.8.8.8');

  // QR Code
  await test('QR Generate', 'GET', '/api/qr/generate?data=hello');

  // URL Metadata
  await test('URL Metadata', 'GET', '/api/url/metadata?url=https://github.com');

  // Jobs
  await test('HN Jobs', 'GET', '/api/jobs/hackernews');

  // Print results
  console.log('─'.repeat(60));
  const pass = results.filter(r => r.status === 'PASS').length;
  const fail = results.filter(r => r.status === 'FAIL').length;
  
  for (const r of results) {
    const icon = r.status === 'PASS' ? '✅' : '❌';
    console.log(`${icon} ${r.name.padEnd(25)} ${r.note || ''}`);
  }
  
  console.log('─'.repeat(60));
  console.log(`\n${pass} passed, ${fail} failed out of ${results.length} tests\n`);
  process.exit(fail > 0 ? 1 : 0);
}

run();
