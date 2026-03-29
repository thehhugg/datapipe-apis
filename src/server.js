/**
 * RapidAPI Data Bundle — Multi-API Server
 * 
 * Hosts multiple data APIs behind a single Express server.
 * Each API is a separate route group, deployable as individual 
 * RapidAPI listings or as a bundle.
 * 
 * Revenue model: RapidAPI handles billing. We set prices per call.
 * - Basic: $0.001/call (1000 free/mo)
 * - Pro: $29/mo (10K calls)  
 * - Business: $99/mo (100K calls)
 */

import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';

import { jobsRouter } from './apis/jobs.js';
import { realEstateRouter } from './apis/real-estate.js';
import { businessDataRouter } from './apis/business-data.js';
import { govContractsRouter } from './apis/gov-contracts.js';
import { socialTrendsRouter } from './apis/social-trends.js';
import { emailFinderRouter } from './apis/email-finder.js';
import { techStackRouter } from './apis/tech-stack.js';
import { screenshotRouter } from './apis/screenshot.js';
import { whoisRouter } from './apis/whois.js';
import { companyEnrichmentRouter } from './apis/company-enrichment.js';
import { companyIntelRouter } from './apis/company-intel.js';
import { textAnalysisRouter } from './apis/text-analysis.js';
import { contentExtractorRouter } from './apis/content-extractor.js';
import { seoAnalysisRouter } from './apis/seo-analysis.js';
import { priceMonitorRouter } from './apis/price-monitor.js';
import { pageDiffRouter } from './apis/page-diff.js';
import { ipGeolocationRouter } from './apis/ip-geolocation.js';
import { qrCodeRouter } from './apis/qr-code.js';
import { urlRouter } from './apis/url-shortener.js';
import { rapidApiAuth, requestLogger } from './middleware/rapidapi-auth.js';

const app = express();
const PORT = process.env.PORT || 3000;

// Security
app.use(helmet());
app.use(cors());
app.use(express.json());

// RapidAPI authentication + request logging
app.use(rapidApiAuth);
app.use(requestLogger);

// Rate limiting (per-IP fallback; RapidAPI handles subscription limits)
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

// RapidAPI proxy secret validation
app.use((req, res, next) => {
  const rapidApiProxy = req.headers['x-rapidapi-proxy-secret'];
  const expectedSecret = process.env.RAPIDAPI_PROXY_SECRET;
  
  // In dev mode, skip validation
  if (!expectedSecret || process.env.NODE_ENV === 'development') {
    return next();
  }
  
  if (rapidApiProxy !== expectedSecret) {
    return res.status(403).json({ error: 'Unauthorized' });
  }
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

// API index
app.get('/', (req, res) => {
  res.json({
    name: 'DataPipe API Bundle',
    version: '1.0.0',
    apis: [
      { path: '/api/jobs', description: 'Remote & tech job listings' },
      { path: '/api/real-estate', description: 'Property listings & rental data' },
      { path: '/api/businesses', description: 'Local business data & enrichment' },
      { path: '/api/gov-contracts', description: 'Government contract opportunities' },
      { path: '/api/social-trends', description: 'Reddit & HN trending topics' },
      { path: '/api/email-finder', description: 'Find business email addresses' },
      { path: '/api/tech-stack', description: 'Detect website technology stack' },
      { path: '/api/screenshot', description: 'Capture website screenshots' },
      { path: '/api/whois', description: 'Domain WHOIS, DNS, SSL, and availability' },
      { path: '/api/enrich', description: 'Company enrichment — all-in-one company data from domain' },
      { path: '/api/intel', description: 'Company intelligence — full company profile from domain (emails, tech, DNS, socials)' },
      { path: '/api/text', description: 'Text analysis — readability, sentiment, keywords, content scoring' },
      { path: '/api/content', description: 'Content extraction — clean article/page text from any URL' },
      { path: '/api/seo', description: 'SEO analysis — on-page audit, headings, images, social tags, performance hints' },
      { path: '/api/monitor', description: 'Price & change monitor — track changes on any webpage' },
      { path: '/api/diff', description: 'Page diff — detect and report changes between page versions' },
      { path: '/api/ip', description: 'IP Geolocation — country, city, ISP, proxy detection' },
      { path: '/api/qr', description: 'QR Code Generator — create QR codes from any data' },
      { path: '/api/url', description: 'URL Metadata — OpenGraph, Twitter Cards, redirects, validation' },
    ],
    docs: 'https://rapidapi.com/datapipe',
  });
});

// Mount API routes
app.use('/api/jobs', jobsRouter);
app.use('/api/real-estate', realEstateRouter);
app.use('/api/businesses', businessDataRouter);
app.use('/api/gov-contracts', govContractsRouter);
app.use('/api/social-trends', socialTrendsRouter);
app.use('/api/email-finder', emailFinderRouter);
app.use('/api/tech-stack', techStackRouter);
app.use('/api/screenshot', screenshotRouter);
app.use('/api/whois', whoisRouter);
app.use('/api/enrich', companyEnrichmentRouter);
app.use('/api/intel', companyIntelRouter);
app.use('/api/text', textAnalysisRouter);
app.use('/api/content', contentExtractorRouter);
app.use('/api/seo', seoAnalysisRouter);
app.use('/api/monitor', priceMonitorRouter);
app.use('/api/diff', pageDiffRouter);
app.use('/api/ip', ipGeolocationRouter);
app.use('/api/qr', qrCodeRouter);
app.use('/api/url', urlRouter);

// Error handler
app.use((err, req, res, next) => {
  console.error(`[${new Date().toISOString()}] Error:`, err.message);
  res.status(500).json({ error: 'Internal server error', message: err.message });
});

app.listen(PORT, () => {
  console.log(`🚀 DataPipe API Bundle running on port ${PORT}`);
});
