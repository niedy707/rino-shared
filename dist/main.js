/**
 * @rino/shared — klinik ekosisteminin ORTAK SAF FONKSİYONLARI.
 *
 * Bu paket bilinçli olarak KÜÇÜKTÜR. Yalnızca ürün yorumundan bağımsız,
 * girdi→çıktı saf fonksiyonlar buraya girer.
 *
 * Ürüne özgü yorum (ör. bir takvim etkinliğinin "ameliyat mı randevu mu"
 * olduğu) BURAYA GİRMEZ — takvim ve calendar-api bunu KASITLI olarak farklı
 * yorumluyor. Böyle mantığı paylaştırmak sahte bir birlik kurar ve birinin
 * ekranını sessizce bozar.
 *
 * 2026-07-31: 22 export'un 19'u hiç kullanılmadığı ve 2026-07-13'ten beri bayat
 * kaldığı için kaldırıldı (git geçmişinde duruyorlar). Bayat bir "kanonik"
 * kaynak, kopya koddan daha tehlikelidir — doğru sanılır.
 */
export * from './names.js';
export * from './phones.js';
export * from './controlDuration.js';
