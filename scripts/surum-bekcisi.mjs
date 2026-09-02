#!/usr/bin/env node
/**
 * SÜRÜM / DRIFT BEKÇİSİ — tüketiciler bu paketin SON etiketinde mi?
 *
 * Neden: 02.09.2026'da ölçüldü — web-panel `#main` ile 7 hafta eski v1.0.0
 * çalıştırıyordu (transliterasyonsuz normalizeMobil → farklı `m:` anahtarı),
 * asistan-panel pakete hiç bağlı değildi, üç Next.js projesi üç farklı sürümdeydi.
 * Hiçbir araç bunu göstermiyordu. Bu script günde bir koşar (launchd 07:30) ve
 * sapma varsa exit 1 verir.
 *
 * Kontroller (her tüketici için):
 *   (a) package.json `@rino/shared` spec'i         → yok ise "BAĞLI DEĞİL"
 *   (b) node_modules/@rino/shared/package.json      → yok ise "KURULU DEĞİL"
 *   (c) rino-shared'in son yerel etiketi (git describe) — spec ve kurulu sürüm buna eşit olmalı
 *   (d) node_modules/next sürümü (varsa) — Next projeleri arasında fark = sapma
 *
 * Ağa ÇIKMAZ. `--remote` verilirse ek olarak `git ls-remote --tags origin` ile
 * uzak etiket de okunur (yerel etiket geriyse söyler).
 *
 * Kullanım:
 *   node scripts/surum-bekcisi.mjs            # tablo, sapma varsa exit 1
 *   node scripts/surum-bekcisi.mjs --json
 *   node scripts/surum-bekcisi.mjs --last ~/Library/Logs/rino/surum-bekcisi.last
 *        → sonucu o dosyaya da yazar (launchd bunu kullanır; sapma yoksa tek satır OK)
 *   node scripts/surum-bekcisi.mjs --remote   # uzak etiketi de karşılaştır
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..');
const PROJECTS_ROOT = resolve(REPO, '..');

/** Tüketiciler — bump-consumers.sh / install-hooks.sh listeleriyle uyumlu tutul. */
const CONSUMERS = ['calendar-api', 'clinic-sync', 'takvim', 'asistan-panel', 'mobil-panel', 'web-panel'];

const argv = process.argv.slice(2);
const json = argv.includes('--json');
const remote = argv.includes('--remote');
const lastIdx = argv.indexOf('--last');
const lastFile = lastIdx !== -1 ? argv[lastIdx + 1] : null;
if (lastIdx !== -1 && !lastFile) { console.error('--last bir dosya yolu ister'); process.exit(2); }

const readJson = (p) => { try { return JSON.parse(readFileSync(p, 'utf8')); } catch { return null; } };
const git = (args, cwd = REPO) => {
  try { return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); }
  catch { return null; }
};
const semver = (v) => (v || '').replace(/^v/, '').split('.').map((n) => parseInt(n, 10) || 0);
const cmp = (a, b) => { const x = semver(a), y = semver(b); for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] - y[i]; return 0; };

// (c) son etiket
const localTag = git(['describe', '--tags', '--abbrev=0']);
let remoteTag = null;
if (remote) {
  const out = git(['ls-remote', '--tags', '--refs', 'origin']);
  if (out) {
    remoteTag = out.split('\n').map((l) => l.split('refs/tags/')[1]).filter((t) => /^v\d+\.\d+\.\d+$/.test(t)).sort(cmp).pop() ?? null;
  }
}
const targetTag = localTag; // sapma kararı yerel etikete göre (ağsız)
const targetVer = targetTag ? targetTag.replace(/^v/, '') : null;

const sapmalar = [];
const rows = [];
if (!targetTag) sapmalar.push(`rino-shared: etiket bulunamadı (git describe --tags başarısız)`);
if (remote && remoteTag && localTag && cmp(remoteTag, localTag) > 0) sapmalar.push(`rino-shared: uzak etiket ${remoteTag} > yerel ${localTag} — git fetch --tags`);

for (const name of CONSUMERS) {
  const dir = join(PROJECTS_ROOT, name);
  const pkg = readJson(join(dir, 'package.json'));
  const row = { proje: name, spec: null, kurulu: null, next: null, durum: [] };
  if (!pkg) { row.spec = 'PROJE YOK'; row.durum.push('proje klasörü/package.json yok'); rows.push(row); continue; }

  const spec = pkg.dependencies?.['@rino/shared'] ?? pkg.devDependencies?.['@rino/shared'] ?? null;
  row.spec = spec ?? 'BAĞLI DEĞİL';
  const installed = readJson(join(dir, 'node_modules', '@rino', 'shared', 'package.json'))?.version ?? null;
  row.kurulu = installed ?? 'KURULU DEĞİL';
  row.next = readJson(join(dir, 'node_modules', 'next', 'package.json'))?.version ?? null;

  if (!spec) row.durum.push(`@rino/shared bağımlılığı yok`);
  else if (targetTag && !spec.endsWith(`#${targetTag}`)) row.durum.push(`spec ${spec.split('#')[1] ?? spec} ≠ son etiket ${targetTag}`);
  if (spec && !installed) row.durum.push(`node_modules'ta kurulu değil (npm install)`);
  else if (installed && targetVer && installed !== targetVer) row.durum.push(`kurulu ${installed} ≠ son etiket ${targetVer}`);

  for (const d of row.durum) sapmalar.push(`${name}: ${d}`);
  rows.push(row);
}

// (d) Next.js hizası
const nextRows = rows.filter((r) => r.next);
const nextVersions = [...new Set(nextRows.map((r) => r.next))].sort(cmp);
if (nextVersions.length > 1) {
  const en = nextVersions[nextVersions.length - 1];
  sapmalar.push(`next: ${nextVersions.length} farklı sürüm (${nextRows.map((r) => `${r.proje} ${r.next}`).join(', ')}) — en yenisi ${en}`);
}

// ── Çıktı ─────────────────────────────────────────────────────────────────────
const now = new Date().toLocaleString('sv-SE', { hour12: false }).slice(0, 19); // yerel saat, YYYY-MM-DD HH:MM:SS
const lines = [];
lines.push(`▸ surum-bekcisi ${now} — rino-shared son etiket: ${localTag ?? '?'}${remoteTag ? ` (uzak: ${remoteTag})` : ''}`);
lines.push('');
const pad = (s, n) => String(s ?? '-').padEnd(n);
lines.push(`  ${pad('proje', 15)} ${pad('spec', 34)} ${pad('kurulu', 13)} ${pad('next', 9)} durum`);
for (const r of rows) {
  const specShort = r.spec.replace('github:niedy707/rino-shared', '…');
  lines.push(`  ${pad(r.proje, 15)} ${pad(specShort, 34)} ${pad(r.kurulu, 13)} ${pad(r.next ?? '-', 9)} ${r.durum.length ? '❌ ' + r.durum.join('; ') : '✅'}`);
}
lines.push('');
if (sapmalar.length) {
  lines.push(`❌ ${sapmalar.length} sapma:`);
  for (const s of sapmalar) lines.push(`   - ${s}`);
  if (rows.some((r) => r.durum.length)) {
    lines.push('');
    lines.push('Onar: ./scripts/bump-consumers.sh ' + (localTag ?? 'vX.Y.Z') + ' [proje]   (bağlı olmayan için önce package.json\'a ekle)');
  }
  if (nextVersions.length > 1) lines.push('Next hizası: her projede `npm i next@' + nextVersions[nextVersions.length - 1] + '` — ayrı karar, build/test ile.');
} else {
  lines.push('✅ Sapma yok — tüm tüketiciler ' + (localTag ?? '?') + ' üzerinde, Next sürümleri hizalı.');
}
const text = lines.join('\n');

if (json) {
  console.log(JSON.stringify({ zaman: now, sonEtiket: localTag, uzakEtiket: remoteTag, tuketiciler: rows, next: nextVersions, sapmalar }, null, 2));
} else {
  console.log(text);
}

if (lastFile) {
  try {
    mkdirSync(dirname(lastFile), { recursive: true });
    writeFileSync(lastFile, (sapmalar.length ? text : `✅ ${now} sapma yok (${localTag})`) + '\n');
  } catch (e) { console.error(`--last yazılamadı: ${e.message}`); }
}

process.exit(sapmalar.length ? 1 : 0);
