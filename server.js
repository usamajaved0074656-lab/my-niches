import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { handleRequest, configErrors, store, PORT, sweepRemoved } from './lib/handler.js';
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

const SWEEP_HOURS = Number(process.env.SWEEP_HOURS ?? 24);

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.join(ROOT, 'data');
const SWEEP_FILE = path.join(DATA, 'sweep.json');

async function readLastRun() {
  try {
    const raw = await fs.readFile(SWEEP_FILE, 'utf8');
    const data = JSON.parse(raw);
    return typeof data?.lastRun === 'number' ? data.lastRun : 0;
  } catch {
    return 0;
  }
}

async function saveLastRun(ms) {
  try {
    await fs.mkdir(DATA, { recursive: true });
    await fs.writeFile(SWEEP_FILE, JSON.stringify({ lastRun: ms }, null, 2));
  } catch (err) {
    console.error('Failed to save sweep timestamp:', err);
  }
}

let running = false;

// Checks every saved channel and moves YouTube-terminated ones into Removed.
async function checkSweep() {
  if (running || SWEEP_HOURS <= 0) return;
  try {
    const lastRun = await readLastRun();
    const now = Date.now();
    if (now - lastRun >= SWEEP_HOURS * 60 * 60 * 1000) {
      running = true;
      try {
        await sweepRemoved();
        await saveLastRun(Date.now());
      } finally {
        running = false;
      }
    }
  } catch (err) {
    console.error('Sweep check error:', err);
  }
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
  console.log(`Password    →  ${passwordSet() ? 'on' : 'OFF (anyone can open it)'}`);
  console.log(`Removed-check → ${SWEEP_HOURS > 0 ? `every ${SWEEP_HOURS}h (set SWEEP_HOURS=0 to turn off)` : 'off'}`);

  if (SWEEP_HOURS > 0) {
    setTimeout(() => {
      try {
        checkSweep().catch((e) => console.error('Sweep timer error:', e));
        setInterval(() => {
          try {
            checkSweep().catch((e) => console.error('Sweep interval error:', e));
          } catch (e) {
            console.error('Sweep interval error:', e);
          }
        }, 60 * 60 * 1000);
      } catch (e) {
        console.error('Sweep timer error:', e);
      }
    }, 5 * 60 * 1000);
  }
});
