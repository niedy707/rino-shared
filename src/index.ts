/**
 * @rino/shared — Ortak Yardımcı Modüller
 *
 * Contacts, Finder-Editor ve Calendar-API projeleri arasında paylaşılan fonksiyonlar.
 *
 * Bu modül dosya sistemi veya ağ işlemi YAPMAZ — sadece saf (pure) fonksiyonlar içerir.
 * Redis okuma gibi I/O işlemleri, bu modüldeki yardımcı fonksiyonları kullanarak
 * her projede kendi bağlamında uygulanır.
 */

// ─── İsim Normalizasyonu ──────────────────────────────────────────────────────

/**
 * Türkçe karakter normalleştirme — fuzzy isim eşleştirme için.
 *
 * Kullanım alanları:
 * - Contacts: muayene hastası ↔ Redis ameliyat kaydı eşleştirme
 * - Finder-Editor: klasör adı ↔ Redis hasta kaydı eşleştirme
 * - Calendar-API: duplicate hash üretimi
 *
 * Dönüşüm:
 * - Küçük harfe çevir (Türkçe locale: İ→i, I→ı)
 * - Türkçe özel karakterleri ASCII karşılıklarına dönüştür (ş→s, ç→c, ö→o, ü→u, ı→i, ğ→g)
 * - Alfanumerik olmayan karakterleri kaldır
 * - Ardışık boşlukları tek boşluğa düşür
 *
 * @example
 * normalizeName("Aleyna GÜNEŞ")   // → "aleyna gunes"
 * normalizeName("AYŞE KOCAAĞA")   // → "ayse kocaaga"
 * normalizeName("José García")     // → "jos garca"
 */
export function normalizeForMatch(name: string): string {
  return (name || '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase('tr-TR')
    .replace(/ş/g, 's').replace(/ç/g, 'c').replace(/ö/g, 'o')
    .replace(/ü/g, 'u').replace(/ı/g, 'i').replace(/ğ/g, 'g')
    .replace(/[^a-z0-9\s]/g, '')
    .trim();
}

/**
 * KANONİK vesikalık/not ANAHTAR normalizasyonu — mobil-panel lib/names
 * normalizeName ile BİREBİR. `patient_thumbs` (m:), `drpanel:muayene_notu` (m:)
 * gibi Redis anahtarlarını üreten HER yer (thumbs generator, finder_notes_sync,
 * panel) BUNU kullanmalı; kopya-tanım sessiz anahtar-tutmama riski doğurur (S-2).
 *
 * normalizeForMatch'ten FARKI: İ/I açık işlenir, aksan NFD ile soyulur
 * (yabancı ad korunur), ve harf-dışı karakter BOŞLUĞA çevrilir (silinmez).
 *
 * @example normalizeMobil("İrem Öz-Çelik") // → "irem oz celik"
 */
export function normalizeMobil(name: string): string {
  return (name || '')
    .replace(/İ/g, 'i').replace(/I/g, 'ı')
    .toLowerCase()
    .replace(/ı/g, 'i').replace(/ğ/g, 'g').replace(/ü/g, 'u')
    .replace(/ş/g, 's').replace(/ö/g, 'o').replace(/ç/g, 'c')
    .normalize('NFD').replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Baş harfleri büyütme (Türkçe locale).
 *
 * @example
 * titleCase("aleyna güneş") // → "Aleyna Güneş"
 */
export function titleCase(str: string): string {
  return (str || '').split(' ').map((w: string) =>
    w.charAt(0).toLocaleUpperCase('tr-TR') + w.slice(1).toLocaleLowerCase('tr-TR')
  ).join(' ');
}

// ─── Hasta Eşleştirme ─────────────────────────────────────────────────────────

/**
 * İsim bazlı hasta eşleştirme.
 *
 * Eşleştirme sırası (ilk bulunan döner):
 * 1. Tam eşleşme (normalize edilmiş)
 * 2. İçerme (biri diğerinin alt dizisi)
 * 3. İlk 2 kelimenin eşleşmesi (ad + soyad)
 *
 * @param {string} searchName — Aranacak isim (klasör adı veya hasta adı)
 * @param {Array<{name: string}>} patients — Aday hasta listesi (Redis'ten)
 * @returns {object|undefined} — Eşleşen hasta kaydı veya undefined
 *
 * @example
 * matchByName("Aleyna Güneş", patients)
 * matchByName("26.03.18 Aleyna Güneş", patients) // → bunun için önce parseFolderDate() kullan
 */
export function matchByName(searchName: string, patients: any[]): any {
  const normalized = normalizeForMatch(searchName);
  for (const p of patients) {
    const rn = normalizeForMatch(p.name);
    if (rn === normalized) return p;
    if (rn.includes(normalized) || normalized.includes(rn)) return p;
    const fw = normalized.split(' ').slice(0, 2);
    const rw = rn.split(' ').slice(0, 2);
    if (fw.length >= 2 && rw.length >= 2 && fw[0] === rw[0] && fw[1] === rw[1]) return p;
  }
  return undefined;
}

/**
 * Ameliyat tarihine göre hasta bul.
 *
 * @param {string} dateStr — YYYY-MM-DD formatında tarih
 * @param {Array<{surgeryDate: string}>} patients — Aday hasta listesi
 * @returns {object|undefined}
 */
export function matchByDate(dateStr: string, patients: any[]): any {
  return patients.find((p: any) => p.surgeryDate === dateStr);
}

// ─── Tarih Yardımcıları ───────────────────────────────────────────────────────

/**
 * YYYY-MM-DD → yy.mm.dd formatına çevir.
 *
 * @example
 * formatDateShort("2026-03-18") // → "26.03.18"
 */
export function formatDateShort(dateStr: string): string {
  if (!dateStr) return '';
  const [year, month, day] = dateStr.split('-');
  return `${year.slice(2)}.${month}.${day}`;
}

/**
 * YYYY-MM-DD → yyyy.mm.dd formatına çevir (tire → nokta).
 *
 * @example
 * formatDateDot("2026-03-18") // → "2026.03.18"
 */
export function formatDateDot(dateStr: string): string {
  if (!dateStr) return '';
  return dateStr.replace(/-/g, '.');
}

/**
 * Bugünün tarihini YYYY-MM-DD formatında döndür (Istanbul timezone).
 *
 * @returns {string} — Örn: "2026-03-18"
 */
export function getTodayStr() {
  const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Istanbul' }));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ─── Hasta Klasör Adı Parse ───────────────────────────────────────────────────

/** Hasta klasörü regex: yy.mm.dd Ad Soyad */
const PATIENT_FOLDER_PATTERN = /^(\d{2})\.(\d{2})\.(\d{2})\s+(.+)$/;

/**
 * Klasör adından yy.mm.dd tarih bilgisini çıkar.
 *
 * @param {string} folderName — Klasör adı
 * @returns {{ dateStr: string, year: number, name: string } | null}
 *
 * @example
 * parseFolderDate("26.03.18 Aysel Ayyıldız")
 * // → { dateStr: "2026-03-18", year: 2026, name: "Aysel Ayyıldız" }
 */
export function parseFolderDate(folderName: string): { dateStr: string, year: number, name: string } | null {
  const match = (folderName || '').match(PATIENT_FOLDER_PATTERN);
  if (!match) return null;
  const [, yy, mm, dd, rest] = match;
  const y = parseInt(yy, 10);
  const fullYear = y < 50 ? 2000 + y : 1900 + y;
  const dateStr = `${fullYear}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
  return { dateStr, year: fullYear, name: rest.trim() };
}

// ─── Telefon Yardımcıları ─────────────────────────────────────────────────────

/**
 * Telefon numarasının son 10 rakamını döndür (dedup key olarak kullanılır).
 *
 * @example
 * phoneLast10("+905333784807") // → "5333784807"
 * phoneLast10("0533-378-4807") // → "5333784807"
 */
export function phoneLast10(phone: string): string {
  return (phone || '').replace(/\D/g, '').slice(-10);
}

/**
 * Telefon numarasını +90... formatına normalize et.
 *
 * @example
 * normalizePhone("533-378-4807")      // → "+905333784807"
 * normalizePhone("0533 378 48 07")    // → "+905333784807"
 * normalizePhone("+34 671 19 89 89")  // → "+34671198989" (yabancı numara)
 *
 * @returns {string|null} — Normalize edilmiş numara veya null (geçersiz)
 */
export function normalizePhone(phone: string): string | null {
  if (!phone) return null;
  
  // Kural 1: sadece +, ve rakamlar kalsın
  let cleaned = phone.replace(/[^\d+]/g, '');
  
  // Kural 2: 00 ile başlıyorsa + yap
  if (cleaned.startsWith('00')) {
    cleaned = '+' + cleaned.substring(2);
  }
  
  // İstisna: 90 ile başlıyorsa ve kalanı 5 ile başlayan 10 rakamlı ise, baştaki 90'ı sil
  if (!cleaned.startsWith('+') && cleaned.startsWith('90')) {
    if (cleaned.substring(2).startsWith('5') && cleaned.length === 12) {
      cleaned = cleaned.substring(2);
    }
  }
  
  // İstisna: Başı tek 0 ise (0533...), sıfırı kaldırarak 10 haneli formata düşür
  if (!cleaned.startsWith('+') && cleaned.startsWith('0')) {
    cleaned = cleaned.substring(1);
  }
  
  // Kural 3: Zaten + ile başlıyorsa (ve yeterince uzunsa) aynen bırak
  if (cleaned.startsWith('+')) {
    return cleaned.length >= 12 ? cleaned : null;
  }
  
  // Kural 4: + veya 0 ile başlamıyor, ilk rakam 5 ise ve tam 10 karakterse
  if (cleaned.startsWith('5') && cleaned.length === 10) {
    return '+90' + cleaned;
  }
  
  // Kural 5: Diğer her şey şüpheli. Reddetmek yerine "Şüpheli" anlamında başına '?' ekleyip kabul et
  if (cleaned.length > 0) {
    return '?' + cleaned;
  }
  return null;
}

// ─── Redis Okuyucu (Saf Fonksiyon — Fetch Sağlayıcı ile) ─────────────────────

/**
 * Redis'ten hastalar_db key'ini oku ve parse et.
 *
 * NOT: Bu fonksiyon doğrudan fetch() YAPMAZ — her proje kendi Redis config'ini
 * (URL + Token) sağlayarak bu fonksiyonun döndürdüğü veriyi tüketir.
 *
 * Bu yardımcı fonksiyon, Redis'ten gelen ham string'i güvenli şekilde parse eder.
 *
 * @param {string|null} raw — Redis GET sonucu (JSON string)
 * @returns {{ lastUpdated: string|null, dataChangedAt: string|null, patients: Array }}
 */
export function parsePatientDB(raw: string | null): any {
  if (!raw) return { lastUpdated: null, dataChangedAt: null, patients: [] };
  try {
    let parsed = JSON.parse(raw);
    // Çift encode durumu: string içinde string
    if (typeof parsed === 'string') parsed = JSON.parse(parsed);
    if (!parsed || Array.isArray(parsed) || !Array.isArray(parsed.patients)) {
      return { lastUpdated: null, dataChangedAt: null, patients: [] };
    }
    return parsed;
  } catch {
    return { lastUpdated: null, dataChangedAt: null, patients: [] };
  }
}

/**
 * Duplicate hash üretimi — aynı hasta+tarih çiftinin tekrar eklenmesini engeller.
 *
 * @param {string} name — Hasta adı
 * @param {string} surgeryDate — Ameliyat tarihi (YYYY-MM-DD)
 * @returns {string} — Normalize edilmiş hash key
 *
 * @example
 * generateDuplicateHash("Aleyna GÜNEŞ", "2026-03-18")
 * // → "aleyna gunes__2026-03-18"
 */
export function generateDuplicateHash(name: string, surgeryDate: string): string {
  return `${normalizeForMatch(name)}__${surgeryDate}`;
}
