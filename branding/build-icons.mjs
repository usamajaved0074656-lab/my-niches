import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

// Resolve paths from the script's own location so it executes reliably from any cwd.
const __filename = fileURLToPath(import.meta.url);
const scriptDir = path.dirname(__filename);
const repoRoot = path.resolve(scriptDir, '..');

// Browser binary search order: EDGE_PATH env override first, then standard Edge installs, then Chrome fallback.
function findBrowser() {
  const candidates = [
    process.env.EDGE_PATH,
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  throw new Error('No supported browser found. Checked EDGE_PATH, Edge (x86/x64), and Chrome.');
}

// Builds an ICO file embedding multiple PNG images using standard ICONDIR and ICONDIRENTRY headers.
function createIco(images) {
  const count = images.length;
  // ICONDIR header: 6 bytes (reserved uint16 0, type uint16 1 for icon, count uint16).
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(count, 4);

  // Each ICONDIRENTRY is 16 bytes. Image data follows immediately after all directory entries.
  let offset = 6 + 16 * count;
  const entries = [];
  for (const img of images) {
    const entry = Buffer.alloc(16);
    // Width and height: 0 represents 256px.
    entry.writeUInt8(img.width === 256 ? 0 : img.width, 0);
    entry.writeUInt8(img.height === 256 ? 0 : img.height, 1);
    entry.writeUInt8(0, 2); // Color palette count (0 for 24/32-bit PNG)
    entry.writeUInt8(0, 3); // Reserved
    entry.writeUInt16LE(1, 4); // Color planes
    entry.writeUInt16LE(32, 6); // Bits per pixel
    entry.writeUInt32LE(img.buffer.length, 8); // Size of image data in bytes
    entry.writeUInt32LE(offset, 12); // File offset to image data
    entries.push(entry);
    offset += img.buffer.length;
  }

  return Buffer.concat([header, ...entries, ...images.map((img) => img.buffer)]);
}

// Rasterizes an SVG into a PNG of exact size S x S using a headless browser instance.
// Edge hangs writing into the extension folder, so it always writes to temp and Node copies the file.
function renderPng(browserPath, tempRoot, svgPath, outPath, size) {
  // Delete any existing file at the real outPath before starting so stale files never linger.
  fs.rmSync(outPath, { force: true });

  // Render via a minimal HTML wrapper with zero margins and transparent background.
  const tempHtmlPath = path.join(tempRoot, `render-${Date.now()}-${size}-${Math.random().toString(36).slice(2)}.html`);
  const svgUrl = pathToFileURL(svgPath).href;
  const htmlContent = `<!doctype html><html><head><style>html,body{margin:0;background:transparent;overflow:hidden}img{display:block}</style></head><body><img src="${svgUrl}" width="${size}" height="${size}"></body></html>`;
  fs.writeFileSync(tempHtmlPath, htmlContent, 'utf8');

  const htmlFileUrl = pathToFileURL(tempHtmlPath).href;

  let lastError;
  // Retry once if launch errors, times out, or produces an invalid PNG.
  for (let attempt = 0; attempt < 2; attempt++) {
    // Delete any existing file at outPath so a stale file from an earlier run can never pass checks.
    fs.rmSync(outPath, { force: true });

    // Each render gets a fresh profile folder to avoid waiting on a shutting-down browser process.
    const profileDir = fs.mkdtempSync(path.join(tempRoot, 'p-'));

    // Always take screenshot inside temp root; Edge hangs writing into destination folders directly.
    const shotPath = path.join(tempRoot, `shot-${size}-${Math.random().toString(36).slice(2)}.png`);

    // Launch headless browser with lean flags to avoid unnecessary background work.
    const res = spawnSync(
      browserPath,
      [
        '--headless=new',
        '--disable-gpu',
        '--hide-scrollbars',
        '--no-first-run',
        '--no-default-browser-check',
        '--disable-extensions',
        '--disable-background-networking',
        '--disable-component-update',
        '--mute-audio',
        `--user-data-dir=${profileDir}`,
        '--force-device-scale-factor=1',
        '--default-background-color=00000000',
        `--window-size=${size},${size}`,
        `--screenshot=${shotPath}`,
        htmlFileUrl,
      ],
      { timeout: 30000 }
    );

    if (res.error) {
      // When a launch times out, kill the whole Edge process tree so nothing is left running.
      if (res.error.code === 'ETIMEDOUT' && res.pid) {
        spawnSync('taskkill', ['/PID', String(res.pid), '/T', '/F']);
      }
      lastError = new Error(`Failed to launch browser: ${res.error.message}`);
      continue;
    }

    // Verify PNG exists and validate IHDR dimensions (bytes 16-23, big-endian) to confirm rasterization size.
    // Headless Edge can exit non-zero after writing a good screenshot, so judge success by the PNG.
    if (!fs.existsSync(shotPath)) {
      lastError = new Error(`Screenshot not found at ${shotPath} (exit status ${res.status}: ${res.stderr?.toString().trim() || 'unknown error'})`);
      continue;
    }
    const pngBuffer = fs.readFileSync(shotPath);
    if (pngBuffer.length < 24) {
      lastError = new Error(`Invalid PNG file size (${pngBuffer.length} bytes) at ${shotPath} (exit status ${res.status})`);
      continue;
    }
    const width = pngBuffer.readUInt32BE(16);
    const height = pngBuffer.readUInt32BE(20);
    if (width !== size || height !== size) {
      lastError = new Error(`IHDR dimension mismatch for ${shotPath}: expected ${size}x${size}, got ${width}x${height} (exit status ${res.status})`);
      continue;
    }

    // Copy verified screenshot to destination folder and return its bytes.
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.copyFileSync(shotPath, outPath);

    return pngBuffer;
  }

  throw lastError;
}

function printWritten(filePath) {
  const bytes = fs.statSync(filePath).size;
  const rel = path.relative(repoRoot, filePath).replace(/\\/g, '/');
  console.log(`${rel} (${bytes} bytes)`);
}

function main() {
  const browserPath = findBrowser();
  const logoIconSvg = path.join(scriptDir, 'logo-icon.svg');
  const logoSquareSvg = path.join(scriptDir, 'logo-square.svg');

  // Verify source SVGs exist before starting renders.
  if (!fs.existsSync(logoIconSvg)) {
    throw new Error(`Source SVG not found: ${logoIconSvg}`);
  }
  if (!fs.existsSync(logoSquareSvg)) {
    throw new Error(`Source SVG not found: ${logoSquareSvg}`);
  }

  // Create shared temp root directory for render HTML and isolated per-render profiles.
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'mn-icons-'));

  try {
    const outputs = [
      { svg: logoIconSvg, file: path.join(repoRoot, 'public', 'favicon-16.png'), size: 16 },
      { svg: logoIconSvg, file: path.join(repoRoot, 'public', 'favicon-32.png'), size: 32 },
      { svg: logoIconSvg, file: path.join(repoRoot, 'public', 'icon-192.png'), size: 192 },
      { svg: logoIconSvg, file: path.join(repoRoot, 'public', 'icon-512.png'), size: 512 },
      { svg: logoIconSvg, file: path.join(repoRoot, 'extension', 'icons', 'icon16.png'), size: 16 },
      { svg: logoIconSvg, file: path.join(repoRoot, 'extension', 'icons', 'icon48.png'), size: 48 },
      { svg: logoIconSvg, file: path.join(repoRoot, 'extension', 'icons', 'icon128.png'), size: 128 },
      { svg: logoSquareSvg, file: path.join(repoRoot, 'public', 'apple-touch-icon.png'), size: 180 },
      { svg: logoSquareSvg, file: path.join(repoRoot, 'public', 'icon-maskable-512.png'), size: 512 },
    ];

    // Render one icon per launch sequentially to avoid profile conflicts.
    for (const item of outputs) {
      renderPng(browserPath, tempRoot, item.svg, item.file, item.size);
      printWritten(item.file);
    }

    // Render a 48x48 icon to a temporary path solely for embedding into favicon.ico (not saved as public file).
    const temp48Path = path.join(tempRoot, 'favicon-48.png');
    const ico48Buffer = renderPng(browserPath, tempRoot, logoIconSvg, temp48Path, 48);

    // Read the already rasterized 16 and 32 PNGs to combine into public/favicon.ico.
    const ico16Buffer = fs.readFileSync(path.join(repoRoot, 'public', 'favicon-16.png'));
    const ico32Buffer = fs.readFileSync(path.join(repoRoot, 'public', 'favicon-32.png'));

    const faviconIcoPath = path.join(repoRoot, 'public', 'favicon.ico');
    const icoBuffer = createIco([
      { width: 16, height: 16, buffer: ico16Buffer },
      { width: 32, height: 32, buffer: ico32Buffer },
      { width: 48, height: 48, buffer: ico48Buffer },
    ]);
    fs.writeFileSync(faviconIcoPath, icoBuffer);
    printWritten(faviconIcoPath);

    console.log('done');
  } finally {
    // Remove temporary user data directory when finished.
    try {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    } catch {
      // Windows process exit may briefly keep handles open.
    }
  }
}

main();
