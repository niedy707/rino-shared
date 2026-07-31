#!/usr/bin/env node
/**
 * BEKÇİ — mükerrer tanım sayısı ARTMASIN.
 *
 * Neden: @rino/shared'ın sahip olduğu fonksiyonların kardeş projelerde yerel
 * kopyaları çıktığında sessiz davranış sapması doğuyor (bkz. 2026-07-31 analizi:
 * normalizeName 18 kopya, phoneLast10 11, titleCase 10 — hepsi ayrışmış).
 *
 * Bu script mevcut kopyaları SİLMEZ ve tek seferde temizlik DAYATMAZ. Sadece
 * "kanamayı durdurur": sayı taban çizgisinin üstüne çıkarsa hata verir.
 * Sayı DÜŞERSE taban çizgisini güncellemeni söyler (ilerleme kilitlenir).
 *
 * Kullanım:
 *   node scripts/guard-duplicates.mjs           # kontrol et
 *   node scripts/guard-duplicates.mjs --update  # taban çizgisini güncelle
 *
 * Kardeş proje bulunamazsa o proje sessizce atlanır (CI'da yalnız bu repo
 * checkout edilmiş olabilir).
 */
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..');
const PROJECTS_ROOT = resolve(REPO, '..');
const BASELINE_PATH = join(REPO, 'scripts', 'duplicate-baseline.json');

/** Kardeş projeler — @rino/shared'ı tüketen ya da tüketmesi beklenen ağaçlar. */
const SIBLINGS = ['calendar-api', 'clinic-sync', 'takvim', 'asistan-panel', 'mobil-panel'];

/** Bu repo tarafından SAHİPLENİLEN fonksiyonlar. Yerel kopyası ARTMAMALI. */
const GUARDED = ['calculateControlLabel', 'normalizeMobil', 'daysBetweenDates', 'transliterate'];

/**
 * NOT: calendar-api'de `transliterateCyrillic` adında AYRI (yalnız Kiril kapsayan)
 * bir kopya var — farklı isim olduğu için bu bekçi onu saymaz. İkisinin Kiril
 * haritası BİREBİR aynı tutulmalı; ayrışırlarsa yazan ile okuyan farklı anahtar
 * üretir. Uzun vadede calendar-api buradaki transliterate()'i benimsemeli.
 */

const SKIP_DIRS = new Set(['node_modules', '.next', '.git', 'dist', 'coverage', 'worktrees', '_archive', 'arsiv', '.venv-photos']);
const EXTS = /\.(ts|tsx|mjs|js)$/;

function walk(dir, out = []) {
  let entries;
  try { entries = readdirSync(dir); } catch { return out; }
  for (const name of entries) {
    if (SKIP_DIRS.has(name)) continue;
    const full = join(dir, name);
    let st;
    try { st = statSync(full); } catch { continue; }
    if (st.isDirectory()) walk(full, out);
    else if (EXTS.test(name)) out.push(full);
  }
  return out;
}

/** `function foo(`, `const foo =`, `export function foo(` biçimlerini yakalar. */
function definitionRegex(fn) {
  return new RegExp(`(?:export\\s+)?(?:async\\s+)?(?:function|const|let|var)\\s+${fn}\\b`);
}

const roots = [REPO, ...SIBLINGS.map((p) => join(PROJECTS_ROOT, p))].filter(existsSync);
const skipped = SIBLINGS.filter((p) => !existsSync(join(PROJECTS_ROOT, p)));

const found = Object.fromEntries(GUARDED.map((fn) => [fn, []]));

for (const root of roots) {
  for (const file of walk(root)) {
    let text;
    try { text = readFileSync(file, 'utf8'); } catch { continue; }
    for (const fn of GUARDED) {
      if (!text.includes(fn)) continue;
      const re = definitionRegex(fn);
      text.split('\n').forEach((line, i) => {
        if (re.test(line)) found[fn].push(`${file.replace(PROJECTS_ROOT + '/', '')}:${i + 1}`);
      });
    }
  }
}

const counts = Object.fromEntries(GUARDED.map((fn) => [fn, found[fn].length]));

if (process.argv.includes('--update')) {
  writeFileSync(BASELINE_PATH, JSON.stringify({ _not: 'Elle düzenleme; `npm run guard -- --update` kullan.', counts }, null, 2) + '\n');
  console.log('Taban çizgisi güncellendi:', JSON.stringify(counts));
  process.exit(0);
}

if (!existsSync(BASELINE_PATH)) {
  console.error('Taban çizgisi yok. Önce: node scripts/guard-duplicates.mjs --update');
  process.exit(1);
}

const baseline = JSON.parse(readFileSync(BASELINE_PATH, 'utf8')).counts;
let failed = false;
let improved = false;

for (const fn of GUARDED) {
  const now = counts[fn];
  const was = baseline[fn] ?? 0;
  if (now > was) {
    failed = true;
    console.error(`\n❌ ${fn}: ${was} → ${now} (YENİ KOPYA)`);
    for (const loc of found[fn]) console.error(`     ${loc}`);
    console.error(`   → Yerel kopya yerine: import { ${fn} } from '@rino/shared'`);
  } else if (now < was) {
    improved = true;
    console.log(`✅ ${fn}: ${was} → ${now} (kopya azaldı)`);
  } else {
    console.log(`   ${fn}: ${now} tanım (değişmedi)`);
  }
}

if (skipped.length) console.log(`\n(atlanan kardeş proje: ${skipped.join(', ')})`);

if (failed) {
  console.error('\nMükerrer tanım sayısı arttı. Kopyayı kaldır ya da bilinçliyse:');
  console.error('  node scripts/guard-duplicates.mjs --update\n');
  process.exit(1);
}

if (improved) {
  console.log('\nİlerleme var — taban çizgisini kilitle:');
  console.log('  node scripts/guard-duplicates.mjs --update\n');
}

console.log('\n✅ Bekçi geçti.');
