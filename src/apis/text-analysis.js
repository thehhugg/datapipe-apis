/**
 * Text Analysis API — Content Intelligence
 * 
 * Zero-dependency NLP: readability scores, keyword extraction,
 * sentiment analysis, content scoring, and text statistics.
 * No external APIs or LLMs — all rule-based, fast, and free to run.
 * 
 * High demand on RapidAPI: content marketers, SEO tools, writing apps.
 */

import { Router } from 'express';

const router = Router();

// ── Readability Formulas ──

function countSyllables(word) {
  word = word.toLowerCase().replace(/[^a-z]/g, '');
  if (word.length <= 3) return 1;
  word = word.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '');
  word = word.replace(/^y/, '');
  const matches = word.match(/[aeiouy]{1,2}/g);
  return matches ? matches.length : 1;
}

function tokenize(text) {
  return text.split(/\s+/).filter(w => w.length > 0);
}

function sentences(text) {
  return text.split(/[.!?]+/).filter(s => s.trim().length > 0);
}

function fleschKincaid(words, sents, syllables) {
  if (sents === 0 || words === 0) return 0;
  return 0.39 * (words / sents) + 11.8 * (syllables / words) - 15.59;
}

function fleschReadingEase(words, sents, syllables) {
  if (sents === 0 || words === 0) return 0;
  return 206.835 - 1.015 * (words / sents) - 84.6 * (syllables / words);
}

function colemanLiau(text, words, sents) {
  if (words === 0 || sents === 0) return 0;
  const letters = text.replace(/[^a-zA-Z]/g, '').length;
  const L = (letters / words) * 100;
  const S = (sents / words) * 100;
  return 0.0588 * L - 0.296 * S - 15.8;
}

function readingLevel(grade) {
  if (grade < 1) return 'Kindergarten';
  if (grade <= 5) return 'Elementary';
  if (grade <= 8) return 'Middle School';
  if (grade <= 12) return 'High School';
  if (grade <= 16) return 'College';
  return 'Graduate';
}

// ── Keyword Extraction (TF-based) ──

const STOP_WORDS = new Set([
  'the','be','to','of','and','a','in','that','have','i','it','for','not','on','with',
  'he','as','you','do','at','this','but','his','by','from','they','we','say','her',
  'she','or','an','will','my','one','all','would','there','their','what','so','up',
  'out','if','about','who','get','which','go','me','when','make','can','like','time',
  'no','just','him','know','take','people','into','year','your','good','some','could',
  'them','see','other','than','then','now','look','only','come','its','over','think',
  'also','back','after','use','two','how','our','work','first','well','way','even',
  'new','want','because','any','these','give','day','most','us','is','are','was',
  'were','been','being','has','had','did','does','done','very','much','more',
]);

function extractKeywords(text, topN = 10) {
  const words = text.toLowerCase().replace(/[^a-z0-9\s'-]/g, '').split(/\s+/);
  const freq = {};
  for (const word of words) {
    if (word.length < 3 || STOP_WORDS.has(word)) continue;
    freq[word] = (freq[word] || 0) + 1;
  }
  return Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([word, count]) => ({ word, count, density: +(count / words.length * 100).toFixed(2) }));
}

// ── N-gram Extraction ──

function extractNgrams(text, n = 2, topN = 10) {
  const words = text.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(w => w.length > 0);
  const freq = {};
  for (let i = 0; i <= words.length - n; i++) {
    const gram = words.slice(i, i + n);
    if (gram.some(w => STOP_WORDS.has(w))) continue;
    const key = gram.join(' ');
    freq[key] = (freq[key] || 0) + 1;
  }
  return Object.entries(freq)
    .filter(([, count]) => count > 1)
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([phrase, count]) => ({ phrase, count }));
}

// ── Simple Sentiment Analysis ──

const POSITIVE_WORDS = new Set([
  'good','great','excellent','amazing','wonderful','fantastic','love','happy','best',
  'perfect','beautiful','awesome','outstanding','brilliant','superb','incredible',
  'remarkable','exceptional','magnificent','delightful','pleasant','positive','nice',
  'enjoy','success','win','winning','benefit','improved','improve','recommend',
  'impressive','innovative','effective','efficient','valuable','reliable','quality',
]);

const NEGATIVE_WORDS = new Set([
  'bad','terrible','awful','horrible','worst','hate','ugly','poor','disappointing',
  'failed','failure','useless','broken','waste','annoying','frustrating','difficult',
  'problem','issue','error','bug','crash','slow','expensive','overpriced','mediocre',
  'lacking','weak','flawed','defective','unreliable','complicated','confusing',
  'misleading','scam','fraud','fake','avoid','regret','unfortunately','negative',
]);

const NEGATORS = new Set(['not','no','never','neither','nor','nobody','nothing','nowhere','hardly','barely','scarcely']);
const INTENSIFIERS = new Set(['very','extremely','incredibly','really','absolutely','completely','totally','utterly','highly']);

function analyzeSentiment(text) {
  const words = text.toLowerCase().replace(/[^a-z\s]/g, '').split(/\s+/);
  let positive = 0, negative = 0;
  
  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const prevWord = i > 0 ? words[i - 1] : '';
    const isNegated = NEGATORS.has(prevWord);
    const isIntensified = INTENSIFIERS.has(prevWord);
    const multiplier = isIntensified ? 1.5 : 1;
    
    if (POSITIVE_WORDS.has(word)) {
      if (isNegated) negative += multiplier;
      else positive += multiplier;
    }
    if (NEGATIVE_WORDS.has(word)) {
      if (isNegated) positive += multiplier;
      else negative += multiplier;
    }
  }
  
  const total = positive + negative || 1;
  const score = (positive - negative) / total; // -1 to 1
  
  let label = 'neutral';
  if (score > 0.2) label = 'positive';
  else if (score > 0.5) label = 'very_positive';
  else if (score < -0.2) label = 'negative';
  else if (score < -0.5) label = 'very_negative';
  
  return {
    score: +score.toFixed(3),
    label,
    positive: +positive.toFixed(1),
    negative: +negative.toFixed(1),
    positiveWords: words.filter(w => POSITIVE_WORDS.has(w)),
    negativeWords: words.filter(w => NEGATIVE_WORDS.has(w)),
  };
}

// ── Content Score (SEO-oriented) ──

function scoreContent(text) {
  const wordList = tokenize(text);
  const sentList = sentences(text);
  const wordCount = wordList.length;
  const sentCount = sentList.length;
  const syllableCount = wordList.reduce((sum, w) => sum + countSyllables(w), 0);
  
  const scores = {};
  
  // Length score (ideal: 1000-2000 words for blog posts)
  if (wordCount < 100) scores.length = { score: 20, note: 'Very short. Aim for 300+ words.' };
  else if (wordCount < 300) scores.length = { score: 40, note: 'Short. Good for product descriptions.' };
  else if (wordCount < 800) scores.length = { score: 60, note: 'Medium length. Good for most content.' };
  else if (wordCount < 2000) scores.length = { score: 90, note: 'Ideal length for SEO blog posts.' };
  else scores.length = { score: 75, note: 'Long form. Consider breaking into sections.' };
  
  // Readability score (ideal: 6th-8th grade for web content)
  const fk = fleschKincaid(wordCount, sentCount, syllableCount);
  if (fk >= 5 && fk <= 9) scores.readability = { score: 90, note: 'Perfect readability for web.' };
  else if (fk >= 3 && fk <= 12) scores.readability = { score: 70, note: 'Acceptable readability.' };
  else scores.readability = { score: 40, note: 'May be too complex or too simple.' };
  
  // Sentence variety
  const sentLengths = sentList.map(s => tokenize(s).length);
  const avgSentLen = sentLengths.reduce((a, b) => a + b, 0) / (sentCount || 1);
  const sentVariance = sentLengths.reduce((sum, l) => sum + Math.pow(l - avgSentLen, 2), 0) / (sentCount || 1);
  if (sentVariance > 30) scores.variety = { score: 85, note: 'Good sentence variety.' };
  else if (sentVariance > 10) scores.variety = { score: 60, note: 'Moderate variety. Mix short and long sentences.' };
  else scores.variety = { score: 30, note: 'Repetitive sentence structure.' };
  
  // Keyword density (top keyword shouldn't exceed 3%)
  const keywords = extractKeywords(text, 3);
  const topDensity = keywords[0]?.density || 0;
  if (topDensity > 0.5 && topDensity < 3) scores.keywords = { score: 85, note: 'Good keyword presence.' };
  else if (topDensity >= 3) scores.keywords = { score: 40, note: 'Keyword stuffing risk. Reduce repetition.' };
  else scores.keywords = { score: 50, note: 'Low keyword density. Add focus keywords.' };
  
  const overall = Math.round(
    Object.values(scores).reduce((sum, s) => sum + s.score, 0) / Object.keys(scores).length
  );
  
  return { overall, breakdown: scores, topKeywords: keywords };
}

// ── Routes ──

// Full text analysis
router.post('/analyze', (req, res) => {
  try {
    const { text } = req.body;
    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'text field required (string)' });
    }
    if (text.length > 100000) {
      return res.status(400).json({ error: 'Text too long. Max 100,000 characters.' });
    }
    
    const wordList = tokenize(text);
    const sentList = sentences(text);
    const wordCount = wordList.length;
    const sentCount = sentList.length;
    const syllableCount = wordList.reduce((sum, w) => sum + countSyllables(w), 0);
    const charCount = text.length;
    const charNoSpaces = text.replace(/\s/g, '').length;
    const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 0).length;
    const avgWordLength = charNoSpaces / (wordCount || 1);
    const avgSentenceLength = wordCount / (sentCount || 1);
    
    const fkGrade = fleschKincaid(wordCount, sentCount, syllableCount);
    const fre = fleschReadingEase(wordCount, sentCount, syllableCount);
    const cli = colemanLiau(text, wordCount, sentCount);
    
    const readingTimeMinutes = +(wordCount / 238).toFixed(1); // avg adult reading speed
    const speakingTimeMinutes = +(wordCount / 150).toFixed(1);
    
    res.json({
      statistics: {
        characters: charCount,
        charactersNoSpaces: charNoSpaces,
        words: wordCount,
        sentences: sentCount,
        paragraphs,
        syllables: syllableCount,
        avgWordLength: +avgWordLength.toFixed(1),
        avgSentenceLength: +avgSentenceLength.toFixed(1),
        readingTimeMinutes,
        speakingTimeMinutes,
      },
      readability: {
        fleschKincaidGrade: +fkGrade.toFixed(1),
        fleschReadingEase: +fre.toFixed(1),
        colemanLiauIndex: +cli.toFixed(1),
        readingLevel: readingLevel(fkGrade),
      },
      sentiment: analyzeSentiment(text),
      keywords: extractKeywords(text, 15),
      bigrams: extractNgrams(text, 2, 10),
      trigrams: extractNgrams(text, 3, 5),
    });
  } catch (err) {
    res.status(500).json({ error: 'Analysis failed', message: err.message });
  }
});

// Readability only
router.post('/readability', (req, res) => {
  try {
    const { text } = req.body;
    if (!text) return res.status(400).json({ error: 'text field required' });
    
    const wordList = tokenize(text);
    const sentList = sentences(text);
    const syllableCount = wordList.reduce((sum, w) => sum + countSyllables(w), 0);
    const fkGrade = fleschKincaid(wordList.length, sentList.length, syllableCount);
    
    res.json({
      fleschKincaidGrade: +fkGrade.toFixed(1),
      fleschReadingEase: +fleschReadingEase(wordList.length, sentList.length, syllableCount).toFixed(1),
      colemanLiauIndex: +colemanLiau(text, wordList.length, sentList.length).toFixed(1),
      readingLevel: readingLevel(fkGrade),
      words: wordList.length,
      sentences: sentList.length,
      avgSentenceLength: +(wordList.length / (sentList.length || 1)).toFixed(1),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Sentiment only
router.post('/sentiment', (req, res) => {
  try {
    const { text } = req.body;
    if (!text) return res.status(400).json({ error: 'text field required' });
    res.json(analyzeSentiment(text));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Keywords only
router.get('/keywords', (req, res) => {
  try {
    const text = req.query.text || req.body?.text;
    const topN = parseInt(req.query.top) || 10;
    if (!text) return res.status(400).json({ error: 'text parameter required' });
    res.json({ keywords: extractKeywords(text, topN) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/keywords', (req, res) => {
  try {
    const { text, top = 10 } = req.body;
    if (!text) return res.status(400).json({ error: 'text field required' });
    res.json({ keywords: extractKeywords(text, top) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Content scoring (SEO)
router.post('/score', (req, res) => {
  try {
    const { text } = req.body;
    if (!text) return res.status(400).json({ error: 'text field required' });
    res.json(scoreContent(text));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export { router as textAnalysisRouter };
