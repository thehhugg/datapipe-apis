# RapidAPI Listing Specifications

## Deployment Steps (One-Time)

1. Deploy to Railway: `railway up` (or connect GitHub repo for auto-deploy)
2. Set `PORT` and `NODE_ENV=production` in Railway env vars
3. Create RapidAPI provider account at https://rapidapi.com/provider
4. Create each API listing below, point to Railway URL
5. Set `RAPIDAPI_PROXY_SECRET` in Railway after creating listings
6. Activate free tier → wait for subscribers → profit

Total setup time: ~30 minutes.

---

## API 1: Company Intelligence API ⭐ (Flagship)

**RapidAPI Category:** Business / Company Data
**Base URL:** `https://{railway-url}/api/intel`

### Description
Get comprehensive company intelligence from any domain. Returns tech stack, email addresses, phone numbers, social links, DNS/hosting infrastructure, email provider, security posture, and more — all from a single API call. No API key needed on your end.

### Endpoints
- `GET /company?domain=stripe.com` — Full company profile

### Pricing
| Plan | Price | Calls/Month | Rate Limit |
|------|-------|-------------|------------|
| Basic (Free) | $0 | 100 | 10/min |
| Pro | $29/mo | 5,000 | 30/min |
| Ultra | $79/mo | 25,000 | 60/min |
| Mega | $199/mo | 100,000 | 120/min |

### Comparable APIs on RapidAPI
- Clearbit Company → $99/mo for 2,500 calls
- Hunter.io → $49/mo for 500 lookups
- **Our edge:** Cheaper, no external API dependency, fast

---

## API 2: Tech Stack Detector

**RapidAPI Category:** Tools / Web Analysis
**Base URL:** `https://{railway-url}/api/tech-stack`

### Description
Detect technologies used by any website: CMS (WordPress, Shopify, Webflow), frameworks (React, Vue, Next.js), analytics (GA, GTM, Hotjar), CDN (Cloudflare, Fastly), e-commerce platforms, marketing tools, security headers, and email infrastructure. 160+ technology signatures. Includes security header grading.

### Endpoints
- `GET /detect?url=github.com` — Scan a website
- `GET /categories` — List all detectable technologies

### Pricing
| Plan | Price | Calls/Month | Rate Limit |
|------|-------|-------------|------------|
| Basic (Free) | $0 | 200 | 10/min |
| Pro | $19/mo | 10,000 | 30/min |
| Ultra | $49/mo | 50,000 | 60/min |
| Mega | $129/mo | 200,000 | 120/min |

### Comparable APIs
- BuiltWith → $295/mo
- Wappalyzer → $99/mo for 50K
- **Our edge:** 5-10x cheaper for comparable functionality

---

## API 3: Domain Intelligence (WHOIS/DNS/SSL)

**RapidAPI Category:** Tools / DNS & Domain
**Base URL:** `https://{railway-url}/api/whois`

### Description
Complete domain intelligence: WHOIS/RDAP registration data, DNS records (A, AAAA, MX, NS, TXT, CNAME, SOA), SSL certificate info, email provider detection, DNS provider detection, SPF/DMARC verification, and domain availability checking. All from public sources — no external API keys needed.

### Endpoints
- `GET /lookup?domain=stripe.com` — Full domain profile (WHOIS + DNS + SSL)
- `GET /dns?domain=stripe.com` — DNS records only
- `GET /ssl?domain=stripe.com` — SSL/HTTPS info
- `GET /availability?domain=newstartup.com` — Availability heuristic

### Pricing
| Plan | Price | Calls/Month | Rate Limit |
|------|-------|-------------|------------|
| Basic (Free) | $0 | 200 | 20/min |
| Pro | $14.99/mo | 10,000 | 60/min |
| Ultra | $39/mo | 50,000 | 120/min |
| Mega | $99/mo | 200,000 | 300/min |

---

## API 4: SEO Analyzer

**RapidAPI Category:** Tools / SEO
**Base URL:** `https://{railway-url}/api/seo`

### Description
On-page SEO audit for any URL. Returns title analysis, meta description check, heading structure, image alt text audit, link analysis (internal/external), OpenGraph/Twitter card validation, canonical URL check, robots directives, and an overall SEO score with grade (A-F). Identifies critical issues, warnings, and optimization opportunities.

### Endpoints
- `GET /analyze?url=https://example.com` — Full SEO audit

### Pricing
| Plan | Price | Calls/Month | Rate Limit |
|------|-------|-------------|------------|
| Basic (Free) | $0 | 100 | 5/min |
| Pro | $19/mo | 5,000 | 20/min |
| Ultra | $49/mo | 25,000 | 40/min |
| Mega | $129/mo | 100,000 | 80/min |

---

## API 5: Social Trends (Reddit + HN)

**RapidAPI Category:** Social / Content & News
**Base URL:** `https://{railway-url}/api/social-trends`

### Description
Real-time trending content from Reddit and Hacker News. Get top/hot/new/rising posts from any subreddit with scores, comments, upvote ratios, and flair. Get HN top/new/best/ask/show stories. Perfect for content monitoring, trend detection, and market research.

### Endpoints
- `GET /reddit?subreddit=technology&limit=25&sort=hot` — Reddit trends
- `GET /hackernews?type=top&limit=30` — HN trends

### Pricing
| Plan | Price | Calls/Month | Rate Limit |
|------|-------|-------------|------------|
| Basic (Free) | $0 | 500 | 20/min |
| Pro | $9.99/mo | 10,000 | 60/min |
| Ultra | $29/mo | 50,000 | 120/min |

---

## API 6: Content Extractor

**RapidAPI Category:** Tools / Text & Content
**Base URL:** `https://{railway-url}/api/content`

### Description
Extract clean, readable content from any webpage. Returns structured data: title, description, author, publish date, canonical URL, language, main text content, word count, all links, and images. Perfect for content aggregation, research, and data pipelines.

### Endpoints
- `GET /extract?url=https://example.com` — Extract page content

### Pricing
| Plan | Price | Calls/Month | Rate Limit |
|------|-------|-------------|------------|
| Basic (Free) | $0 | 200 | 10/min |
| Pro | $14.99/mo | 10,000 | 30/min |
| Ultra | $39/mo | 50,000 | 60/min |

---

## API 7: Text Analysis

**RapidAPI Category:** Tools / Text Analytics
**Base URL:** `https://{railway-url}/api/text`

### Description
Comprehensive text analytics: word/sentence/paragraph statistics, readability scores (Flesch-Kincaid, Coleman-Liau), reading level, sentiment analysis (positive/negative/neutral with word-level detail), and reading/speaking time estimates. No external APIs — all processing done server-side.

### Endpoints
- `POST /analyze` — Analyze text (body: `{ "text": "..." }`)

### Pricing
| Plan | Price | Calls/Month | Rate Limit |
|------|-------|-------------|------------|
| Basic (Free) | $0 | 500 | 20/min |
| Pro | $9.99/mo | 20,000 | 60/min |
| Ultra | $29/mo | 100,000 | 120/min |

---

## Revenue Projections (Conservative)

### Month 1 (Listing + organic discovery)
- Company Intel: 10 Pro subs × $29 = $290
- Tech Stack: 15 Pro subs × $19 = $285
- Domain Intel: 20 Pro subs × $15 = $300
- SEO Analyzer: 10 Pro subs × $19 = $190
- Social Trends: 20 Pro subs × $10 = $200
- Content Extractor: 10 Pro subs × $15 = $150
- Text Analysis: 10 Pro subs × $10 = $100
- **Subtotal: $1,515/mo → after RapidAPI 20% cut: ~$1,212/mo**

### Month 3 (With some traction)
- 3x subscriber growth per API
- **~$3,636/mo net**

### Month 6
- 8x from month 1
- **~$9,696/mo net** → approaching $10K goal

### Keys to Growth
1. Generous free tiers drive adoption
2. Each API cross-promotes others
3. SEO blog posts for "free [X] API" keywords
4. Build code examples in Python, JavaScript, PHP
5. Reply to RapidAPI community questions about these use cases
