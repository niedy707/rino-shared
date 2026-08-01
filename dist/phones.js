/**
 * Telefon normalizasyonu — KANONİK KAYNAK.
 *
 * ⚠️ NEDEN BURADA: 2026-08-01 ölçümünde ekosistemde `phoneLast10`'un 19,
 * `normalizePhone` ailesinin 20+ çağrı noktasında 12 farklı davranışı bulundu.
 * Kök sebep tembellik DEĞİL, yapısal erişimsizlikti: kanonik sayılan fonksiyonlar
 * `clinic-sync/src/lib/shared.mjs` içinde yaşıyordu ve o dosya başlığında kendini
 * "@rino/shared" ilan etmesine rağmen YEREL bir dosyaydı — `calendar-api`,
 * `mobil-panel` ve `takvim` paketi kursalar da o fonksiyonlara fiziksel olarak
 * ULAŞAMIYORDU. Kopya üretmekten başka seçenekleri yoktu.
 *
 * Bu dosya o erişimsizliği kaldırır. Ölçüm raporu:
 * ~/Projects/TELEFON_NORMALIZASYON_OLCUMU_2026-08-01.md
 *
 * `libphonenumber-js/max` kullanılır (tip tespiti `max` metadata gerektirir).
 */
import { parsePhoneNumberFromString } from 'libphonenumber-js/max';
/** `00…` uluslararası çıkış kodunu `+…`'ya çevirip ayrıştırır. */
function parse(phone) {
    const raw = String(phone || '').trim();
    if (!raw)
        return null;
    try {
        const normalized = raw.startsWith('00') ? `+${raw.slice(2)}` : raw;
        // Ülke kodu yoksa TR varsayılanıyla dene; geçersizse zaten null döner.
        const parsed = parsePhoneNumberFromString(normalized, normalized.startsWith('+') ? undefined : 'TR');
        return parsed && parsed.isValid() ? parsed : null;
    }
    catch {
        return null;
    }
}
/**
 * Numaranın ülkesi — yalnızca numara GEÇERLİYSE.
 *
 * Geçersizde `null` döner ve çağıran elle yazılmış kurallara düşer; böylece
 * kütüphanenin tanımadığı bozuk/eski kayıtlarda ("+906766825327") eski davranış
 * korunur.
 *
 * @returns ISO ülke kodu ("TR", "NL", …) veya null
 */
export function phoneCountry(phone) {
    return parse(phone)?.country || null;
}
/** Numara tipi — "MOBILE", "FIXED_LINE", "FIXED_LINE_OR_MOBILE" … veya null. */
export function phoneType(phone) {
    return parse(phone)?.getType() || null;
}
/**
 * Numara mobil hatta ait mi? Belirsiz `FIXED_LINE_OR_MOBILE` de mobil sayılır.
 * WhatsApp gibi yalnız mobilde çalışan kanallara sabit hat girmesini engellemek için.
 */
export function isMobilePhone(phone) {
    const t = phoneType(phone);
    return t === 'MOBILE' || t === 'FIXED_LINE_OR_MOBILE';
}
/**
 * KANONİK E.164 biçimi — depolama için kullanılacak biçim budur.
 *
 * @returns "+905321234567" ya da numara geçersizse `null`
 *
 * ⚠️ `null` dönebilir. Kayıt YAZARKEN `toE164(x) ?? x` kalıbını kullan —
 * tanınmayan bir numarayı normalize edemiyorsan HAM HALİYLE sakla, ASLA düşürme.
 * Veri kaybı, biçim tutarsızlığından beterdir.
 */
export function toE164(phone) {
    return parse(phone)?.number || null;
}
/**
 * İsim büyütmede kullanılacak locale — numaranın ülkesinden türetilir.
 *
 * NEDEN: Türkçe locale'de `I → ı` düştüğü için yabancı isimler bozuluyordu
 * ("GEORGI HRISTOV" → "Georgı Hrıstov") ve `hastalar_db`'de bu yüzden
 * "Georgı Georgıev Hrıstov", "Madgına Iordache" gibi kirli kayıtlar oluşmuştu.
 *
 * @returns "tr-TR" · "en-US" · numaradan karar çıkmıyorsa `null`
 */
export function localeForPhone(phone) {
    const raw = String(phone || '').trim();
    if (!raw)
        return null;
    // Önce libphonenumber'a sor — ülke kodunu elle çözümlemekten güvenilir.
    const country = phoneCountry(raw);
    if (country)
        return country === 'TR' ? 'tr-TR' : 'en-US';
    // Kütüphane tanımadı (bozuk/eski kayıt) → elle yazılmış kurallara düş.
    let digits = raw.replace(/\D/g, '');
    if (digits.startsWith('00'))
        digits = digits.slice(2);
    if (digits.length < 10)
        return null; // telefon değil → karar yok
    // 90… → Türkiye. '905' (cep) şartı koşulunca "+906766825327" gibi bozuk
    // kayıtlar yanlışlıkla yabancı sayılıyordu; sabit hat da TR'dir.
    if (digits.startsWith('90') && digits.length >= 12 && digits.length <= 13)
        return 'tr-TR';
    if (digits.length === 10 && digits.startsWith('5'))
        return 'tr-TR';
    if (digits.length === 11 && digits.startsWith('05'))
        return 'tr-TR';
    // Ülke kodu açıkça TR değil → yabancı
    if (raw.startsWith('+') || raw.startsWith('00'))
        return 'en-US';
    // Ülke kodsuz, TR biçimine de uymayan → yabancı yerel numara kabul et
    return 'en-US';
}
/**
 * Son 10 rakam — mükerrer tespit ANAHTARI.
 *
 * ⚠️ SÖZLEŞME: geçersiz/kısa girdide **boş string** döner, `null` DEĞİL, ve
 * asla patlamaz. Ekosistemdeki 19 kopya arasında dört ayrı sözleşme vardı
 * (`''` / `null` / THROW / kaydı atla); kanonik olan budur.
 *
 * Çağıran `if (l10)` yazmalı — `l10 !== null` ya da `l10.length` yazan kod
 * sözleşmeye göre ters düşer.
 *
 * ⚠️ Bu fonksiyon ülke kodunu KIRPAR: "+34 600 000 000" → "4600000000".
 * Yabancı numaraların son 10 hanesi anlamlı bir anahtar değildir; yabancı
 * kayıtlarda `toE164()` ile tam numara üzerinden eşleştir.
 *
 * @example phoneLast10("+905551112233") // → "5551112233"
 * @example phoneLast10("0555-111-2233") // → "5551112233"
 * @example phoneLast10(null)            // → ""
 */
export function phoneLast10(phone) {
    return String(phone || '').replace(/\D/g, '').slice(-10);
}
