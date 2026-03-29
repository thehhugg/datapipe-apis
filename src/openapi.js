/**
 * OpenAPI 3.0 specification for all APIs
 * Serves at /docs and /openapi.json
 * RapidAPI can auto-import from the OpenAPI spec
 */

export const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'DataPipe API Bundle',
    version: '1.0.0',
    description: 'A suite of powerful data APIs. Company enrichment, domain intelligence, SEO analysis, email validation, and more.',
    contact: { email: 'support@getdatapipe.com' }
  },
  servers: [
    { url: 'https://datapipe-apis.up.railway.app', description: 'Production' },
    { url: 'http://localhost:3000', description: 'Development' }
  ],
  paths: {
    '/api/enrich/company': {
      get: {
        tags: ['Company Enrichment'],
        summary: 'Enrich company data from domain',
        description: 'Get comprehensive company data from just a domain name. Returns description, tech stack, emails, phones, social links, DNS/MX records, and security headers.',
        parameters: [
          { name: 'domain', in: 'query', required: true, schema: { type: 'string' }, example: 'stripe.com', description: 'Company domain name' }
        ],
        responses: {
          200: { description: 'Company enrichment data' },
          400: { description: 'Missing domain parameter' },
          500: { description: 'Server error' }
        }
      }
    },
    '/api/enrich/bulk': {
      post: {
        tags: ['Company Enrichment'],
        summary: 'Bulk company enrichment',
        description: 'Enrich multiple companies at once. Send up to 10 domains.',
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  domains: { type: 'array', items: { type: 'string' }, example: ['stripe.com', 'github.com'] }
                }
              }
            }
          }
        },
        responses: { 200: { description: 'Bulk enrichment results' } }
      }
    },
    '/api/whois/lookup': {
      get: {
        tags: ['Domain Intelligence'],
        summary: 'WHOIS + DNS + SSL lookup',
        description: 'Complete domain intelligence: WHOIS registration, DNS records, SSL info, nameservers, and availability check.',
        parameters: [
          { name: 'domain', in: 'query', required: true, schema: { type: 'string' }, example: 'example.com' }
        ],
        responses: { 200: { description: 'Domain intelligence data' } }
      }
    },
    '/api/tech-stack/detect': {
      get: {
        tags: ['Tech Stack'],
        summary: 'Detect website technologies',
        description: 'Identify CMS, hosting, security headers, JS frameworks, DNS provider, email provider, and security grade.',
        parameters: [
          { name: 'url', in: 'query', required: true, schema: { type: 'string' }, example: 'https://stripe.com' }
        ],
        responses: { 200: { description: 'Technology detection results' } }
      }
    },
    '/api/seo/analyze': {
      get: {
        tags: ['SEO Analysis'],
        summary: 'On-page SEO audit',
        description: 'Instant SEO audit: title, meta, headings, images, links, Schema.org, security headers, and overall score with letter grade.',
        parameters: [
          { name: 'url', in: 'query', required: true, schema: { type: 'string' }, example: 'https://stripe.com' }
        ],
        responses: { 200: { description: 'SEO analysis results' } }
      }
    },
    '/api/email/validate': {
      get: {
        tags: ['Email Validator'],
        summary: 'Validate an email address',
        description: 'Check email syntax, MX records, disposable detection, free provider identification, role-based detection. Returns quality score 0-100.',
        parameters: [
          { name: 'email', in: 'query', required: true, schema: { type: 'string' }, example: 'test@gmail.com' }
        ],
        responses: { 200: { description: 'Email validation result' } }
      }
    },
    '/api/email/validate-bulk': {
      post: {
        tags: ['Email Validator'],
        summary: 'Bulk email validation',
        description: 'Validate up to 100 emails at once.',
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  emails: { type: 'array', items: { type: 'string' }, example: ['test@gmail.com', 'fake@tempmail.com'] }
                }
              }
            }
          }
        },
        responses: { 200: { description: 'Bulk validation results' } }
      }
    },
    '/api/intel/company': {
      get: {
        tags: ['Company Intel'],
        summary: 'Full company profile',
        description: 'Deep company intelligence from domain: registration history, employees, tech stack, social presence, emails, phones.',
        parameters: [
          { name: 'domain', in: 'query', required: true, schema: { type: 'string' }, example: 'stripe.com' }
        ],
        responses: { 200: { description: 'Company intelligence data' } }
      }
    },
    '/api/text/analyze': {
      post: {
        tags: ['Text Analysis'],
        summary: 'Analyze text content',
        description: 'Readability scores (Flesch-Kincaid, Coleman-Liau), sentiment analysis, keyword extraction, reading time estimation.',
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  text: { type: 'string', example: 'This is sample text to analyze for readability and sentiment.' }
                }
              }
            }
          }
        },
        responses: { 200: { description: 'Text analysis results' } }
      }
    },
    '/api/ip/lookup': {
      get: {
        tags: ['IP Geolocation'],
        summary: 'IP address geolocation',
        description: 'Get geographic location, ISP, organization, ASN, and proxy/VPN/hosting detection for any IP address.',
        parameters: [
          { name: 'ip', in: 'query', required: true, schema: { type: 'string' }, example: '8.8.8.8' }
        ],
        responses: { 200: { description: 'Geolocation data' } }
      }
    },
    '/api/social-trends/reddit': {
      get: {
        tags: ['Social Trends'],
        summary: 'Reddit trending posts',
        description: 'Get trending posts from any subreddit with scores, comments, and metadata.',
        parameters: [
          { name: 'subreddit', in: 'query', schema: { type: 'string', default: 'technology' }, description: 'Subreddit name' },
          { name: 'sort', in: 'query', schema: { type: 'string', enum: ['hot', 'new', 'top', 'rising'] }, description: 'Sort order' },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 25 }, description: 'Number of posts' }
        ],
        responses: { 200: { description: 'Trending posts data' } }
      }
    },
    '/api/content/extract': {
      get: {
        tags: ['Content Extractor'],
        summary: 'Extract readable content from URL',
        description: 'Convert any webpage to clean, readable text with metadata (title, description, author, language, links, images).',
        parameters: [
          { name: 'url', in: 'query', required: true, schema: { type: 'string' }, example: 'https://example.com' }
        ],
        responses: { 200: { description: 'Extracted content' } }
      }
    },
    '/api/qr/generate': {
      get: {
        tags: ['QR Code'],
        summary: 'Generate QR code',
        description: 'Generate QR codes as SVG images. Supports custom size, error correction level, and colors.',
        parameters: [
          { name: 'data', in: 'query', required: true, schema: { type: 'string' }, example: 'https://example.com' },
          { name: 'size', in: 'query', schema: { type: 'integer', default: 256 }, description: 'Image size in pixels' }
        ],
        responses: { 200: { description: 'QR code SVG image', content: { 'image/svg+xml': {} } } }
      }
    },
    '/api/url/metadata': {
      get: {
        tags: ['URL Tools'],
        summary: 'Get URL metadata',
        description: 'Extract OpenGraph, Twitter Card, and HTML metadata from any URL.',
        parameters: [
          { name: 'url', in: 'query', required: true, schema: { type: 'string' }, example: 'https://example.com' }
        ],
        responses: { 200: { description: 'URL metadata' } }
      }
    },
    '/api/email-finder/domain': {
      get: {
        tags: ['Email Finder'],
        summary: 'Find emails for a domain',
        description: 'Discover business email addresses by scraping the company website and checking common email patterns.',
        parameters: [
          { name: 'domain', in: 'query', required: true, schema: { type: 'string' }, example: 'anthropic.com' }
        ],
        responses: { 200: { description: 'Found emails and MX info' } }
      }
    },
    '/api/diff/compare': {
      post: {
        tags: ['Page Monitoring'],
        summary: 'Monitor webpage changes',
        description: 'Track changes to any webpage. First call captures a snapshot, subsequent calls compare against previous snapshot.',
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  url: { type: 'string', example: 'https://example.com' }
                }
              }
            }
          }
        },
        responses: { 200: { description: 'Diff comparison results' } }
      }
    }
  }
};

export function setupDocs(app) {
  // Serve OpenAPI JSON spec
  app.get('/openapi.json', (req, res) => {
    res.json(openApiSpec);
  });

  // Simple docs page
  app.get('/docs', (req, res) => {
    res.send(`<!DOCTYPE html>
<html><head>
<title>DataPipe API Docs</title>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css"/>
</head><body>
<div id="swagger-ui"></div>
<script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
<script>SwaggerUIBundle({ url: '/openapi.json', dom_id: '#swagger-ui' });</script>
</body></html>`);
  });
}
