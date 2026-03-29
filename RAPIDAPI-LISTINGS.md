# RapidAPI Listing Descriptions

## Deployment Steps
1. Deploy to Render (free tier): `git push` to connected repo, or manually via render.yaml
2. Get the deployed URL (e.g., `https://datapipe-api.onrender.com`)
3. Create RapidAPI Provider account at https://rapidapi.com/provider
4. For each API below, create a new API listing on RapidAPI Hub
5. Point the base URL to your deployed instance
6. Set up pricing tiers as specified below
7. Add endpoints from the endpoint definitions

---

## API 1: Domain Intelligence API (WHOIS + DNS + SSL)

**Title:** Domain Intelligence API — WHOIS, DNS, SSL & Availability Check

**Category:** Data > Domain

**Description:**
Complete domain intelligence in one API. Get WHOIS registration data, DNS records, SSL certificate details, and domain availability — all from a single endpoint. Uses public RDAP and DNS-over-HTTPS for reliable, fast lookups with no external keys needed.

Perfect for: domain monitoring tools, SEO platforms, cybersecurity dashboards, brand protection, M&A due diligence.

**Endpoints:**
- `GET /api/whois/lookup?domain={domain}` — WHOIS registration data (registrar, dates, status, nameservers)
- `GET /api/whois/dns?domain={domain}` — Full DNS records (A, AAAA, MX, TXT, NS, CNAME, SOA)
- `GET /api/whois/ssl?domain={domain}` — SSL certificate details (issuer, dates, SANs)
- `GET /api/whois/availability?domain={domain}` — Domain availability check

**Pricing:**
| Plan | Price | Calls/mo | Rate Limit |
|------|-------|----------|------------|
| Free | $0 | 100 | 10/min |
| Basic | $9.99/mo | 5,000 | 50/min |
| Pro | $29.99/mo | 25,000 | 100/min |
| Business | $99.99/mo | 100,000 | 500/min |

---

## API 2: Tech Stack Detector API

**Title:** Tech Stack Detector — Identify Any Website's Technology

**Category:** Data > Web

**Description:**
Instantly detect what technologies power any website. Identifies CMS, frameworks, hosting, CDN, analytics, security headers, and more — just from a URL. No browser required, no JavaScript execution needed.

Works by analyzing HTTP headers, HTML meta tags, script references, and response patterns.

Perfect for: competitive intelligence, sales prospecting ("they use WordPress, pitch our migration service"), market research, lead qualification.

**Endpoints:**
- `GET /api/tech-stack/detect?url={url}` — Full technology detection

**Pricing:**
| Plan | Price | Calls/mo | Rate Limit |
|------|-------|----------|------------|
| Free | $0 | 50 | 5/min |
| Basic | $9.99/mo | 3,000 | 30/min |
| Pro | $29.99/mo | 15,000 | 60/min |
| Business | $99.99/mo | 75,000 | 200/min |

---

## API 3: Company Enrichment API

**Title:** Company Enrichment API — Get Full Company Data from Domain

**Category:** Data > Business

**Description:**
Turn any domain into rich company data. Get social links, technology stack, email patterns, DNS infrastructure, and company metadata — all from a single API call. Combines web scraping, DNS lookups, and pattern matching for comprehensive results.

No API keys needed. Works on any publicly accessible website.

Perfect for: CRM enrichment, sales intelligence, lead scoring, market research, competitor analysis.

**Endpoints:**
- `GET /api/enrich/company?domain={domain}` — Full company enrichment
- `POST /api/enrich/bulk` — Bulk enrichment (up to 25 domains)

**Pricing:**
| Plan | Price | Calls/mo | Rate Limit |
|------|-------|----------|------------|
| Free | $0 | 50 | 5/min |
| Basic | $14.99/mo | 2,000 | 20/min |
| Pro | $49.99/mo | 10,000 | 50/min |
| Business | $149.99/mo | 50,000 | 200/min |

---

## API 4: Social Trends API (Reddit + Hacker News)

**Title:** Social Trends API — Real-Time Reddit & Hacker News Trending

**Category:** Data > Social

**Description:**
Get trending topics from Reddit and Hacker News in real-time. Track what's hot across subreddits, search for mentions of your brand/competitors, and monitor tech news — all via clean JSON.

10-minute cache for fresh data without hammering sources.

Perfect for: content marketing, trend monitoring, brand mentions, news aggregation, social listening dashboards.

**Endpoints:**
- `GET /api/social-trends/reddit?subreddit={sub}&limit={n}` — Reddit trending posts
- `GET /api/social-trends/hackernews?type={top|new|best}&limit={n}` — HN trending
- `GET /api/social-trends/search?q={query}&source={all|reddit|hackernews}` — Cross-platform search

**Pricing:**
| Plan | Price | Calls/mo | Rate Limit |
|------|-------|----------|------------|
| Free | $0 | 500 | 20/min |
| Basic | $4.99/mo | 10,000 | 60/min |
| Pro | $19.99/mo | 50,000 | 200/min |

---

## API 5: Company Intel API

**Title:** Company Intel API — Full Company Profile from Domain

**Category:** Data > Business

**Description:**
The most comprehensive company lookup API. From a single domain, get: domain registration history, company metadata, contact emails, technology stack, social media profiles, employee estimates, and industry classification. Combines 6+ data sources in one call.

Perfect for: sales intelligence, due diligence, investment research, competitive analysis, lead enrichment.

**Endpoints:**
- `GET /api/intel/company?domain={domain}` — Full company intelligence report
- `POST /api/intel/batch` — Batch lookup (up to 10 domains)
- `GET /api/intel/tech?domain={domain}` — Technology-focused subset

**Pricing:**
| Plan | Price | Calls/mo | Rate Limit |
|------|-------|----------|------------|
| Free | $0 | 25 | 3/min |
| Basic | $19.99/mo | 1,000 | 15/min |
| Pro | $49.99/mo | 5,000 | 50/min |
| Business | $149.99/mo | 25,000 | 200/min |

---

## API 6: Email Finder API

**Title:** Email Finder API — Discover Business Email Addresses

**Category:** Data > Email

**Description:**
Find email addresses associated with any domain. Scrapes contact pages, detects email patterns, and identifies email providers via MX records. No external API keys needed.

**Endpoints:**
- `GET /api/email-finder/domain?domain={domain}` — Find emails for domain
- `GET /api/email-finder/pattern?domain={domain}` — Get email pattern (first.last@, f.last@, etc.)
- `GET /api/email-finder/verify?email={email}` — Basic email verification (MX check)

**Pricing:**
| Plan | Price | Calls/mo | Rate Limit |
|------|-------|----------|------------|
| Free | $0 | 50 | 5/min |
| Basic | $14.99/mo | 2,000 | 20/min |
| Pro | $39.99/mo | 10,000 | 50/min |
| Business | $99.99/mo | 50,000 | 200/min |

---

## API 7: Jobs Aggregator API (Hacker News)

**Title:** Tech Jobs API — HN Who's Hiring Aggregated

**Category:** Data > Jobs

**Description:**
Aggregated, structured tech job listings from Hacker News "Who's Hiring" threads. Get company, title, location, salary, and links in clean JSON — no scraping needed on your end.

**Endpoints:**
- `GET /api/jobs/hackernews?limit={n}&page={p}` — List jobs
- `GET /api/jobs/hackernews/search?q={query}` — Search jobs

**Pricing:**
| Plan | Price | Calls/mo | Rate Limit |
|------|-------|----------|------------|
| Free | $0 | 200 | 10/min |
| Basic | $4.99/mo | 5,000 | 30/min |
| Pro | $14.99/mo | 25,000 | 100/min |

---

## Revenue Projection (Conservative — 6 months after listing)

| API | Free Users | Paid Users | Avg $/mo | Monthly Rev |
|-----|-----------|------------|----------|-------------|
| Domain Intel | 200 | 30 | $20 | $600 |
| Tech Stack | 150 | 25 | $18 | $450 |
| Company Enrichment | 100 | 20 | $35 | $700 |
| Social Trends | 300 | 15 | $10 | $150 |
| Company Intel | 80 | 20 | $40 | $800 |
| Email Finder | 120 | 25 | $25 | $625 |
| Jobs API | 200 | 10 | $8 | $80 |
| **Total** | **1,150** | **145** | | **$3,405/mo** |

After RapidAPI's 20% cut: **~$2,725/mo net**

## Heather's One-Time Actions
1. Create RapidAPI Provider account (free) — 5 min
2. Deploy to Render (connect GitHub repo) — 5 min
3. Create 7 API listings using descriptions above — 30 min total
4. Total cost: $0 (Render free tier + RapidAPI free to list)
