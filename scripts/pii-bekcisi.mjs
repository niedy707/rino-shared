#!/usr/bin/env node
/**
 * PII BEKÇİSİ — gerçek hasta verisi (telefon / TC / ad) repoya girmesin.
 *
 * Neden: 02.09.2026 taramasında 5 raporun 4'ünde gerçek hasta telefonu ve adı
 * bulundu — kaynak kodda, testte, JSDoc'ta VE rapor/TODO/COZUMLER belgelerinde.
 * rino-shared PUBLIC. Bu script iki noktada çalışır:
 *
 *   --staged              pre-commit hook: yalnız staged (index) içeriği tarar
 *   --repo <yol> [...]    tam tarama: `git ls-files` + çalışma ağacındaki
 *                         *_rapor*.md, *_tara*.md, *_denetim*.md, COZUMLER.md, TODO.md
 *
 * Kalıplar:
 *   • TR cep telefonu  (+90 / 0090 / 05xx …) — sentetik aileler beyaz listede
 *   • 11 haneli TC kimlik no — yalnız checksum TUTANLAR raporlanır
 *   • --isim-listesi <dosya>  satır başına bir ad; dosya YOKSA sessizce geçilir.
 *     Bu dosya (pii-isimler.txt) .gitignore'da — ASLA sürümlenmez.
 *
 * İzin listesi (opsiyonel, repo kökünde `.pii-bekcisi-allow`, SÜRÜMLENİR):
 *   num:<rakamlar>   izinli numara — iş telefonu gibi PII olmayan gerçek numara.
 *                    Karşılaştırma rakamlar üzerinden: telefon için +90/0 öneki
 *                    soyulmuş son 10 hane, TC için 11 hanenin tamamı.
 *   path:<önek>      repo-göreli yol öneki; altındaki tüm eşleşmeler yoksayılır.
 *   # yorum          boş satır ve `#` ile başlayan satır atlanır.
 *   Tanınmayan satır stderr'e uyarı basar ve YOKSAYILIR (izin vermez).
 *   --staged ve --repo modlarının ikisi de onurlandırır; --json'da `allowed: n`.
 *
 * Çıktı: `dosya:satır: <MASKELİ eşleşme> (kalıp)` — tam değer HİÇBİR ZAMAN yazılmaz.
 * --json ile makine okunur çıktı. Eşleşme varsa exit 1; kullanım hatası exit 2.
 *
 * Bağımlılıksız, Node ≥ 18.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, basename, extname, resolve, relative } from 'node:path';

// ── Argümanlar ────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const opts = { staged: false, repos: [], isimListesi: null, json: false };
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === '--staged') opts.staged = true;
  else if (a === '--repo') opts.repos.push(argv[++i]);
  else if (a === '--isim-listesi') opts.isimListesi = argv[++i];
  else if (a === '--json') opts.json = true;
  else if (a === '-h' || a === '--help') { usage(); process.exit(0); }
  else { console.error(`Bilinmeyen argüman: ${a}`); usage(); process.exit(2); }
}
if (!opts.staged && opts.repos.length === 0) { usage(); process.exit(2); }
if (opts.repos.some((r) => !r)) { console.error('--repo bir yol ister'); process.exit(2); }

function usage() {
  console.error('Kullanım: node pii-bekcisi.mjs (--staged | --repo <yol> [--repo <yol> …]) [--isim-listesi <dosya>] [--json]');
}

// ── Dosya seçimi ──────────────────────────────────────────────────────────────
const SKIP_DIR_PARTS = new Set(['node_modules', 'dist', '.next', '.git', 'coverage', '.venv', '.venv-photos', 'worktrees']);
const BINARY_EXT = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.heic', '.bmp', '.ico', '.svg',
  '.pdf', '.zip', '.gz', '.tgz', '.tar', '.7z', '.dmg',
  '.woff', '.woff2', '.ttf', '.otf', '.eot',
  '.mp3', '.mp4', '.mov', '.m4a', '.wav', '.aac',
  '.sqlite', '.db', '.bin', '.exe', '.wasm', '.node',
  '.lock',
]);
// İzin listesi dosyasının kendisi taranmaz: girdileri tanım gereği izinlidir,
// tarandığında `allowed` sayacını şişirir (her num: satırı bir "izinli eşleşme" olur).
const ALLOW_FILE = '.pii-bekcisi-allow';
const SKIP_BASENAMES = new Set(['package-lock.json', 'yarn.lock', 'pnpm-lock.yaml', '.DS_Store', 'pii-isimler.txt', ALLOW_FILE]);
const DOC_GLOBS = [/_rapor[^/]*\.md$/i, /_tara[^/]*\.md$/i, /_denetim[^/]*\.md$/i, /^COZUMLER\.md$/, /^TODO\.md$/];
const MAX_BYTES = 20 * 1024 * 1024;

function isSkippablePath(rel) {
  const parts = rel.split('/');
  if (parts.slice(0, -1).some((p) => SKIP_DIR_PARTS.has(p))) return true;
  const base = basename(rel);
  if (SKIP_BASENAMES.has(base)) return true;
  if (BINARY_EXT.has(extname(base).toLowerCase())) return true;
  return false;
}
function looksBinary(buf) {
  const n = Math.min(buf.length, 8192);
  for (let i = 0; i < n; i++) if (buf[i] === 0) return true;
  return false;
}

function git(cwd, args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
}

/** Ağaçta belge kalıplarına uyan dosyaları bul (node_modules vb. hariç). */
function walkDocs(root, dir = root, out = []) {
  let entries;
  try { entries = readdirSync(dir); } catch { return out; }
  for (const name of entries) {
    if (SKIP_DIR_PARTS.has(name)) continue;
    const full = join(dir, name);
    let st;
    try { st = statSync(full); } catch { continue; }
    if (st.isDirectory()) walkDocs(root, full, out);
    else if (DOC_GLOBS.some((re) => re.test(name))) out.push(relative(root, full));
  }
  return out;
}

// ── Kalıplar ──────────────────────────────────────────────────────────────────
const PHONE_RE = /(\+90|0090|\b0?5\d{2})[\s.\-]?\d{3}[\s.\-]?\d{2}[\s.\-]?\d{2}\b/g;
// `+` ya da rakamla başlayan dizide değil: "+31612345678" (E.164) TC değildir.
const TC_RE = /(?<![+\d])\b[1-9]\d{10}\b/g;

/**
 * Sentetik telefon aileleri — bunlar testlerde/belgelerde kasıtlı kullanılır.
 * Son 10 hane üzerinden karar verilir (ülke kodu/0 öneki fark etmez).
 */
function isSyntheticPhone(last10) {
  return (
    /^555111\d{4}$/.test(last10) ||   // 0555 111 22 33 ailesi
    /^5\d{2}1234567$/.test(last10) ||  // 0532 123 45 67 (JSDoc örneği)
    /^5\d{2}0000000$/.test(last10) ||  // 05xx 000 00 00
    /^600/.test(last10)                // +34 600 000 000 (yabancı örnek)
  );
}

/**
 * Sentetik TC — Türkiye'de test verisi olarak yerleşmiş, checksum tutan tek değer.
 * Şablon önizlemeleri / fixture'lar bunu kullanır; gerçek kişiye ait değildir.
 */
function isSyntheticTc(tc) {
  return tc === '11111111110';
}

/** TC checksum: 10. hane = ((tek hanelerin toplamı×7) − çift hanelerin toplamı) mod 10; 11. hane = ilk 10'un toplamı mod 10. */
function tcChecksumOk(s) {
  const d = [...s].map(Number);
  const odd = d[0] + d[2] + d[4] + d[6] + d[8];
  const even = d[1] + d[3] + d[5] + d[7];
  if (((odd * 7 - even) % 10 + 10) % 10 !== d[9]) return false;
  if (d.slice(0, 10).reduce((a, b) => a + b, 0) % 10 !== d[10]) return false;
  return true;
}

function maskPhone(m) {
  // Rakamların ilk 2'si ve son 2'si kalır, aradakiler * — ayraçlar korunur.
  const digits = m.replace(/\D/g, '');
  let idx = 0;
  return m.replace(/\d/g, () => { const i = idx++; return i < 2 || i >= digits.length - 2 ? digits[i] : '*'; });
}
function maskTc(m) { return m.slice(0, 2) + '*******' + m.slice(-2); }
function maskName(m) { return m.charAt(0) + '*'.repeat(Math.max(2, m.length - 1)); }

/** Türkçe/aksan duyarsız karşılaştırma için kaba normalizasyon. */
const fold = (s) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/ı/g, 'i').toLowerCase();

let nameEntries = [];
if (opts.isimListesi && existsSync(opts.isimListesi)) {
  nameEntries = readFileSync(opts.isimListesi, 'utf8')
    .split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#'))
    .map((n) => ({ raw: n, folded: fold(n) }));
}

// ── İzin listesi (.pii-bekcisi-allow) ─────────────────────────────────────────
const EMPTY_ALLOW = { phones: new Set(), tcs: new Set(), paths: [] };

/** Rakam dizisini telefon anahtarına indir: +90/0090/0 öneki soyulmuş son 10 hane. */
function phoneKey(digits) {
  return digits.length >= 10 ? digits.slice(-10) : digits;
}

/** Repo kökündeki izin dosyasını oku. Dosya yoksa boş liste (her şey raporlanır). */
function loadAllow(root) {
  const file = join(root, ALLOW_FILE);
  if (!existsSync(file)) return EMPTY_ALLOW;
  const allow = { phones: new Set(), tcs: new Set(), paths: [] };
  const lines = readFileSync(file, 'utf8').split('\n');
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i].trim();
    if (!l || l.startsWith('#')) continue;
    if (l.startsWith('num:')) {
      const digits = l.slice(4).replace(/\D/g, '');
      if (!digits) { console.error(`${ALLOW_FILE}:${i + 1}: num: için rakam yok — yoksayıldı`); continue; }
      allow.phones.add(phoneKey(digits));
      if (digits.length === 11) allow.tcs.add(digits);
    } else if (l.startsWith('path:')) {
      const p = l.slice(5).trim().replace(/^\.\//, '');
      if (!p) { console.error(`${ALLOW_FILE}:${i + 1}: path: için yol yok — yoksayıldı`); continue; }
      allow.paths.push(p);
    } else {
      console.error(`${ALLOW_FILE}:${i + 1}: tanınmayan satır (num:/path:/# bekleniyor) — yoksayıldı`);
    }
  }
  return allow;
}

function isAllowedPath(rel, allow) {
  return allow.paths.some((p) => rel === p || rel.startsWith(p.endsWith('/') ? p : p + '/') || rel.startsWith(p));
}

/**
 * Bir dosyanın metnini tara. Eşleşmeler `hits`'e; izin listesiyle düşenler
 * `ctr.allowed` sayacına yazılır (raporlanmaz ama görünmez de kaybolmaz).
 */
function scanText(text, file, hits, allow = EMPTY_ALLOW, ctr = { allowed: 0 }) {
  const pathAllowed = isAllowedPath(file, allow);
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (const m of line.matchAll(PHONE_RE)) {
      const last10 = m[0].replace(/\D/g, '').slice(-10);
      if (isSyntheticPhone(last10)) continue;
      if (pathAllowed || allow.phones.has(last10)) { ctr.allowed++; continue; }
      hits.push({ dosya: file, satir: i + 1, maske: maskPhone(m[0]), kalip: 'telefon' });
    }
    for (const m of line.matchAll(TC_RE)) {
      if (!tcChecksumOk(m[0]) || isSyntheticTc(m[0])) continue;
      if (pathAllowed || allow.tcs.has(m[0])) { ctr.allowed++; continue; }
      hits.push({ dosya: file, satir: i + 1, maske: maskTc(m[0]), kalip: 'tc' });
    }
    if (nameEntries.length) {
      const f = fold(line);
      for (const n of nameEntries) {
        if (!f.includes(n.folded)) continue;
        if (pathAllowed) { ctr.allowed++; continue; }
        hits.push({ dosya: file, satir: i + 1, maske: maskName(n.raw), kalip: 'isim' });
      }
    }
  }
}

// ── Kaynak toplama ────────────────────────────────────────────────────────────
const results = []; // { repo, taranan, hits }

if (opts.staged) {
  const cwd = process.cwd();
  let top;
  try { top = git(cwd, ['rev-parse', '--show-toplevel']).trim(); } catch { console.error('git reposu değil'); process.exit(2); }
  const files = git(top, ['diff', '--cached', '--name-only', '-z', '--diff-filter=ACMR']).split('\0').filter(Boolean);
  const allow = loadAllow(top);
  const hits = []; let taranan = 0; const ctr = { allowed: 0 };
  for (const rel of files) {
    if (isSkippablePath(rel)) continue;
    let buf;
    try { buf = execFileSync('git', ['show', `:${rel}`], { cwd: top, stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: MAX_BYTES }); } catch { continue; }
    if (buf.length > MAX_BYTES || looksBinary(buf)) continue;
    taranan++;
    scanText(buf.toString('utf8'), rel, hits, allow, ctr);
  }
  results.push({ repo: basename(top), taranan, hits, allowed: ctr.allowed });
} else {
  for (const r of opts.repos) {
    const root = resolve(r);
    if (!existsSync(root)) { results.push({ repo: basename(root), taranan: 0, hits: [], hata: 'yol yok' }); continue; }
    const set = new Set();
    try { for (const f of git(root, ['ls-files', '-z']).split('\0')) if (f) set.add(f); }
    catch { results.push({ repo: basename(root), taranan: 0, hits: [], hata: 'git reposu değil' }); continue; }
    for (const f of walkDocs(root)) set.add(f);
    const allow = loadAllow(root);
    const hits = []; let taranan = 0; const ctr = { allowed: 0 };
    for (const rel of set) {
      if (isSkippablePath(rel)) continue;
      const full = join(root, rel);
      let st; try { st = statSync(full); } catch { continue; }
      if (!st.isFile() || st.size > MAX_BYTES) continue;
      let buf; try { buf = readFileSync(full); } catch { continue; }
      if (looksBinary(buf)) continue;
      taranan++;
      scanText(buf.toString('utf8'), rel, hits, allow, ctr);
    }
    results.push({ repo: basename(root), taranan, hits, allowed: ctr.allowed });
  }
}

// ── Çıktı ─────────────────────────────────────────────────────────────────────
const toplam = results.reduce((s, r) => s + r.hits.length, 0);
const toplamIzinli = results.reduce((s, r) => s + (r.allowed ?? 0), 0);

if (opts.json) {
  const out = {
    toplam,
    allowed: toplamIzinli,
    isimListesi: nameEntries.length,
    repolar: results.map((r) => ({
      repo: r.repo, taranan: r.taranan, eslesme: r.hits.length, allowed: r.allowed ?? 0, hata: r.hata,
      kalipOzeti: r.hits.reduce((o, h) => ((o[h.kalip] = (o[h.kalip] ?? 0) + 1), o), {}),
      dosyaOzeti: r.hits.reduce((o, h) => ((o[h.dosya] = (o[h.dosya] ?? 0) + 1), o), {}),
      eslesmeler: r.hits,
    })),
  };
  console.log(JSON.stringify(out, null, 2));
} else {
  for (const r of results) {
    const prefix = results.length > 1 || !opts.staged ? `${r.repo}/` : '';
    for (const h of r.hits) console.log(`${prefix}${h.dosya}:${h.satir}: ${h.maske} (${h.kalip})`);
  }
  console.log(toplam ? '' : '');
  for (const r of results) {
    if (r.hata) { console.log(`⊘ ${r.repo}: ${r.hata}`); continue; }
    const byFile = r.hits.reduce((o, h) => ((o[h.dosya] = (o[h.dosya] ?? 0) + 1), o), {});
    const files = Object.entries(byFile).sort((a, b) => b[1] - a[1]);
    console.log(`${r.hits.length ? '❌' : '✅'} ${r.repo}: ${r.taranan} dosya tarandı, ${r.hits.length} eşleşme${files.length ? ` / ${files.length} dosya` : ''}${r.allowed ? ` (${r.allowed} izinli — ${ALLOW_FILE})` : ''}`);
    for (const [f, n] of files) console.log(`     ${n.toString().padStart(4)}  ${f}`);
  }
  if (nameEntries.length) console.log(`(isim listesi: ${nameEntries.length} ad)`);
  else if (opts.isimListesi) console.log(`(isim listesi yok: ${opts.isimListesi} — isim taraması atlandı)`);
}

process.exit(toplam ? 1 : 0);
