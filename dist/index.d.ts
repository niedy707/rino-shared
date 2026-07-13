/**
 * @rino/shared — Ortak Yardımcı Modüller
 *
 * Contacts, Finder-Editor ve Calendar-API projeleri arasında paylaşılan fonksiyonlar.
 *
 * Bu modül dosya sistemi veya ağ işlemi YAPMAZ — sadece saf (pure) fonksiyonlar içerir.
 * Redis okuma gibi I/O işlemleri, bu modüldeki yardımcı fonksiyonları kullanarak
 * her projede kendi bağlamında uygulanır.
 */
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
export declare function normalizeForMatch(name: string): string;
/**
 * Baş harfleri büyütme (Türkçe locale).
 *
 * @example
 * titleCase("aleyna güneş") // → "Aleyna Güneş"
 */
export declare function titleCase(str: string): string;
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
export declare function matchByName(searchName: string, patients: any[]): any;
/**
 * Ameliyat tarihine göre hasta bul.
 *
 * @param {string} dateStr — YYYY-MM-DD formatında tarih
 * @param {Array<{surgeryDate: string}>} patients — Aday hasta listesi
 * @returns {object|undefined}
 */
export declare function matchByDate(dateStr: string, patients: any[]): any;
/**
 * YYYY-MM-DD → yy.mm.dd formatına çevir.
 *
 * @example
 * formatDateShort("2026-03-18") // → "26.03.18"
 */
export declare function formatDateShort(dateStr: string): string;
/**
 * YYYY-MM-DD → yyyy.mm.dd formatına çevir (tire → nokta).
 *
 * @example
 * formatDateDot("2026-03-18") // → "2026.03.18"
 */
export declare function formatDateDot(dateStr: string): string;
/**
 * Bugünün tarihini YYYY-MM-DD formatında döndür (Istanbul timezone).
 *
 * @returns {string} — Örn: "2026-03-18"
 */
export declare function getTodayStr(): string;
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
export declare function parseFolderDate(folderName: string): {
    dateStr: string;
    year: number;
    name: string;
} | null;
/**
 * Telefon numarasının son 10 rakamını döndür (dedup key olarak kullanılır).
 *
 * @example
 * phoneLast10("+905333784807") // → "5333784807"
 * phoneLast10("0533-378-4807") // → "5333784807"
 */
export declare function phoneLast10(phone: string): string;
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
export declare function normalizePhone(phone: string): string | null;
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
export declare function parsePatientDB(raw: string | null): any;
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
export declare function generateDuplicateHash(name: string, surgeryDate: string): string;
