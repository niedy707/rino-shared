/**
 * Bir takvim etkinliğinin ameliyat sayılması için TÜMÜ gereklidir:
 *   1. 🔪 emoji içermeli
 *   2. Süre >= 60 dakika olmalı
 *   3. Renk KIRMIZI (colorId=11) olmamalı
 *   4. ℹ️ içermemeli
 *   5. Hariç tutma kelimeleri içermemeli:
 *      ERT, ERTELEME, İPT, İPTAL, İZİN, KONGRE, XXX, TOPLANTI, BOŞLUK
 *      (Türkçe karakter + büyük/küçük harf bağımsız)
 *   6. Temizlenmiş isim >= 2 kelime olmalı
 */
export declare function categorizeEvent(title: string, color?: string, start?: Date | string, end?: Date | string): 'surgery' | 'checkup' | 'appointment' | 'blocked' | 'ignore' | 'info';
/**
 * Normalizes patient names by removing noise (titles, dates, phone numbers, specific keywords).
 * Implements user-specified rules:
 * - Case/Char insensitive (Turkish support)
 * - Remove 'tel' + numbers
 * - Remove 'yas'/'yaş' + numbers
 * - Remove specific keywords and everything after ('yabancı', 'ortak', 'rino', 'kosta', 'revizyon'...)
 */
export declare function normalizeName(name: string): string;
/**
 * Cleans the display name for storage and UI while preserving original characters and case.
 * Rules:
 * - Remove emoji 🔪
 * - Remove time patterns (e.g. 09:00, 14.30)
 * - Remove parentheses and their content: (abc)
 * - Remove standalone word "iy" (case-insensitive)
 * - Remove "tel" or "telefon" followed by digits
 * - Remove "yas" or "yaş" followed by a 2-digit age
 * - Remove specific keywords: Kosta, kostalı, rino, revizyon, ortak, vaka
 * - PRESERVE: 🎂YYYY birth-year annotations (e.g. 🎂2002)
 * - PRESERVE: [Rev1], [Rev2] revision tags
 */
export declare function cleanDisplayName(name: string): string;
export declare const SURGERY_TAGS: string[];
export declare function normalizeSurgery(raw: string | undefined): string | undefined;
/**
 * Takvim etkinliği başlığından ameliyat adını çıkarır.
 *
 * Kurallar (öncelik sırasıyla):
 *   1. Pipe notasyonu: "Ad Soyad | Otoplasti" → "Otoplasti"
 *   2. Keyword tarama (Türkçe karakter + büyük/küçük harf bağımsız)
 *   3. Varsayılan: "Rinoplasti"
 */
export declare function getSurgeryName(title: string): string;
/**
 * @deprecated getSurgeryName() kullanın.
 * Takvim etkinliği başlığından ameliyat türünü çıkarır.
 * Bulunamazsa undefined döner (varsayılan yok).
 */
export declare function extractSurgeryType(title: string): string | undefined;
