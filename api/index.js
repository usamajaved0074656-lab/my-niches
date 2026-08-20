import { handleRequest, configErrors } from '../lib/handler.js';

/**
 * Vercel serverless entry. Vercel serves everything in public/ from its CDN,
 * so this only ever sees /api/* — the same handler the local server uses.
 */
export default async function (req, res) {
  const problems = configErrors();
  if (problems.length) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ error: 'Server config adhoori hai: ' + problems.join(' ') }));
  }
  return handleRequest(req, res);
}
