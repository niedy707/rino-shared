/**
 * İsim → Redis ANAHTARI normalizasyonu.
 *
 * ⚠️ Bu dosyadaki fonksiyonun çıktısı bir VERİTABANI ANAHTARIDIR. Davranışını
 * değiştirmek, mevcut anahtarları öksüz bırakır. Değişiklik ÖNCE test/names.test.ts
 * içinde sabitlenmeli, SONRA anahtar migrasyonuyla BİRLİKTE yayınlanmalı.
 */

/**
 * Latin-dışı ve NFD ile AYRIŞMAYAN harfleri ASCII karşılığına çevirir.
 *
 * Neden gerekli: `String.normalize('NFD')` yalnız BİRLEŞEN aksanları ayrıştırır
 * (ö → o + ¨). Kendi kod noktası olan harfler (ø ł ß æ þ đ) ve Latin-dışı
 * alfabeler (Kiril) ayrışmaz — bu yüzden `[^a-z0-9\s]` kuralına takılıp SİLİNİR.
 *
 * Kiril haritası, calendar-api/src/lib/classification.ts içindeki
 * `transliterateCyrillic` ile BİREBİR aynıdır (c4e2877, 666835e). İki taraf
 * ayrışırsa yazan ile okuyan farklı anahtar üretir.
 *
 * @example transliterate("Алекс Петков")  // → "Aleks Petkov"
 * @example transliterate("Đorđe Nikolić") // → "Dorde Nikolić"  (ć NFD ile ayrışır)
 */
const TRANSLIT: Record<string, string> = {
  // ── Kiril (calendar-api CYRILLIC_MAP ile birebir) ──────────────────────────
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'yo', ж: 'zh', з: 'z', и: 'i', й: 'y',
  к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f',
  х: 'h', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sht', ъ: 'a', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
  і: 'i', ї: 'yi', є: 'ye', ґ: 'g',
  // ── NFD ile ayrışmayan Latin harfler ───────────────────────────────────────
  ø: 'o', œ: 'oe', æ: 'ae', ß: 'ss', ł: 'l', đ: 'd', ð: 'd', þ: 'th', ħ: 'h', ŧ: 't', ŋ: 'n',
};

const NEEDS_TRANSLIT = /[Ѐ-ӿԀ-ԯøœæßłđðþħŧŋ]/i;

export function transliterate(s: string): string {
  if (!s || !NEEDS_TRANSLIT.test(s)) return s;
  let out = '';
  for (const ch of s) {
    const low = ch.toLowerCase();
    const lat = TRANSLIT[low];
    if (lat === undefined) { out += ch; continue; }
    out += (ch !== low && lat) ? lat.charAt(0).toUpperCase() + lat.slice(1) : lat;
  }
  return out;
}

/**
 * KANONİK vesikalık/not ANAHTAR normalizasyonu.
 *
 * `patient_thumbs` ve `drpanel:muayene_notu` içindeki `m:` önekli alanları üreten
 * HER yer bunu kullanmalı — kopya tanım, sessiz "anahtar tutmama" riski doğurur:
 *
 *   yazan  → calendar-api/scripts/generate_patient_thumbs.mjs
 *   yazan  → clinic-sync/src/services/contacts-engine/finder_notes_sync.mjs
 *   okuyan → mobil-panel/lib/names.ts
 *
 * Dönüşüm:
 * - Türkçe İ/I açıkça ele alınır (locale tuzağından kaçınmak için)
 * - Türkçe harfler ASCII karşılığına iner (ş→s, ç→c, ö→o, ü→u, ı→i, ğ→g)
 * - Aksan NFD ile soyulur, TABAN HARF KORUNUR (José → jose)
 * - Harf/rakam dışındaki karakterler BOŞLUĞA çevrilir (silinmez → kelime yapışmaz)
 * - Ardışık boşluk tek boşluğa iner, baş/son kırpılır
 *
 * @example normalizeMobil("İrem Öz-Çelik")  // → "irem oz celik"
 * @example normalizeMobil("José García")    // → "jose garcia"
 * @example normalizeMobil("Алекс Петков")   // → "aleks petkov"
 * @example normalizeMobil("Đorđe Nikolić")  // → "dorde nikolic"
 *
 * v1.2.0'da düzeltildi: önce `transliterate()` çağrılıyor, böylece Kiril ve
 * NFD ile ayrışmayan Latin harfler (ø ł ß æ þ đ) SİLİNMEK yerine ASCII'ye
 * çevriliyor. Öncesinde "Алекс Петков" → "" (boş) oluyordu ve Kiril isimli tüm
 * hastalar aynı `m:` anahtarına çakışıyordu.
 *
 * Mevcut veriye etkisi ÖLÇÜLDÜ (2026-07-31, yayın öncesi tek seferlik kapı):
 * 1616 hasta adı karşılaştırıldı, anahtarı DEĞİŞEN 0; `patient_thumbs` ve
 * `drpanel:muayene_notu` anahtarlarından öksüz kalan 0. Saklanan isimlerde bu
 * karakterler yok — calendar-api'nin cleanDisplayName'i zaten Latin'e çeviriyordu.
 * (Anahtar SAYILARI oynaktır; kanıt değeri taşıyan "değişen: 0" sonucudur.)
 *
 * Kazanç okuma tarafında: mobil-panel arama kutusuna "Алекс" yazan biri artık
 * "Aleks Petkov"u buluyor.
 */
export function normalizeMobil(name: string): string {
  return transliterate((name || '').normalize('NFC'))
    .replace(/İ/g, 'i').replace(/I/g, 'ı')
    .toLowerCase()
    .replace(/ı/g, 'i').replace(/ğ/g, 'g').replace(/ü/g, 'u')
    .replace(/ş/g, 's').replace(/ö/g, 'o').replace(/ç/g, 'c')
    .normalize('NFD').replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}
