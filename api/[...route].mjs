// Vercel serverless adapter: same route handler as the local server.
import { route } from '../server/handler.mjs';

export default async function handler(req, res) {
  const path = new URL(req.url, 'http://localhost').pathname;
  const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket?.remoteAddress || 'unknown';
  const result = await route({ method: req.method, path, body: req.body, ip });
  res.setHeader('Cache-Control', 'no-store');
  res.status(result.status).json(result.body);
}
