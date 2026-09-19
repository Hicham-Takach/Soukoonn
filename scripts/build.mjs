// Builds the publishable site into _site/ from the product files the admin edits.
//
//   content/products/*.json  ->  _site/products.json   (what the storefront loads)
//   index.html, admin/, images/  ->  copied as-is
//
// Runs on GitHub Actions after every save in the admin; run it locally with
//   node scripts/build.mjs
// No dependencies, so there is nothing to install or keep updated.
//
// A single bad product never blocks publishing: it is skipped with a warning
// (shown as an annotation on the Actions run) and the rest of the shop goes out.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, '_site');
const CONTENT = path.join(ROOT, 'content', 'products');

// Must match the <section id="..."> blocks in index.html and the admin's select options.
const CATEGORIES = ['mabakhir', 'bakhoor', 'accessories', 'antiques', 'soap', 'candles'];

const warnings = [];
const warn = (file, msg) => warnings.push({ file, msg });

const text = (v) => (typeof v === 'string' ? v.trim() : '');

function toPrice(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : Number(String(v).trim().replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? n : null;           // 0 or junk -> "Price TBD"
}

function toOrder(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

// The admin stores "/images/products/x.webp". Relative paths keep working whether
// the site is served from the domain root or from <user>.github.io/<repo>/.
function toImagePath(v) {
  const raw = v && typeof v === 'object' ? v.image ?? v.src ?? '' : v;
  return text(raw).replace(/^\/+/, '');
}

// ---------------------------------------------------------------- read products
const files = fs.readdirSync(CONTENT).filter((f) => f.endsWith('.json')).sort();
const products = [];
let hidden = 0;

for (const f of files) {
  const rel = `content/products/${f}`;
  let d;
  try {
    d = JSON.parse(fs.readFileSync(path.join(CONTENT, f), 'utf8'));
  } catch (e) {
    warn(rel, `could not be read (${e.message}); skipped`);
    continue;
  }
  if (d.hidden === true) { hidden++; continue; }

  const nameAr = text(d.name_ar);
  const nameEn = text(d.name_en);
  if (!nameAr && !nameEn) { warn(rel, 'has no name; skipped'); continue; }
  if (!CATEGORIES.includes(d.category)) {
    warn(rel, `unknown category "${d.category}"; skipped`);
    continue;
  }

  const images = (Array.isArray(d.images) ? d.images : [])
    .map(toImagePath)
    .filter(Boolean)
    .filter((p) => {
      if (fs.existsSync(path.join(ROOT, p))) return true;
      warn(rel, `image not found: ${p}; dropped`);
      return false;
    });
  if (!images.length) { warn(rel, 'has no usable image; skipped'); continue; }

  products.push({
    id: path.basename(f, '.json'),
    cat: d.category,
    price: toPrice(d.price),
    images,
    en: nameEn || nameAr,
    ar: nameAr || nameEn,
    en_desc: text(d.desc_en),
    ar_desc: text(d.desc_ar),
    size_en: text(d.size_en),
    size_ar: text(d.size_ar),
    isSet: d.is_set === true,
    _order: toOrder(d.order),
  });
}

if (!products.length) {
  console.error('::error::No publishable products found. Refusing to publish an empty shop.');
  process.exit(1);
}

// Within a category: products without an order number (newly added ones) come
// first, newest file first; the rest follow their order number.
products.sort((a, b) => {
  const c = CATEGORIES.indexOf(a.cat) - CATEGORIES.indexOf(b.cat);
  if (c) return c;
  if (a._order === null && b._order === null) return b.id.localeCompare(a.id);
  if (a._order === null) return -1;
  if (b._order === null) return 1;
  return a._order - b._order || a.id.localeCompare(b.id);
});
for (const p of products) delete p._order;

// ---------------------------------------------------------------- write _site/
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

// Stamps the products.json URL so a fresh publish is never served from an old cache.
const build = (process.env.GITHUB_SHA || Date.now().toString(36)).slice(0, 12);
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8').replaceAll('__BUILD__', build);
fs.writeFileSync(path.join(OUT, 'index.html'), html);
fs.writeFileSync(path.join(OUT, 'products.json'), JSON.stringify(products));
for (const dir of ['admin', 'images']) {
  fs.cpSync(path.join(ROOT, dir), path.join(OUT, dir), { recursive: true });
}

// ---------------------------------------------------------------------- report
const perCat = Object.fromEntries(CATEGORIES.map((c) => [c, products.filter((p) => p.cat === c).length]));
console.log(`Published ${products.length} products (${hidden} hidden), build ${build}`);
console.log(Object.entries(perCat).map(([c, n]) => `  ${c}: ${n}`).join('\n'));
for (const { file, msg } of warnings) {
  // GitHub turns this line format into a visible annotation on the run
  console.log(`::warning file=${file}::${msg}`);
}
