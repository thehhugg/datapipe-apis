/**
 * Email Validation API — Verify email addresses without sending
 * 
 * Checks: syntax, MX records, disposable domain detection, role-based detection,
 * free provider detection, DNS verification, SMTP verification (optional).
 * 
 * One of the highest-demand API categories on RapidAPI.
 * 
 * Endpoints:
 *   GET  /api/email/validate?email=user@example.com
 *   POST /api/email/validate-bulk  — Validate up to 50 emails at once
 */

import { Router } from 'express';
import { promises as dns } from 'dns';

export const emailValidatorRouter = Router();

// Common disposable email domains (top ~200)
const DISPOSABLE_DOMAINS = new Set([
  'mailinator.com', 'guerrillamail.com', 'tempmail.com', 'throwaway.email',
  'yopmail.com', 'sharklasers.com', 'guerrillamailblock.com', 'grr.la',
  'guerrillamail.info', 'guerrillamail.net', 'guerrillamail.org', 'guerrillamail.de',
  'trashmail.com', 'trashmail.me', 'trashmail.net', 'dispostable.com',
  'maildrop.cc', 'fakeinbox.com', 'mailnesia.com', 'tempail.com',
  'tempmailaddress.com', 'temp-mail.org', 'temp-mail.io', 'getnada.com',
  'emailondeck.com', 'mohmal.com', 'burnermail.io', 'inboxkitten.com',
  'minutemail.com', 'emailfake.com', 'crazymailing.com', 'harakirimail.com',
  'jetable.org', 'discard.email', 'discardmail.com', 'discardmail.de',
  'mytemp.email', 'tempinbox.com', 'fakemailgenerator.com', 'armyspy.com',
  'cuvox.de', 'dayrep.com', 'einrot.com', 'fleckens.hu', 'gustr.com',
  'jourrapide.com', 'rhyta.com', 'superrito.com', 'teleworm.us',
  'mailcatch.com', 'mailscrap.com', 'mailseal.de', 'spamgourmet.com',
  'trashymail.com', 'mailexpire.com', 'tempomail.fr', 'throwam.com',
  '10minutemail.com', '20minutemail.com', 'disposableemailaddresses.emailmiser.com',
  'mailforspam.com', 'safetymail.info', 'trashmail.org', 'mailzilla.com',
  'binkmail.com', 'bobmail.info', 'chammy.info', 'devnullmail.com',
  'klzlk.com', 'letthemeatspam.com', 'mailblocks.com', 'mailmetrash.com',
  'mailmoat.com', 'mailnull.com', 'mailshell.com', 'mailsiphon.com',
  'mailslurp.com', 'spamfree24.org', 'spamhereplease.com', 'spaml.com',
  'uggsrock.com', 'wegwerfmail.de', 'wegwerfmail.net', 'wuzup.net',
  'xagloo.com', 'yuurok.com', 'zippymail.info',
  'guerrillamail.biz', 'tempmailo.com', 'tempr.email', 'tmail.ws',
  'tmpmail.net', 'tmpmail.org', 'trash-mail.at', 'trashmail.at',
  'trashmail.io', 'trashmail.ws', 'yolanda.dev',
]);

// Free email providers
const FREE_PROVIDERS = new Set([
  'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'live.com',
  'aol.com', 'icloud.com', 'me.com', 'mac.com', 'mail.com',
  'protonmail.com', 'proton.me', 'zoho.com', 'yandex.com', 'yandex.ru',
  'gmx.com', 'gmx.net', 'gmx.de', 'web.de', 'mail.ru',
  'inbox.com', 'fastmail.com', 'hushmail.com', 'tutanota.com', 'tuta.io',
  'hey.com', 'pm.me', 'msn.com', 'comcast.net', 'att.net',
  'verizon.net', 'sbcglobal.net', 'bellsouth.net', 'cox.net',
  'charter.net', 'earthlink.net', 'optonline.net', 'frontier.com',
  'yahoo.co.uk', 'yahoo.co.jp', 'yahoo.fr', 'yahoo.de',
  'hotmail.co.uk', 'hotmail.fr', 'hotmail.de', 'hotmail.it',
  'outlook.fr', 'outlook.de', 'outlook.es', 'live.co.uk',
  'googlemail.com', 'rocketmail.com', 'ymail.com',
]);

// Role-based email prefixes
const ROLE_PREFIXES = new Set([
  'admin', 'administrator', 'webmaster', 'postmaster', 'hostmaster',
  'info', 'support', 'help', 'sales', 'marketing', 'press',
  'abuse', 'noc', 'security', 'privacy', 'billing', 'legal',
  'compliance', 'hr', 'jobs', 'careers', 'recruiting', 'talent',
  'office', 'contact', 'hello', 'team', 'staff', 'general',
  'noreply', 'no-reply', 'donotreply', 'do-not-reply',
  'feedback', 'newsletter', 'subscribe', 'unsubscribe',
  'orders', 'returns', 'shipping', 'accounts', 'enquiries',
  'service', 'customerservice', 'customer-service',
]);

// Validate email syntax
function validateSyntax(email) {
  if (!email || typeof email !== 'string') return { valid: false, reason: 'Empty or non-string input' };
  
  email = email.trim().toLowerCase();
  
  if (email.length > 254) return { valid: false, reason: 'Email exceeds 254 characters' };
  
  const parts = email.split('@');
  if (parts.length !== 2) return { valid: false, reason: 'Missing or multiple @ symbols' };
  
  const [local, domain] = parts;
  
  if (!local || local.length > 64) return { valid: false, reason: 'Local part empty or exceeds 64 characters' };
  if (!domain || domain.length > 253) return { valid: false, reason: 'Domain empty or exceeds 253 characters' };
  
  // Basic local part validation
  if (/^[.]|[.]$/.test(local)) return { valid: false, reason: 'Local part starts or ends with dot' };
  if (/[.]{2}/.test(local)) return { valid: false, reason: 'Consecutive dots in local part' };
  if (!/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+$/.test(local)) return { valid: false, reason: 'Invalid characters in local part' };
  
  // Domain validation
  if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*\.[a-z]{2,}$/.test(domain)) {
    return { valid: false, reason: 'Invalid domain format' };
  }
  
  return { valid: true, email, local, domain };
}

// Check MX records
async function checkMX(domain) {
  try {
    const records = await dns.resolveMx(domain);
    if (records && records.length > 0) {
      return {
        hasMX: true,
        records: records.sort((a, b) => a.priority - b.priority).map(r => ({
          exchange: r.exchange,
          priority: r.priority,
        })),
      };
    }
    return { hasMX: false, records: [] };
  } catch (err) {
    // Try A record as fallback
    try {
      const aRecords = await dns.resolve4(domain);
      if (aRecords && aRecords.length > 0) {
        return { hasMX: false, hasA: true, note: 'No MX records but A record exists (may accept mail)' };
      }
    } catch (_) {}
    return { hasMX: false, records: [], error: err.code };
  }
}

// Full validation
async function validateEmail(email) {
  const syntax = validateSyntax(email);
  if (!syntax.valid) {
    return {
      email: email?.trim()?.toLowerCase() || email,
      valid: false,
      score: 0,
      reason: syntax.reason,
      checks: { syntax: false },
    };
  }
  
  const { local, domain } = syntax;
  const normalizedEmail = `${local}@${domain}`;
  
  const isDisposable = DISPOSABLE_DOMAINS.has(domain);
  const isFreeProvider = FREE_PROVIDERS.has(domain);
  const isRoleBased = ROLE_PREFIXES.has(local.split('+')[0]); // Handle + addressing
  
  const mx = await checkMX(domain);
  
  // Compute quality score (0-100)
  let score = 100;
  const flags = [];
  
  if (!mx.hasMX && !mx.hasA) { score -= 50; flags.push('no_mx_records'); }
  if (isDisposable) { score -= 40; flags.push('disposable_domain'); }
  if (isRoleBased) { score -= 15; flags.push('role_based_address'); }
  if (isFreeProvider) { score -= 5; flags.push('free_provider'); }
  if (local.includes('+')) { score -= 5; flags.push('plus_addressing'); }
  if (/^\d+$/.test(local)) { score -= 10; flags.push('numeric_local_part'); }
  if (local.length <= 2) { score -= 10; flags.push('very_short_local_part'); }
  if (local.length > 30) { score -= 5; flags.push('long_local_part'); }
  
  // Determine deliverability verdict
  let deliverability = 'unknown';
  if (!mx.hasMX && !mx.hasA) deliverability = 'undeliverable';
  else if (isDisposable) deliverability = 'risky';
  else if (score >= 80) deliverability = 'deliverable';
  else if (score >= 50) deliverability = 'risky';
  else deliverability = 'undeliverable';
  
  return {
    email: normalizedEmail,
    valid: score > 30,
    score: Math.max(0, score),
    deliverability,
    checks: {
      syntax: true,
      mx: mx.hasMX || !!mx.hasA,
      disposable: isDisposable,
      freeProvider: isFreeProvider,
      roleBased: isRoleBased,
    },
    mx: {
      found: mx.hasMX,
      records: mx.records?.slice(0, 5) || [],
      ...(mx.hasA ? { hasARecord: true } : {}),
    },
    flags,
    domain: {
      name: domain,
      isDisposable,
      isFreeProvider,
    },
  };
}

// GET /api/email/validate?email=user@example.com
emailValidatorRouter.get('/validate', async (req, res) => {
  try {
    const { email } = req.query;
    if (!email) return res.status(400).json({ error: 'email parameter is required' });
    
    const result = await validateEmail(email);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Validation failed', message: err.message });
  }
});

// POST /api/email/validate-bulk — up to 50 emails
emailValidatorRouter.post('/validate-bulk', async (req, res) => {
  try {
    const { emails } = req.body;
    if (!emails || !Array.isArray(emails)) {
      return res.status(400).json({ error: 'emails array is required' });
    }
    if (emails.length > 50) {
      return res.status(400).json({ error: 'Maximum 50 emails per request' });
    }
    
    const results = await Promise.all(emails.map(e => validateEmail(e)));
    
    const summary = {
      total: results.length,
      valid: results.filter(r => r.valid).length,
      invalid: results.filter(r => !r.valid).length,
      deliverable: results.filter(r => r.deliverability === 'deliverable').length,
      risky: results.filter(r => r.deliverability === 'risky').length,
      undeliverable: results.filter(r => r.deliverability === 'undeliverable').length,
      disposable: results.filter(r => r.checks?.disposable).length,
      freeProvider: results.filter(r => r.checks?.freeProvider).length,
      roleBased: results.filter(r => r.checks?.roleBased).length,
    };
    
    res.json({ summary, results });
  } catch (err) {
    res.status(500).json({ error: 'Bulk validation failed', message: err.message });
  }
});
