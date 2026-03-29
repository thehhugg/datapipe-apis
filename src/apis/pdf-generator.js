/**
 * PDF Generator API
 * 
 * Converts HTML/URL to PDF. One of the top-searched APIs on RapidAPI.
 * Uses Puppeteer for rendering.
 * 
 * Endpoints:
 * - POST /api/pdf/from-html  — HTML string → PDF
 * - POST /api/pdf/from-url   — URL → PDF
 * - POST /api/pdf/invoice     — JSON data → professional invoice PDF
 * - POST /api/pdf/receipt     — JSON data → receipt PDF
 */

import express from 'express';

export const pdfGeneratorRouter = express.Router();

// HTML → PDF
pdfGeneratorRouter.post('/from-html', async (req, res) => {
  try {
    const { html, options = {} } = req.body;
    
    if (!html) {
      return res.status(400).json({ error: 'html field is required' });
    }

    // Check if puppeteer is available
    let puppeteer;
    try {
      puppeteer = await import('puppeteer');
    } catch {
      // Fallback: return a simple text-based response indicating puppeteer needed
      return res.status(503).json({
        error: 'PDF generation requires Puppeteer. Install with: npm install puppeteer',
        note: 'In production, Puppeteer is installed automatically via Dockerfile'
      });
    }

    const browser = await puppeteer.default.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    
    const pdfBuffer = await page.pdf({
      format: options.format || 'A4',
      margin: options.margin || { top: '20mm', right: '15mm', bottom: '20mm', left: '15mm' },
      printBackground: options.printBackground !== false,
      landscape: options.landscape || false,
    });
    
    await browser.close();
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${options.filename || 'document'}.pdf"`);
    res.send(pdfBuffer);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// URL → PDF
pdfGeneratorRouter.post('/from-url', async (req, res) => {
  try {
    const { url, options = {} } = req.body;
    
    if (!url) {
      return res.status(400).json({ error: 'url field is required' });
    }

    let puppeteer;
    try {
      puppeteer = await import('puppeteer');
    } catch {
      return res.status(503).json({
        error: 'PDF generation requires Puppeteer',
        note: 'In production, Puppeteer is installed automatically via Dockerfile'
      });
    }

    const browser = await puppeteer.default.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });
    
    const pdfBuffer = await page.pdf({
      format: options.format || 'A4',
      margin: options.margin || { top: '20mm', right: '15mm', bottom: '20mm', left: '15mm' },
      printBackground: options.printBackground !== false,
      landscape: options.landscape || false,
    });
    
    await browser.close();
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${options.filename || 'webpage'}.pdf"`);
    res.send(pdfBuffer);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// JSON → Invoice PDF (template-based, no Puppeteer needed)
pdfGeneratorRouter.post('/invoice', async (req, res) => {
  try {
    const { invoice } = req.body;
    
    if (!invoice) {
      return res.status(400).json({ error: 'invoice object is required' });
    }

    const {
      number = 'INV-001',
      date = new Date().toISOString().split('T')[0],
      dueDate,
      from = {},
      to = {},
      items = [],
      notes,
      currency = 'USD',
      tax = 0,
    } = invoice;

    const subtotal = items.reduce((sum, item) => sum + (item.quantity || 1) * (item.price || 0), 0);
    const taxAmount = subtotal * (tax / 100);
    const total = subtotal + taxAmount;

    const currencySymbol = { USD: '$', EUR: '€', GBP: '£', CAD: 'C$', AUD: 'A$' }[currency] || currency + ' ';

    const html = `<!DOCTYPE html>
<html>
<head>
<style>
  body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #333; margin: 0; padding: 40px; }
  .header { display: flex; justify-content: space-between; margin-bottom: 40px; }
  .title { font-size: 32px; font-weight: 700; color: #1a1a1a; }
  .invoice-meta { text-align: right; }
  .invoice-meta p { margin: 4px 0; color: #666; }
  .parties { display: flex; justify-content: space-between; margin-bottom: 40px; }
  .party { width: 45%; }
  .party h3 { color: #888; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px; }
  .party p { margin: 2px 0; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
  th { background: #f8f9fa; padding: 12px 16px; text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: #666; border-bottom: 2px solid #e9ecef; }
  td { padding: 12px 16px; border-bottom: 1px solid #f0f0f0; }
  .amount { text-align: right; }
  .totals { width: 300px; margin-left: auto; }
  .totals tr td { border: none; padding: 6px 16px; }
  .totals .total { font-size: 18px; font-weight: 700; border-top: 2px solid #333; padding-top: 12px; }
  .notes { margin-top: 40px; padding: 16px; background: #f8f9fa; border-radius: 4px; font-size: 13px; color: #666; }
</style>
</head>
<body>
  <div class="header">
    <div class="title">INVOICE</div>
    <div class="invoice-meta">
      <p><strong>#${number}</strong></p>
      <p>Date: ${date}</p>
      ${dueDate ? `<p>Due: ${dueDate}</p>` : ''}
    </div>
  </div>
  <div class="parties">
    <div class="party">
      <h3>From</h3>
      <p><strong>${from.name || ''}</strong></p>
      <p>${from.address || ''}</p>
      <p>${from.email || ''}</p>
      <p>${from.phone || ''}</p>
    </div>
    <div class="party">
      <h3>Bill To</h3>
      <p><strong>${to.name || ''}</strong></p>
      <p>${to.address || ''}</p>
      <p>${to.email || ''}</p>
      <p>${to.phone || ''}</p>
    </div>
  </div>
  <table>
    <thead>
      <tr>
        <th>Description</th>
        <th>Qty</th>
        <th class="amount">Price</th>
        <th class="amount">Total</th>
      </tr>
    </thead>
    <tbody>
      ${items.map(item => `
      <tr>
        <td>${item.description || ''}</td>
        <td>${item.quantity || 1}</td>
        <td class="amount">${currencySymbol}${(item.price || 0).toFixed(2)}</td>
        <td class="amount">${currencySymbol}${((item.quantity || 1) * (item.price || 0)).toFixed(2)}</td>
      </tr>`).join('')}
    </tbody>
  </table>
  <table class="totals">
    <tr><td>Subtotal</td><td class="amount">${currencySymbol}${subtotal.toFixed(2)}</td></tr>
    ${tax ? `<tr><td>Tax (${tax}%)</td><td class="amount">${currencySymbol}${taxAmount.toFixed(2)}</td></tr>` : ''}
    <tr class="total"><td>Total</td><td class="amount">${currencySymbol}${total.toFixed(2)}</td></tr>
  </table>
  ${notes ? `<div class="notes"><strong>Notes:</strong> ${notes}</div>` : ''}
</body>
</html>`;

    // Try Puppeteer, fallback to returning HTML
    let puppeteer;
    try {
      puppeteer = await import('puppeteer');
    } catch {
      // Return the HTML template for client-side rendering
      return res.json({
        html,
        invoice: { number, date, dueDate, subtotal, tax: taxAmount, total, currency },
        note: 'PDF rendering available in production. HTML returned for preview.'
      });
    }

    const browser = await puppeteer.default.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    
    const pdfBuffer = await page.pdf({
      format: 'A4',
      margin: { top: '10mm', right: '10mm', bottom: '10mm', left: '10mm' },
      printBackground: true,
    });
    
    await browser.close();
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="invoice-${number}.pdf"`);
    res.send(pdfBuffer);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// JSON → Receipt PDF
pdfGeneratorRouter.post('/receipt', async (req, res) => {
  try {
    const { receipt } = req.body;
    
    if (!receipt) {
      return res.status(400).json({ error: 'receipt object is required' });
    }

    const {
      number = 'REC-001',
      date = new Date().toISOString().split('T')[0],
      business = {},
      items = [],
      payment = {},
      currency = 'USD',
      tax = 0,
    } = receipt;

    const subtotal = items.reduce((sum, item) => sum + (item.quantity || 1) * (item.price || 0), 0);
    const taxAmount = subtotal * (tax / 100);
    const total = subtotal + taxAmount;
    const currencySymbol = { USD: '$', EUR: '€', GBP: '£' }[currency] || currency + ' ';

    const html = `<!DOCTYPE html>
<html>
<head>
<style>
  body { font-family: 'Courier New', monospace; max-width: 320px; margin: 0 auto; padding: 20px; color: #333; }
  .center { text-align: center; }
  .business { margin-bottom: 16px; }
  .business h2 { margin: 0; font-size: 18px; }
  .divider { border-top: 1px dashed #999; margin: 12px 0; }
  .line { display: flex; justify-content: space-between; padding: 2px 0; font-size: 13px; }
  .total-line { font-weight: bold; font-size: 16px; }
  .footer { font-size: 11px; color: #888; margin-top: 16px; text-align: center; }
</style>
</head>
<body>
  <div class="business center">
    <h2>${business.name || 'Business'}</h2>
    <p style="margin:2px 0;font-size:12px">${business.address || ''}</p>
    <p style="margin:2px 0;font-size:12px">${business.phone || ''}</p>
  </div>
  <div class="divider"></div>
  <div class="center" style="font-size:12px">
    <p>Receipt #${number}</p>
    <p>${date}</p>
  </div>
  <div class="divider"></div>
  ${items.map(item => `
  <div class="line">
    <span>${item.description} x${item.quantity || 1}</span>
    <span>${currencySymbol}${((item.quantity || 1) * (item.price || 0)).toFixed(2)}</span>
  </div>`).join('')}
  <div class="divider"></div>
  <div class="line"><span>Subtotal</span><span>${currencySymbol}${subtotal.toFixed(2)}</span></div>
  ${tax ? `<div class="line"><span>Tax (${tax}%)</span><span>${currencySymbol}${taxAmount.toFixed(2)}</span></div>` : ''}
  <div class="line total-line"><span>TOTAL</span><span>${currencySymbol}${total.toFixed(2)}</span></div>
  <div class="divider"></div>
  <div class="line"><span>Payment</span><span>${payment.method || 'Cash'}</span></div>
  ${payment.last4 ? `<div class="line"><span>Card</span><span>****${payment.last4}</span></div>` : ''}
  <div class="divider"></div>
  <div class="footer">Thank you for your business!</div>
</body>
</html>`;

    let puppeteer;
    try {
      puppeteer = await import('puppeteer');
    } catch {
      return res.json({
        html,
        receipt: { number, date, subtotal, tax: taxAmount, total, currency },
        note: 'PDF rendering available in production. HTML returned for preview.'
      });
    }

    const browser = await puppeteer.default.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    
    const pdfBuffer = await page.pdf({
      width: '80mm',
      height: '200mm',
      margin: { top: '5mm', right: '5mm', bottom: '5mm', left: '5mm' },
      printBackground: true,
    });
    
    await browser.close();
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="receipt-${number}.pdf"`);
    res.send(pdfBuffer);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
