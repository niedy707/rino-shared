/**
 * Numaranın ülkesi — yalnızca numara GEÇERLİYSE.
 *
 * Geçersizde `null` döner ve çağıran elle yazılmış kurallara düşer; böylece
 * kütüphanenin tanımadığı bozuk/eski kayıtlarda ("+906551112233") eski davranış
 * korunur.
 *
 * @returns ISO ülke kodu ("TR", "NL", …) veya null
 */
export declare function phoneCountry(phone: string | null | undefined): string | null;
/** Numara tipi — "MOBILE", "FIXED_LINE", "FIXED_LINE_OR_MOBILE" … veya null. */
export declare function phoneType(phone: string | null | undefined): string | null;
/**
 * Numara mobil hatta ait mi? Belirsiz `FIXED_LINE_OR_MOBILE` de mobil sayılır.
 * WhatsApp gibi yalnız mobilde çalışan kanallara sabit hat girmesini engellemek için.
 */
export declare function isMobilePhone(phone: string | null | undefined): boolean;
/**
 * KANONİK E.164 biçimi — depolama için kullanılacak biçim budur.
 *
 * @returns "+905321234567" ya da numara geçersizse `null`
 *
 * ⚠️ `null` dönebilir. Kayıt YAZARKEN `toE164(x) ?? x` kalıbını kullan —
 * tanınmayan bir numarayı normalize edemiyorsan HAM HALİYLE sakla, ASLA düşürme.
 * Veri kaybı, biçim tutarsızlığından beterdir.
 */
export declare function toE164(phone: string | null | undefined): string | null;
/**
 * İsim büyütmede kullanılacak locale — numaranın ülkesinden türetilir.
 *
 * NEDEN: Türkçe locale'de `I → ı` düştüğü için yabancı isimler bozuluyordu
 * ("IVAN PRIMEROV" → "Ivan Prımerov") ve `hastalar_db`'de bu yüzden
 * "Ivan Prımerov", "Irına Exemplu" gibi (sentetik örnek) kirli kayıtlar oluşmuştu.
 *
 * @returns "tr-TR" · "en-US" · numaradan karar çıkmıyorsa `null`
 */
export declare function localeForPhone(phone: string | null | undefined): string | null;
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
 * ASCII-dışı rakamlar (tam genişlik, Arap-Hint, Doğu Arap) önce ASCII'ye
 * çevrilir — `toE164` içindeki libphonenumber ile AYNI küme. v1.3.1 öncesi
 * "٠٥٥٥١١١٢٢٣٣" için `toE164` geçerli TR numarası döndürürken bu fonksiyon
 * `''` üretiyordu → aynı hasta iki farklı mükerrer anahtarına düşüyordu.
 * ASCII girdide çıktı DEĞİŞMEZ.
 *
 * @example phoneLast10("+905551112233") // → "5551112233"
 * @example phoneLast10("0555-111-2233") // → "5551112233"
 * @example phoneLast10(null)            // → ""
 */
export declare function phoneLast10(phone: string | null | undefined): string;
