/**
 * AI Content Generator API — Business Content Generation
 * 
 * Generates professional business content using smart templates + 
 * NLP-style text manipulation. No external AI API needed.
 * 
 * High demand on RapidAPI — content generation APIs get huge volume.
 * 
 * Endpoints:
 *   POST /api/ai-content/product-description
 *   POST /api/ai-content/meta-tags
 *   POST /api/ai-content/business-name
 *   POST /api/ai-content/tagline
 *   POST /api/ai-content/email-subject
 *   POST /api/ai-content/review-response
 */

import { Router } from 'express';

export const aiContentRouter = Router();

// ============ PRODUCT DESCRIPTION GENERATOR ============

const TONES = {
  professional: { adjectives: ['premium', 'exceptional', 'reliable', 'professional-grade', 'industry-leading'], openers: ['Introducing', 'Discover', 'Experience', 'Elevate your workflow with'], closers: ['Perfect for professionals who demand the best.', 'Built for those who expect excellence.', 'The smart choice for discerning buyers.'] },
  casual: { adjectives: ['awesome', 'super handy', 'game-changing', 'must-have', 'seriously cool'], openers: ['Check out', 'You\'re gonna love', 'Say hello to', 'Meet your new favorite'], closers: ['Trust us, you need this.', 'Your future self will thank you.', 'Go ahead, treat yourself.'] },
  luxury: { adjectives: ['exquisite', 'handcrafted', 'bespoke', 'refined', 'masterfully designed'], openers: ['Indulge in', 'Immerse yourself in', 'Behold', 'For the discerning eye'], closers: ['An investment in timeless quality.', 'Where luxury meets functionality.', 'Crafted for those who settle for nothing less.'] },
  technical: { adjectives: ['high-performance', 'precision-engineered', 'cutting-edge', 'optimized', 'enterprise-ready'], openers: ['Engineered for', 'Built with', 'Designed from the ground up for', 'Purpose-built for'], closers: ['Backed by rigorous testing and industry standards.', 'Engineered to exceed expectations.', 'The technical choice for demanding applications.'] },
  friendly: { adjectives: ['delightful', 'easy-to-use', 'thoughtfully designed', 'lovable', 'intuitive'], openers: ['We made', 'Here\'s something special:', 'We\'re excited to share', 'Good news:'], closers: ['We think you\'ll love it as much as we do.', 'Made with love and a whole lot of care.', 'Because you deserve something that just works.'] }
};

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function capitalize(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

function generateProductDescription(product, features = [], tone = 'professional', length = 'medium') {
  const t = TONES[tone] || TONES.professional;
  const featureList = features.length > 0 ? features : ['quality design', 'reliable performance', 'great value'];
  
  const opener = pick(t.openers);
  const adj1 = pick(t.adjectives);
  const adj2 = pick(t.adjectives.filter(a => a !== adj1));
  const closer = pick(t.closers);
  
  const featureBullets = featureList.map(f => `• ${capitalize(f.trim())}`).join('\n');
  
  const shortDesc = `${opener} ${product} — a ${adj1}, ${adj2} solution designed to deliver results. ${closer}`;
  
  const mediumDesc = `${opener} ${product} — a ${adj1} solution built for real results.

Key features:
${featureBullets}

${closer}`;

  const longDesc = `${opener} ${product}.

In a world full of mediocre options, ${product} stands apart as a truly ${adj1} solution. Every detail has been ${adj2.replace('-', ' ')} to ensure you get the best possible experience.

What makes it special:
${featureBullets}

Whether you're a first-time buyer or a seasoned professional, ${product} delivers ${pick(['exceptional', 'outstanding', 'remarkable', 'unmatched'])} value at every level.

${closer}`;

  const descriptions = { short: shortDesc, medium: mediumDesc, long: longDesc };
  return {
    description: descriptions[length] || descriptions.medium,
    variants: {
      short: shortDesc,
      medium: mediumDesc,
      long: longDesc
    },
    metadata: { product, tone, features: featureList, generatedAt: new Date().toISOString() }
  };
}

// ============ META TAGS GENERATOR ============

function generateMetaTags(page) {
  const { title, description, keywords = [], url, type = 'website' } = page;
  
  const metaDesc = description || `${title} - Learn more about our offering and how it can help you succeed.`;
  const truncatedDesc = metaDesc.length > 160 ? metaDesc.substring(0, 157) + '...' : metaDesc;
  const truncatedTitle = title.length > 60 ? title.substring(0, 57) + '...' : title;
  const keywordsStr = keywords.join(', ');
  
  return {
    html: `<title>${truncatedTitle}</title>
<meta name="description" content="${truncatedDesc}">
<meta name="keywords" content="${keywordsStr}">
<meta property="og:title" content="${truncatedTitle}">
<meta property="og:description" content="${truncatedDesc}">
<meta property="og:type" content="${type}">
${url ? `<meta property="og:url" content="${url}">` : ''}
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${truncatedTitle}">
<meta name="twitter:description" content="${truncatedDesc}">`,
    tags: {
      title: truncatedTitle,
      description: truncatedDesc,
      keywords: keywordsStr,
      ogTitle: truncatedTitle,
      ogDescription: truncatedDesc,
      ogType: type,
      ogUrl: url || null,
      twitterCard: 'summary_large_image',
      twitterTitle: truncatedTitle,
      twitterDescription: truncatedDesc
    },
    seoScore: calculateSeoScore(truncatedTitle, truncatedDesc, keywords),
    suggestions: getSeoSuggestions(title, description, keywords)
  };
}

function calculateSeoScore(title, desc, keywords) {
  let score = 50;
  if (title.length >= 30 && title.length <= 60) score += 15; else if (title.length > 0) score += 5;
  if (desc.length >= 120 && desc.length <= 160) score += 15; else if (desc.length > 0) score += 5;
  if (keywords.length >= 3 && keywords.length <= 10) score += 10; else if (keywords.length > 0) score += 5;
  if (keywords.some(k => title.toLowerCase().includes(k.toLowerCase()))) score += 10;
  return Math.min(score, 100);
}

function getSeoSuggestions(title, desc, keywords) {
  const suggestions = [];
  if (!title || title.length < 30) suggestions.push('Title should be 30-60 characters for optimal SEO');
  if (title && title.length > 60) suggestions.push('Title exceeds 60 characters — may be truncated in search results');
  if (!desc || desc.length < 120) suggestions.push('Meta description should be 120-160 characters');
  if (!keywords || keywords.length < 3) suggestions.push('Add at least 3 relevant keywords');
  if (keywords && keywords.length > 10) suggestions.push('Too many keywords — focus on 5-10 most relevant');
  return suggestions;
}

// ============ BUSINESS NAME GENERATOR ============

const NAME_PATTERNS = [
  (w, s) => `${w}${s}`,          // WordSuffix
  (w, s) => `${s}${w}`,          // PrefixWord
  (w) => `${w}ly`,               // Wordly
  (w) => `${w}ify`,              // Wordify
  (w) => `${w}Hub`,              // WordHub
  (w) => `${w}Labs`,             // WordLabs
  (w) => `${w}Works`,            // WordWorks
  (w) => `${w}Stack`,            // WordStack
  (w) => `${w}Base`,             // WordBase
  (w) => `${w}Flow`,             // WordFlow
  (w) => `${w}Path`,             // WordPath
  (w) => `${w}Forge`,            // WordForge
  (w) => `${w}Nest`,             // WordNest
  (w) => `${w}Pulse`,            // WordPulse
  (w) => `${w}Spark`,            // WordSpark
  (w) => `${w}Wave`,             // WordWave
  (w) => `${w}Peak`,             // WordPeak
  (w) => `${w}Mind`,             // WordMind
  (w) => `Get${w}`,              // GetWord
  (w) => `Try${w}`,              // TryWord
  (w) => `Use${w}`,              // UseWord
  (w) => `Go${w}`,               // GoWord
  (w) => `My${w}`,               // MyWord
];

const SUFFIXES = ['AI', 'Pro', 'HQ', 'App', 'Cloud', 'Bot', 'Zen', 'Bit', 'Ops'];
const PREFIXES = ['Neo', 'Nova', 'Apex', 'Prime', 'Swift', 'Bright', 'Clear', 'True', 'Blue'];

function generateBusinessNames(industry, keywords = [], count = 10) {
  const names = new Set();
  const words = [industry, ...keywords].map(w => capitalize(w.trim().replace(/\s+/g, '')));
  
  for (const word of words) {
    for (const pattern of NAME_PATTERNS) {
      const suffix = pick(SUFFIXES);
      const prefix = pick(PREFIXES);
      names.add(pattern(word, suffix));
      names.add(pattern(word, prefix));
    }
  }
  
  // Compound names
  if (words.length >= 2) {
    for (let i = 0; i < words.length; i++) {
      for (let j = i + 1; j < words.length; j++) {
        names.add(`${words[i]}${words[j]}`);
        names.add(`${words[j]}${words[i]}`);
      }
    }
  }
  
  const result = [...names]
    .filter(n => n.length >= 4 && n.length <= 20)
    .sort(() => Math.random() - 0.5)
    .slice(0, count);
  
  return {
    names: result.map(name => ({
      name,
      domain: `${name.toLowerCase()}.com`,
      length: name.length,
      style: name.length <= 8 ? 'short' : name.length <= 12 ? 'medium' : 'long'
    })),
    industry,
    keywords,
    generatedAt: new Date().toISOString()
  };
}

// ============ TAGLINE GENERATOR ============

const TAGLINE_TEMPLATES = [
  (p) => `${p}. Simplified.`,
  (p) => `${p} — the way it should be.`,
  (p) => `Rethink ${p.toLowerCase()}.`,
  (p) => `${p} without the hassle.`,
  (p) => `The smarter way to ${p.toLowerCase()}.`,
  (p) => `${p}, made effortless.`,
  (p) => `Where ${p.toLowerCase()} meets simplicity.`,
  (p) => `${p} that actually works.`,
  (p) => `Beyond ${p.toLowerCase()}.`,
  (p) => `${p}. Reimagined.`,
  (p) => `Your ${p.toLowerCase()} partner.`,
  (p) => `${p} for the modern world.`,
  (p) => `Say goodbye to ${p.toLowerCase()} headaches.`,
  (p) => `The future of ${p.toLowerCase()} is here.`,
  (p) => `${p}. Better, faster, smarter.`,
];

function generateTaglines(topic, count = 5) {
  const results = TAGLINE_TEMPLATES
    .sort(() => Math.random() - 0.5)
    .slice(0, count)
    .map(t => t(capitalize(topic)));
  
  return {
    taglines: results,
    topic,
    generatedAt: new Date().toISOString()
  };
}

// ============ EMAIL SUBJECT LINE GENERATOR ============

const SUBJECT_TEMPLATES = {
  promotional: [
    (p) => `🔥 ${p} — Limited Time Offer`,
    (p) => `Don't miss out on ${p}`,
    (p) => `${p}: Save big today`,
    (p) => `Your exclusive ${p} deal inside`,
    (p) => `Last chance: ${p} at unbeatable prices`,
  ],
  newsletter: [
    (p) => `This week in ${p}`,
    (p) => `${p} digest: What you need to know`,
    (p) => `The latest on ${p} — your weekly roundup`,
    (p) => `${p} insights you won't find elsewhere`,
    (p) => `What's new in ${p} this week`,
  ],
  coldOutreach: [
    (p) => `Quick question about your ${p}`,
    (p) => `Idea for improving your ${p}`,
    (p) => `${p} — are you seeing these results?`,
    (p) => `Re: your ${p} strategy`,
    (p) => `[${p}] Can we help?`,
  ],
  followUp: [
    (p) => `Following up on ${p}`,
    (p) => `Did you get a chance to look at ${p}?`,
    (p) => `Checking in re: ${p}`,
    (p) => `Any thoughts on ${p}?`,
    (p) => `${p} — next steps?`,
  ],
  transactional: [
    (p) => `Your ${p} is confirmed`,
    (p) => `${p} — receipt attached`,
    (p) => `Update on your ${p}`,
    (p) => `${p}: Action required`,
    (p) => `${p} status update`,
  ],
};

function generateEmailSubjects(topic, type = 'promotional', count = 5) {
  const templates = SUBJECT_TEMPLATES[type] || SUBJECT_TEMPLATES.promotional;
  const results = templates
    .sort(() => Math.random() - 0.5)
    .slice(0, count)
    .map(t => ({ subject: t(capitalize(topic)), type, characterCount: t(capitalize(topic)).length }));
  
  return {
    subjects: results,
    topic,
    type,
    bestPractices: [
      'Keep subject lines under 50 characters for mobile',
      'Use personalization when possible',
      'Create urgency without being spammy',
      'A/B test your top 2 choices',
      'Avoid ALL CAPS and excessive punctuation'
    ],
    generatedAt: new Date().toISOString()
  };
}

// ============ REVIEW RESPONSE GENERATOR ============

function generateReviewResponse(review) {
  const { text, rating, customerName, businessName = 'our business', category = 'general' } = review;
  
  let response;
  
  if (rating >= 4) {
    const positiveTemplates = [
      `Thank you so much for your wonderful review${customerName ? `, ${customerName}` : ''}! We're thrilled to hear about your great experience with ${businessName}. Your kind words mean the world to our team. We look forward to serving you again!`,
      `Wow, thank you${customerName ? ` ${customerName}` : ''}! We're so glad you had an amazing experience. Reviews like yours are what keep our team motivated. We can't wait to welcome you back to ${businessName}!`,
      `What a fantastic review${customerName ? `, ${customerName}` : ''}! We put our heart into everything we do at ${businessName}, and it's wonderful to know it shows. Thank you for taking the time to share your experience!`,
    ];
    response = pick(positiveTemplates);
  } else if (rating === 3) {
    const neutralTemplates = [
      `Thank you for your feedback${customerName ? `, ${customerName}` : ''}. We appreciate you sharing your experience with ${businessName}. We're always looking for ways to improve, and your input helps us do just that. We'd love to earn that 5th star next time!`,
      `We appreciate your honest review${customerName ? `, ${customerName}` : ''}. At ${businessName}, we strive for excellence and take all feedback seriously. We'd love to know what we could do better — please don't hesitate to reach out to us directly.`,
    ];
    response = pick(neutralTemplates);
  } else {
    const negativeTemplates = [
      `Thank you for bringing this to our attention${customerName ? `, ${customerName}` : ''}. This is not the experience we want anyone to have at ${businessName}. We take your feedback very seriously and would like to make this right. Please contact us directly so we can address your concerns personally.`,
      `We're sorry to hear about your experience${customerName ? `, ${customerName}` : ''}. At ${businessName}, we hold ourselves to the highest standards, and we clearly fell short. We'd truly appreciate the chance to make this right — please reach out to us at your convenience.`,
    ];
    response = pick(negativeTemplates);
  }
  
  return {
    response,
    rating,
    tone: rating >= 4 ? 'grateful' : rating === 3 ? 'constructive' : 'apologetic',
    wordCount: response.split(' ').length,
    guidelines: [
      'Always respond within 24-48 hours',
      'Never argue with the reviewer',
      'Take specific complaints offline',
      'Thank the reviewer regardless of rating',
      rating <= 2 ? 'Offer to make it right — this can turn critics into advocates' : 'Mention specific details from their review when possible'
    ],
    generatedAt: new Date().toISOString()
  };
}

// ============ ROUTES ============

aiContentRouter.post('/product-description', (req, res) => {
  try {
    const { product, features, tone, length } = req.body;
    if (!product) return res.status(400).json({ error: 'product is required' });
    res.json(generateProductDescription(product, features, tone, length));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

aiContentRouter.post('/meta-tags', (req, res) => {
  try {
    const { title, description, keywords, url, type } = req.body;
    if (!title) return res.status(400).json({ error: 'title is required' });
    res.json(generateMetaTags({ title, description, keywords, url, type }));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

aiContentRouter.post('/business-name', (req, res) => {
  try {
    const { industry, keywords, count } = req.body;
    if (!industry) return res.status(400).json({ error: 'industry is required' });
    res.json(generateBusinessNames(industry, keywords, count));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

aiContentRouter.post('/tagline', (req, res) => {
  try {
    const { topic, count } = req.body;
    if (!topic) return res.status(400).json({ error: 'topic is required' });
    res.json(generateTaglines(topic, count));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

aiContentRouter.post('/email-subject', (req, res) => {
  try {
    const { topic, type, count } = req.body;
    if (!topic) return res.status(400).json({ error: 'topic is required' });
    res.json(generateEmailSubjects(topic, type, count));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

aiContentRouter.post('/review-response', (req, res) => {
  try {
    const { text, rating, customerName, businessName, category } = req.body;
    if (rating === undefined) return res.status(400).json({ error: 'rating is required (1-5)' });
    res.json(generateReviewResponse({ text, rating, customerName, businessName, category }));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// API info
aiContentRouter.get('/', (req, res) => {
  res.json({
    name: 'AI Content Generator API',
    version: '1.0.0',
    endpoints: [
      { method: 'POST', path: '/product-description', description: 'Generate product descriptions in multiple tones and lengths' },
      { method: 'POST', path: '/meta-tags', description: 'Generate SEO meta tags with scoring and suggestions' },
      { method: 'POST', path: '/business-name', description: 'Generate creative business name ideas' },
      { method: 'POST', path: '/tagline', description: 'Generate catchy taglines for any topic' },
      { method: 'POST', path: '/email-subject', description: 'Generate email subject lines by type' },
      { method: 'POST', path: '/review-response', description: 'Generate professional review responses' },
    ]
  });
});
