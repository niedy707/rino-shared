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

/**
 * SAHİPLENİLEN — bu paketin export ettiği fonksiyonlar.
 * Yerel kopya ÇIKMAMALI; çözüm: paketten import et.
 */
const OWNED = ['calculateControlLabel', 'normalizeMobil', 'daysBetweenDates', 'transliterate'];

/**
 * İZLENEN — pakette DEĞİL ama ekosistemde çok kopyalı ve ayrışmış fonksiyonlar.
 * 2026-07-31 analizinde ölçülen kopya sayıları: normalizeName 18, phoneLast10 11,
 * titleCase 10, normalizePhone 6, cleanDisplayName 5, categorizeEvent 5.
 * Bunlar için "paketten import et" DOĞRU TAVSİYE DEĞİL — bir kısmı kasıtlı ürün
 * farkı (categorizeEvent), bir kısmı yerel fork. Amaç yalnız KANAMAYI DURDURMAK:
 * sayı artarsa haber ver, mevcut kopyaları silmeye zorlama.
 */
const WATCHED = ['normalizeName', 'phoneLast10', 'normalizePhone', 'titleCase', 'cleanDisplayName', 'categorizeEvent', 'transliterateCyrillic'];

const GUARDED = [...OWNED, ...WATCHED];

/**
 * NOT: `transliterateCyrillic` ekosistemde 4 kopya (calendar-api/src/lib/classification.ts,
 * mobil-panel/lib/names.ts, clinic-sync perop-media ve hastanede lib/patients.ts).
 * Dördü de bu paketteki `transliterate()`'in Kiril haritasıyla BİREBİR aynı olmalı;
 * ayrışırlarsa yazan ile okuyan farklı `m:` anahtarı üretir. Uzun vadede hepsi
 * buradaki `transliterate()`'i benimsemeli — o yüzden İZLENEN listesinde.
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

/**
 * Bir fonksiyonun TANIM biçimlerini yakalar (çağrılarını değil):
 *   1. function foo( · const foo = · export async function foo(
 *   2. nesne-metodu / sınıf metodu kısayolu:  foo(a, b) {
 *   3. özellik ataması:  foo: function(…)  ·  foo: (a) => …  ·  foo: async (…) =>
 */
function definitionPatterns(fn) {
  const K = `["']?${fn}["']?`; // tırnaklı anahtar da sayılır: { "normalizeMobil": … }
  return [
    // 1. bildirim
    new RegExp(`(?:export\\s+)?(?:async\\s+)?(?:function|const|let|var)\\s+${fn}\\b`),
    // 2. nesne/sınıf metodu — erişim belirteci + static + async + dönüş tipi opsiyonel
    new RegExp(`^\\s*(?:(?:public|private|protected|readonly)\\s+)*(?:static\\s+)?(?:async\\s+)?${K}\\s*\\([^)]*\\)\\s*(?::[^{;]+)?\\{`),
    // 3. özellik ataması — f: function(…) · f: (a): T => · f: a =>
    new RegExp(`${K}\\s*:\\s*(?:async\\s*)?(?:function\\b|\\([^)]*\\)\\s*(?::[^=]+)?=>|[A-Za-z_$][\\w$]*\\s*=>)`),
  ];
}

const roots = [REPO, ...SIBLINGS.map((p) => join(PROJECTS_ROOT, p))].filter(existsSync);
const skipped = SIBLINGS.filter((p) => !existsSync(join(PROJECTS_ROOT, p)));

/**
 * Sayım REPO BAZLI tutulur: { [repo]: { [fn]: adet } }.
 *
 * Neden global değil: hook, "yeni kopya BU repoda mı?" sorusunu cevaplayabilmeli.
 * Global sayımla, takvim'e eklenen bir kopya calendar-api'de commit'i kilitliyordu
 * (bekçi başarısız fonksiyonun TÜM konumlarını basıyor, hook da kendi repo adını
 * o listede görüyordu). Repo bazlı sayım bunu kökten çözer.
 *
 * Satır numarası SAKLANMAZ — kod kaydığında sahte "yeni kopya" üretmesin diye.
 */
const repoOf = (file) => file.replace(PROJECTS_ROOT + '/', '').split('/')[0];

const counts = {};   // repo → fn → adet
const found = {};    // repo → fn → ["yol:satır", …]

for (const root of roots) {
  for (const file of walk(root)) {
    let text;
    try { text = readFileSync(file, 'utf8'); } catch { continue; }
    const repo = repoOf(file);
    for (const fn of GUARDED) {
      if (!text.includes(fn)) continue;
      const pats = definitionPatterns(fn);
      text.split('\n').forEach((line, i) => {
        if (!pats.some((re) => re.test(line))) return;
        (counts[repo] ??= {})[fn] = ((counts[repo] ??= {})[fn] ?? 0) + 1;
        ((found[repo] ??= {})[fn] ??= []).push(`${file.replace(PROJECTS_ROOT + '/', '')}:${i + 1}`);
      });
    }
  }
}

const total = (c, fn) => Object.values(c).reduce((s, r) => s + (r[fn] ?? 0), 0);

if (process.argv.includes('--update')) {
  writeFileSync(BASELINE_PATH, JSON.stringify({ _not: 'Elle düzenleme; `npm run guard -- --update` kullan.', byRepo: counts }, null, 2) + '\n');
  console.log('Taban çizgisi güncellendi (repo bazlı):');
  for (const fn of GUARDED) console.log(`   ${fn}: ${total(counts, fn)}`);
  process.exit(0);
}

if (!existsSync(BASELINE_PATH)) {
  console.error('Taban çizgisi yok. Önce: node scripts/guard-duplicates.mjs --update');
  process.exit(1);
}

const parsed = JSON.parse(readFileSync(BASELINE_PATH, 'utf8'));
if (!parsed.byRepo) {
  console.error('Taban çizgisi ESKİ biçimde (global sayım). Yenile:');
  console.error('  node scripts/guard-duplicates.mjs --update');
  process.exit(1);
}
const baseline = parsed.byRepo;

let failed = false;
let improved = false;
/** Hangi repolarda YENİ kopya var — hook bunu okur. */
const offendingRepos = new Set();

for (const fn of GUARDED) {
  const now = total(counts, fn);
  const was = total(baseline, fn);

  // Repo bazlı artış ara — global toplam aynı kalsa bile (biri artıp biri azalsa)
  const grew = [...new Set([...Object.keys(counts), ...Object.keys(baseline)])]
    .filter((r) => (counts[r]?.[fn] ?? 0) > (baseline[r]?.[fn] ?? 0));

  if (grew.length) {
    failed = true;
    grew.forEach((r) => offendingRepos.add(r));
    console.error(`\n❌ ${fn}: ${was} → ${now} (YENİ KOPYA)`);
    for (const r of grew) {
      console.error(`   ${r}: ${baseline[r]?.[fn] ?? 0} → ${counts[r][fn]}`);
      for (const loc of found[r][fn]) console.error(`     ${loc}`);
    }
    if (OWNED.includes(fn)) {
      console.error(`   → Yerel kopya yerine: import { ${fn} } from '@rino/shared'`);
    } else {
      console.error(`   → Bu fonksiyon pakette DEĞİL ama ekosistemde zaten çok kopyalı.`);
      console.error(`     Yeni kopya ekleme: mevcut bir tanımı import et ya da kanonik`);
      console.error(`     bir yer seçip oraya taşı. Kasıtlıysa taban çizgisini güncelle.`);
    }
  } else if (now < was) {
    improved = true;
    console.log(`✅ ${fn}: ${was} → ${now} (kopya azaldı)`);
  } else {
    console.log(`   ${fn}: ${now} tanım (değişmedi)`);
  }
}

if (skipped.length) console.log(`\n(atlanan kardeş proje: ${skipped.join(', ')})`);

if (failed) {
  // Hook bu satırı okuyup "benim repom mu?" diye bakar.
  console.error(`\nYENİ-KOPYA-REPOLAR: ${[...offendingRepos].join(' ')}`);
  console.error('\nMükerrer tanım sayısı arttı. Kopyayı kaldır ya da bilinçliyse:');
  console.error('  node scripts/guard-duplicates.mjs --update\n');
  process.exit(1);
}

if (improved) {
  console.log('\nİlerleme var — taban çizgisini kilitle:');
  console.log('  node scripts/guard-duplicates.mjs --update\n');
}

console.log('\n✅ Bekçi geçti.');
