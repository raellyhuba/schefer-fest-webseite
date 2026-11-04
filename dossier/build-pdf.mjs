// Erzeugt public/sponsorendossier-schefer-faescht-2027.pdf aus dossier/sponsorendossier.html
// Aufruf: node dossier/build-pdf.mjs   (benötigt Playwright/Chromium)
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
let pw;
try { pw = require('playwright'); } catch { pw = require(process.env.PLAYWRIGHT_PATH || '/opt/npm-tools/node_modules/playwright'); }
const { chromium } = pw;
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const logo = (f) => `data:image/png;base64,${readFileSync(path.join(root, 'public/logos', f)).toString('base64')}`;

const header = `
  <div style="width:100%; padding:0 18mm; display:flex; justify-content:space-between; align-items:center; font-family:Inter,sans-serif;">
    <img src="${logo('schefer-gartenbau.png')}" style="height:13mm">
    <span style="font-size:8pt; color:#4C6B55;">Schefer-Fäscht 2027 · 20.–23. Mai · Uttwil</span>
    <img src="${logo('amber39.png')}" style="height:13mm">
  </div>`;
const footer = `
  <div style="width:100%; padding:0 18mm; display:flex; justify-content:space-between; font-family:Inter,sans-serif; font-size:7.5pt; color:#4C6B55;">
    <span>www.schefer-fest.ch</span><span>Seite <span class="pageNumber"></span> / <span class="totalPages"></span></span>
  </div>`;

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto('file://' + path.join(root, 'dossier/sponsorendossier.html'), { waitUntil: 'networkidle' });
await page.pdf({
  path: path.join(root, 'public/sponsorendossier-schefer-faescht-2027.pdf'),
  format: 'A4',
  printBackground: true,
  displayHeaderFooter: true,
  headerTemplate: header,
  footerTemplate: footer,
  margin: { top: '34mm', bottom: '18mm', left: '18mm', right: '18mm' },
});
await browser.close();
console.log('PDF erstellt');
