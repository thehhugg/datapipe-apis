#!/bin/bash
# Test all working APIs in the RapidAPI bundle
# Usage: ./test-all-apis.sh [base_url]
#   base_url defaults to http://localhost:3000

BASE="${1:-http://localhost:3000}"
PASS=0
FAIL=0
TOTAL=0

test_api() {
  local name="$1"
  local method="$2"
  local endpoint="$3"
  local data="$4"
  TOTAL=$((TOTAL + 1))
  
  if [ "$method" = "GET" ]; then
    response=$(curl -s -o /dev/null -w "%{http_code}" "$BASE$endpoint" 2>/dev/null)
  else
    response=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE$endpoint" -H "Content-Type: application/json" -d "$data" 2>/dev/null)
  fi
  
  if [ "$response" = "200" ]; then
    echo "  ✅ $name ($response)"
    PASS=$((PASS + 1))
  else
    echo "  ❌ $name ($response)"
    FAIL=$((FAIL + 1))
  fi
}

echo "🧪 Testing RapidAPI Data Bundle at $BASE"
echo ""

echo "--- Core ---"
test_api "Health check" GET "/health"
test_api "API index" GET "/"

echo ""
echo "--- Domain Intelligence (WHOIS/DNS/SSL) ---"
test_api "WHOIS lookup" GET "/api/whois/lookup?domain=google.com"
test_api "DNS records" GET "/api/whois/dns?domain=google.com"
test_api "SSL info" GET "/api/whois/ssl?domain=google.com"
test_api "Availability" GET "/api/whois/availability?domain=thisdomain-surely-doesnt-exist-12345.com"

echo ""
echo "--- Tech Stack ---"
test_api "Detect tech" GET "/api/tech-stack/detect?url=https://shopify.com"

echo ""
echo "--- Email Finder ---"
test_api "Find emails" GET "/api/email-finder/domain?domain=stripe.com"
test_api "Email pattern" GET "/api/email-finder/pattern?domain=stripe.com&name=John+Smith"

echo ""
echo "--- Social Trends ---"
test_api "Reddit trends" GET "/api/social-trends/reddit?subreddit=technology&limit=3"
test_api "HN trends" GET "/api/social-trends/hackernews?limit=3"

echo ""
echo "--- Company Enrichment ---"
test_api "Enrich company" GET "/api/enrich/company?domain=shopify.com"

echo ""
echo "--- Company Intel ---"
test_api "Company intel" GET "/api/intel/company?domain=stripe.com"

echo ""
echo "--- SEO Analysis ---"
test_api "SEO audit" GET "/api/seo/analyze?url=https://stripe.com"

echo ""
echo "--- Text Analysis ---"
test_api "Analyze text" POST "/api/text/analyze" '{"text":"This is a great product. I love using it every day. The quality is outstanding."}'
test_api "Keywords" POST "/api/text/keywords" '{"text":"Machine learning and artificial intelligence are transforming the technology industry with deep learning models."}'

echo ""
echo "--- Content Extractor ---"
test_api "Extract content" GET "/api/content/extract?url=https://example.com"

echo ""
echo "========================"
echo "Results: $PASS/$TOTAL passed, $FAIL failed"
if [ "$FAIL" -eq 0 ]; then
  echo "🎉 All tests passed!"
else
  echo "⚠️  $FAIL test(s) failed"
fi
