import http from 'node:http';
import { handleRequest, configErrors, store, PORT } from './app.js';
import { passwordSet } from './auth.js';

/**
 * Local / container launcher. The request handling itself lives in app.js so
 * the exact same code also runs as a Vercel serverless function (api/index.js).
 */

const problems = configErrors();
if (problems.length) {
  for (const p of problems) console.error(`\n  ${p}\n`);
  process.exit(1);
}

const server = http.createServer(handleRequest);

// Backstop: nothing thrown inside a handler should ever take the server down.
process.on('unhandledRejection', (e) => console.error('unhandled rejection:', e));
process.on('uncaughtException', (e) => console.error('uncaught exception:', e));
server.on('clientError', (_e, socket) => {
  if (socket.writable) socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
});

// 0.0.0.0 so it also answers on the LAN IP and inside a hosting container.
server.listen(PORT, '0.0.0.0', () => {
  console.log(`My Niches  →  http://localhost:${PORT}`);
  console.log(`Storage     →  ${store.kind}  (${store.label})`);
  console.log(`Password    →  ${passwordSet() ? 'on' : 'OFF (koi bhi khol sakta hai)'}`);
});
