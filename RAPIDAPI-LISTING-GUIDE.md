# RapidAPI Listing Guide — Step by Step

## Strategy: List 5 APIs Individually (Higher Visibility)

Each API gets its own RapidAPI listing = 5x more search visibility, 5x more chances to be found.

## Phase 1: Deploy the Bundle (10 min)

### Option A: Railway (Fastest)
1. Push to GitHub: `gh repo create datapipe-apis --private --source . --push`
2. Go to [railway.app](https://railway.app) → New Project → Deploy from GitHub
3. Select the repo → Railway auto-detects Node.js
4. Click "Generate Domain" → you get `something.up.railway.app`
5. Set env: `NODE_ENV=production`
6. Done. Server running. Cost: ~$5/mo.

### Option B: Render (Free tier available)
1. Push to GitHub
2. Go to [render.com](https://render.com) → New Web Service → Connect repo
3. Build: `npm install`, Start: `node src/server.js`
4. Free tier: 750 hrs/mo, spins down after 15 min idle (cold starts ~30s)
5. Pro: $7/mo for always-on

### Option C: Fly.io
1. `fly launch` → `fly deploy`
2. Free tier: 3 shared VMs, 160GB/mo bandwidth

## Phase 2: List on RapidAPI (15 min per API)

### API 1: Company Enrichment API ⭐ (Highest value)
- **Category:** Data > Business
- **Endpoint:** `GET /api/enrich/company?domain=example.com`
- **Description:** "Get comprehensive company data from just a domain name. Returns company description, tech stack, emails, phone numbers, social links, DNS/MX records, and security headers. No API keys needed — we handle all the scraping."
- **Pricing:**
  - Free: 50 calls/month
  - Basic ($9/mo): 500 calls/month
  - Pro ($29/mo): 5,000 calls/month
  - Business ($79/mo): 25,000 calls/month

### API 2: Domain Intelligence (WHOIS + DNS + SSL)
- **Category:** Data > Domain
- **Endpoint:** `GET /api/whois/lookup?domain=example.com`
- **Description:** "Complete domain intelligence: WHOIS registration data, DNS records (A, MX, NS, TXT, SOA), SSL certificate info, nameserver details, and domain availability check. All from one fast API call."
- **Pricing:**
  - Free: 100 calls/month
  - Basic ($9/mo): 1,000 calls/month
  - Pro ($19/mo): 10,000 calls/month
  - Business ($49/mo): 50,000 calls/month

### API 3: Website Tech Stack Detector
- **Category:** Data > Technology
- **Endpoint:** `GET /api/tech-stack/detect?url=https://example.com`
- **Description:** "Detect what technologies any website uses. Identifies CMS, hosting, security headers, JavaScript frameworks, and more. Includes DNS email provider detection and security header grading."
- **Pricing:**
  - Free: 100 calls/month
  - Basic ($9/mo): 1,000 calls/month
  - Pro ($19/mo): 10,000 calls/month

### API 4: SEO Analysis API
- **Category:** Tools > SEO
- **Endpoint:** `GET /api/seo/analyze?url=https://example.com`
- **Description:** "Instant on-page SEO audit for any URL. Returns title/meta analysis, heading structure, image alt text audit, link analysis, Schema.org detection, security headers, and an overall SEO score with letter grade."
- **Pricing:**
  - Free: 50 calls/month
  - Basic ($9/mo): 500 calls/month
  - Pro ($29/mo): 5,000 calls/month

### API 5: Email Validator
- **Category:** Tools > Email
- **Endpoint:** `GET /api/email/validate?email=test@example.com`
- **Description:** "Validate email addresses instantly. Checks syntax, MX records, disposable email detection, free provider identification, and role-based address detection. Returns a quality score 0-100 and deliverability prediction."
- **Pricing:**
  - Free: 100 calls/month
  - Basic ($9/mo): 2,000 calls/month
  - Pro ($19/mo): 10,000 calls/month
  - Business ($49/mo): 50,000 calls/month

## Phase 3: Additional Listings (week 2)

6. **Text Analysis API** — readability scoring, sentiment, keyword extraction
7. **IP Geolocation API** — IP to location with ISP/org data
8. **Social Trends API** — Reddit/HN trending content
9. **Content Extractor API** — URL to clean text/metadata
10. **QR Code Generator** — text/URL to QR code images

## Revenue Projection (Conservative)

| Month | Subscribers | Avg $/mo | MRR | After RapidAPI 25% |
|-------|------------|----------|-----|---------------------|
| 1     | 20         | $15      | $300  | $225 |
| 2     | 60         | $18      | $1,080 | $810 |
| 3     | 120        | $20      | $2,400 | $1,800 |
| 6     | 300        | $22      | $6,600 | $4,950 |

These are conservative — top RapidAPI APIs do $10-50K/mo.

## What Heather Does (One-Time, 30 min total)

1. **[2 min]** Create GitHub account (or use existing) → make repo
2. **[5 min]** Sign up at railway.app → deploy from GitHub
3. **[10 min]** Sign up at rapidapi.com/provider → create first API listing
4. **[10 min]** Create remaining 4 API listings (copy-paste from above)
5. **[3 min]** Set RAPIDAPI_PROXY_SECRET env var on Railway

## What Agents Do (Ongoing, Zero Heather Effort)

- Monitor API uptime
- Fix bugs and add features
- Optimize for RapidAPI search ranking (descriptions, tags)
- Add new APIs to the bundle
- Respond to user feedback/feature requests
- Scale infrastructure as needed
