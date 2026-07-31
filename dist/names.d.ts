/**
 * İsim → Redis ANAHTARI normalizasyonu.
 *
 * ⚠️ Bu dosyadaki fonksiyonun çıktısı bir VERİTABANI ANAHTARIDIR. Davranışını
 * değiştirmek, mevcut anahtarları öksüz bırakır. Değişiklik ÖNCE test/names.test.ts
 * içinde sabitlenmeli, SONRA anahtar migrasyonuyla BİRLİKTE yayınlanmalı.
 */
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
 *
 * 🔴 BİLİNEN SINIRLAMA — NFD ile AYRIŞMAYAN harfler bozulur:
 *
 *   Sørén Ångström  → "s ren angstrom"   (ø silinir, kelime bölünür)
 *   Đorđe Nikolić   → "or e nikolic"     (Sırp đ)
 *   Łukasz Wałęsa   → "ukasz wa esa"     (Leh ł)
 *   Weiß Müller     → "wei muller"       (Alman ß)
 *   Алекс Петков    → ""                 (Kiril — TÜM Kiril isimler AYNI boş
 *                                          anahtara çakışır, biri diğerini ezer)
 *
 * NFD yalnız BİRLEŞEN aksanları ayrıştırır (ö→o+¨). Kendi kod noktası olan
 * harfler ve Latin-dışı alfabeler ayrışmadığı için `[^a-z0-9\s]` kuralına takılır.
 *
 * Klinik profili gereği bu alfabeler gerçek (Bulgar/Sırp/Polonyalı hastalar).
 * Düzeltme = anahtar değişikliği → migrasyon gerektirir. Bkz. README "Bilinen Sorunlar".
 */
export declare function normalizeMobil(name: string): string;
