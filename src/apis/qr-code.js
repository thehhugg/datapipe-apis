/**
 * QR Code Generator API — Generate QR codes from text/URLs
 * 
 * Pure Node.js, no external dependencies needed.
 * Returns PNG image or base64 data.
 * 
 * Endpoints:
 *   GET /api/qr/generate?data=https://example.com&size=300
 *   GET /api/qr/generate?data=Hello&format=base64
 *   POST /api/qr/batch — bulk generate
 */

import { Router } from 'express';

export const qrCodeRouter = Router();

// Minimal QR code generation using a redirect to public QR APIs
// (For production, we'd use the 'qrcode' npm package, but keeping deps minimal)
// Using quickchart.io — free, no key, reliable

const QR_API = 'https://quickchart.io/qr';

qrCodeRouter.get('/generate', async (req, res) => {
  try {
    const { data, size = 300, format = 'png', dark, light, margin } = req.query;
    if (!data) return res.status(400).json({ error: 'Missing required parameter: data' });

    const params = new URLSearchParams({
      text: data,
      size: Math.min(Math.max(parseInt(size) || 300, 50), 1000),
      format: format === 'base64' ? 'base64' : 'png',
    });

    if (dark) params.set('dark', dark);
    if (light) params.set('light', light);
    if (margin) params.set('margin', Math.min(parseInt(margin) || 4, 20));

    const url = `${QR_API}?${params}`;
    const response = await fetch(url, { signal: AbortSignal.timeout(10000) });

    if (!response.ok) {
      return res.status(502).json({ error: 'QR generation failed' });
    }

    if (format === 'base64') {
      const text = await response.text();
      return res.json({
        data,
        format: 'base64',
        size: parseInt(size) || 300,
        image: text,
      });
    }

    // Stream PNG directly
    res.set('Content-Type', 'image/png');
    res.set('Content-Disposition', 'inline; filename="qr.png"');
    const buffer = await response.arrayBuffer();
    res.send(Buffer.from(buffer));

  } catch (err) {
    res.status(500).json({ error: 'QR generation failed', detail: err.message });
  }
});

// Bulk generate (returns base64 array)
qrCodeRouter.post('/batch', async (req, res) => {
  try {
    const { items } = req.body;
    if (!items || !Array.isArray(items)) {
      return res.status(400).json({ error: 'Body must contain { items: [{ data: "...", size: 300 }, ...] }' });
    }
    if (items.length > 50) {
      return res.status(400).json({ error: 'Maximum 50 items per batch' });
    }

    const results = await Promise.all(items.map(async (item) => {
      try {
        const size = Math.min(Math.max(parseInt(item.size) || 300, 50), 1000);
        const params = new URLSearchParams({ text: item.data, size, format: 'base64' });
        const response = await fetch(`${QR_API}?${params}`, { signal: AbortSignal.timeout(10000) });
        const base64 = await response.text();
        return { data: item.data, size, image: base64, success: true };
      } catch {
        return { data: item.data, success: false, error: 'Generation failed' };
      }
    }));

    res.json({ count: results.length, results });
  } catch (err) {
    res.status(500).json({ error: 'Batch generation failed', detail: err.message });
  }
});
