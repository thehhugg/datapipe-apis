#!/bin/bash
# Quick test script for all Tier 1 APIs
BASE="${1:-http://localhost:3000}"
PASS=0
FAIL=0
TOTAL=0

test_api() {
  local name="$1"
  local path="$2"
  local expect_field="$3"
  TOTAL=$((TOTAL + 1))
  
  result=$(curl -s --max-time 15 "${BASE}${path}" 2>&1)
  
  if echo "$result" | grep -q "$expect_field"; then
    echo "  ✅ $name"
    PASS=$((PASS + 1))
  else
    echo "  ❌ $name"
    echo "     Response: $(echo "$result" | head -c 200)"
    FAIL=$((FAIL + 1))
  fi
}

echo "🧪 Testing RapidAPI Bundle APIs at $BASE"
echo "==========================================="
echo ""

echo "📡 Health & Index"
test_api "Health check" "/health" "uptime"
test_api "API index" "/" "DataPipe API Bundle"

echo ""
echo "📊 Social Trends"
test_api "Reddit trending" "/api/social-trends/reddit?subreddit=technology&limit=2" "data"
test_api "HN trending" "/api/social-trends/hackernews?type=top&limit=2" "data"

echo ""
echo "🌐 Domain Intelligence"
test_api "WHOIS lookup" "/api/whois/lookup?domain=github.com" "domain"
test_api "DNS records" "/api/whois/dns?domain=github.com" "records"
test_api "SSL info" "/api/whois/ssl?domain=github.com" "domain"

echo ""
echo "🔧 Tech Stack"
test_api "Detect tech" "/api/tech-stack/detect?url=https://github.com" "technologies"

echo ""
echo "📧 Email Finder"
test_api "Find emails" "/api/email-finder/domain?domain=basecamp.com" "domain"
test_api "MX pattern" "/api/email-finder/pattern?domain=basecamp.com" "domain"

echo ""
echo "🏢 Company Enrichment"
test_api "Enrich company" "/api/enrich/company?domain=basecamp.com" "domain"

echo ""
echo "🕵️ Company Intel"
test_api "Intel report" "/api/intel/company?domain=basecamp.com" "domain"

echo ""
echo "💼 Jobs"
test_api "HN jobs" "/api/jobs/hackernews?limit=2" "data"

echo ""
echo "==========================================="
echo "Results: $PASS/$TOTAL passed, $FAIL failed"
