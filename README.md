# DataPipe API Bundle

A suite of data APIs designed for the RapidAPI marketplace. Each API can be listed individually or as a bundle.

## APIs Included

### Tier 1 — Working, No External Keys Needed
| API | Endpoint | Description | Status |
|-----|----------|-------------|--------|
| **Social Trends** | `/api/social-trends` | Reddit & HN trending topics, real-time | ✅ Working |
| **WHOIS/DNS** | `/api/whois` | Domain WHOIS (RDAP), DNS records, SSL info, availability check | ✅ Working |
| **Tech Stack** | `/api/tech-stack` | Detect website technologies from headers & HTML | ✅ Working |
| **Email Finder** | `/api/email-finder` | Find business emails via scraping + pattern generation | ✅ Working |
| **Company Enrichment** | `/api/enrich` | All-in-one company data from a domain (tech, emails, DNS, socials) | ✅ Working |
| **Company Intel** | `/api/intel` | Full company profile from domain | ✅ Working |
| **Jobs (HN)** | `/api/jobs/hackernews` | HN Who's Hiring aggregation | ✅ Working |

### Tier 2 — Need External Keys or More Work
| API | Endpoint | Issue |
|-----|----------|-------|
| Screenshot | `/api/screenshot` | Needs Puppeteer or screenshotone.com key |
| Jobs (Remote) | `/api/jobs/remote` | RemoteOK blocks scraping |
| Gov Contracts | `/api/gov-contracts` | Needs SAM.gov API key |
| Real Estate | `/api/real-estate` | Source scraping unreliable |
| Business Data | `/api/businesses` | Google Maps scraping blocked |

## Quick Start

```bash
npm install
npm run dev       # Development with auto-reload
npm start         # Production
```

Server runs on port 3000 (or `PORT` env var).

## Environment Variables

```bash
# Required
PORT=3000
NODE_ENV=production

# Optional — enhance specific APIs
RAPIDAPI_PROXY_SECRET=your-secret      # Validates requests come from RapidAPI
SAM_GOV_API_KEY=your-key               # Enables gov contracts API
SCREENSHOTONE_API_KEY=your-key         # Better screenshots
PUPPETEER_AVAILABLE=true               # If Puppeteer is installed
```

## Deploy to Railway

```bash
# Already configured via railway.json
railway up
```

Or push to GitHub and connect Railway to the repo for auto-deploys.

## RapidAPI Listing Strategy

List the 5 strongest APIs individually on RapidAPI:
1. **Company Enrichment API** — $0.005/call, Pro $49/mo (10K calls)
2. **Tech Stack Detector** — $0.002/call, Pro $29/mo (15K calls)
3. **Domain Intelligence (WHOIS/DNS)** — $0.002/call, Pro $29/mo (15K calls)
4. **Email Finder** — $0.005/call, Pro $39/mo (8K calls)
5. **Social Trends API** — $0.001/call, Pro $19/mo (20K calls)

Each API gets a free tier (100-500 calls/month) to attract users, then paid tiers.

## Revenue Model

Conservative estimates at 50 paying subscribers per API:
- 5 APIs × 50 subscribers × $29 avg/mo = **$7,250/mo**
- RapidAPI takes 20% → **$5,800/mo net**

Even at 20 subscribers per API: **$2,320/mo net**

## Architecture

- Express.js server
- In-memory caching (TTL-based)
- No database required
- No external API keys required for Tier 1 APIs
- Cheerio for HTML parsing
- Native fetch for HTTP requests
