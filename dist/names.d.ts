/**
 * İsim → Redis ANAHTARI normalizasyonu.
 *
 * ⚠️ Bu dosyadaki fonksiyonun çıktısı bir VERİTABANI ANAHTARIDIR. Davranışını
 * değiştirmek, mevcut anahtarları öksüz bırakır. Değişiklik ÖNCE test/names.test.ts
 * içinde sabitlenmeli, SONRA anahtar migrasyonuyla BİRLİKTE yayınlanmalı.
 */
export declare function transliterate(s: string): string;
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
 * Mevcut veriye etkisi ÖLÇÜLDÜ: 1616 hasta + 1482 not + 200 vesikalık anahtarının
 * HİÇBİRİ değişmedi (saklanan isimlerde bu karakterler yok — calendar-api'nin
 * cleanDisplayName'i zaten Latin'e çeviriyordu). Kazanç okuma tarafında:
 * mobil-panel arama kutusuna "Алекс" yazan biri artık "Aleks Petkov"u buluyor.
 */
export declare function normalizeMobil(name: string): string;
