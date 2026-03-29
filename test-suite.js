/**
 * RapidAPI Bundle — Automated Test Suite
 * 
 * Tests all working APIs end-to-end against a running server.
 * Run: node test-suite.js [port]
 */

const BASE = `http://localhost:${process.argv[2] || 3000}`;
const results = [];

async function test(name, path, validate) {
  try {
    const url = `${BASE}${path}`;
    const res = await fetch(url);
    const data = await res.json();
    
    if (res.status >= 400) {
      results.push({ name, status: 'FAIL', error: `HTTP ${res.status}: ${JSON.stringify(data).slice(0, 200)}` });
      return;
    }
    
    if (validate && !validate(data)) {
      results.push({ name, status: 'FAIL', error: `Validation failed: ${JSON.stringify(data).slice(0, 200)}` });
      return;
    }
    
    results.push({ name, status: 'PASS' });
  } catch (err) {
    results.push({ name, status: 'FAIL', error: err.message });
  }
}

async function testPost(name, path, body, validate) {
  try {
    const url = `${BASE}${path}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    
    if (res.status >= 400) {
      results.push({ name, status: 'FAIL', error: `HTTP ${res.status}: ${JSON.stringify(data).slice(0, 200)}` });
      return;
    }
    
    if (validate && !validate(data)) {
      results.push({ name, status: 'FAIL', error: `Validation failed: ${JSON.stringify(data).slice(0, 200)}` });
      return;
    }
    
    results.push({ name, status: 'PASS' });
  } catch (err) {
    results.push({ name, status: 'FAIL', error: err.message });
  }
}

async function run() {
  console.log(`\n🧪 Testing RapidAPI Bundle at ${BASE}\n`);
  
  // Health check
  await test('Health Check', '/health', d => d.status === 'ok');
  
  // WHOIS / DNS
  await test('WHOIS Lookup', '/api/whois/lookup?domain=google.com', d => d.domain === 'google.com' && d.registration);
  await test('WHOIS DNS', '/api/whois/dns?domain=google.com', d => d.records);
  await test('WHOIS SSL', '/api/whois/ssl?domain=google.com', d => d.domain === 'google.com');
  await test('Domain Availability', '/api/whois/availability?domain=thisdomain-definitely-does-not-exist-xyz123.com', d => d.likely_available !== undefined || d.available !== undefined);
  
  // Tech Stack
  await test('Tech Stack Detect', '/api/tech-stack/detect?url=https://stripe.com', d => d.technologies);
  
  // Social Trends
  await test('Reddit Trends', '/api/social-trends/reddit?subreddit=technology&limit=3', d => Array.isArray(d.data) && d.data.length > 0);
  await test('HN Trends', '/api/social-trends/hackernews?type=top&limit=3', d => Array.isArray(d.data) && d.data.length > 0);
  
  // Email Finder
  await test('Email Finder', '/api/email-finder/domain?domain=stripe.com', d => d.domain === 'stripe.com');
  
  // Company Enrichment
  await test('Company Enrichment', '/api/enrich/company?domain=stripe.com', d => d.domain === 'stripe.com');
  
  // Company Intel
  await test('Company Intel', '/api/intel/company?domain=stripe.com', d => d.domain && d.company);
  
  // SEO Analysis
  await test('SEO Analysis', '/api/seo/analyze?url=https://example.com', d => d.score && d.title);
  
  // Content Extractor
  await test('Content Extract', '/api/content/extract?url=https://example.com', d => d.content && d.meta);
  
  // Text Analysis
  await testPost('Text Analysis', '/api/text/analyze', 
    { text: 'This is an excellent product that helps businesses grow rapidly.' },
    d => d.statistics && d.readability && d.sentiment
  );
  
  // IP Geolocation
  await test('IP Geolocation', '/api/ip/lookup?ip=8.8.8.8', d => d.country === 'United States');
  
  // QR Code (returns binary image, just check HTTP 200)
  try {
    const qrRes = await fetch(`${BASE}/api/qr/generate?data=hello`);
    results.push({ name: 'QR Code', status: qrRes.status === 200 ? 'PASS' : 'FAIL', error: qrRes.status !== 200 ? `HTTP ${qrRes.status}` : undefined });
  } catch (err) {
    results.push({ name: 'QR Code', status: 'FAIL', error: err.message });
  }
  
  // URL Metadata
  await test('URL Metadata', '/api/url/metadata?url=https://example.com', d => d.title || d.meta);
  
  // Email Validator
  await test('Email Validation', '/api/email/validate?email=test@google.com', d => d.valid === true);
  
  // Print results
  console.log('─'.repeat(60));
  let passed = 0, failed = 0;
  for (const r of results) {
    const icon = r.status === 'PASS' ? '✅' : '❌';
    console.log(`${icon} ${r.name}`);
    if (r.error) console.log(`   → ${r.error}`);
    if (r.status === 'PASS') passed++;
    else failed++;
  }
  console.log('─'.repeat(60));
  console.log(`\n📊 Results: ${passed} passed, ${failed} failed, ${results.length} total\n`);
  
  process.exit(failed > 0 ? 1 : 0);
}

run();
