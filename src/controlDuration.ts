/**
 * Kontrol Süresi Hesaplama — TEK DOĞRU KAYNAK.
 *
 * calendar-api, takvim, clinic-sync ve dr-panel BİREBİR bu fonksiyonu kullanmalı.
 * Kendi kopyasını yazmak / farklı bir yuvarlama mantığı türetmek YASAK — sapma,
 * projeler arasında tutarsız süre etiketlerine yol açar (bkz. dr-panel'de
 * bağımsız türetilen eski formülün ürettiği "8w" hatası, doğrusu "2m" idi).
 *
 * Önceki (calendar-api/takvim'de elle kopyalanmış) sürüm: 1-5d, 6-25w(max3w), 26+m.
 * Bu sürüm onun yerini alır — daha ince taneli (9-12 gün tekrar gün, 13-15 → 2w vb).
 */

function toUTCMidnight(d: string | Date): number {
  const date = d instanceof Date ? d : new Date(d);
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

/** İki tarih arasındaki gün farkı (b - a), UTC gün-başlangıcına göre (saat bileşeni yok sayılır). */
export function daysBetweenDates(a: string | Date, b: string | Date): number {
  return Math.round((toUTCMidnight(b) - toUTCMidnight(a)) / 86400000);
}

const AVG_DAYS_PER_MONTH = 30.44;

/**
 * Ameliyat tarihinden (ya da referans olaydan) verilen güne kadar geçen süreyi
 * kısa bir kontrol-etiketine çevirir.
 *
 * Kurallar:
 *   negatif/0 gün → "?"      (event, surgery'den önce/aynı gün — geçersiz)
 *   1-4 gün    → "{n}d"
 *   5-8 gün    → "1w"
 *   9-12 gün   → "{n}d"
 *   13-15 gün  → "2w"
 *   16-30 gün  → "3w" ya da "1m" (hangisine yakınsa)
 *   30-180 gün → 0.5 aralıklarla "{n}m" (1m, 1.5m, 2m, ... 6m)
 *   180+ gün   → 1'er aralıklarla "{n}m" (6m, 7m, 8m, ...)
 *
 * @param surgeryDateStr — Ameliyat/referans tarihi (YYYY-MM-DD ya da Date)
 * @param eventDateStr — Süresi hesaplanacak gün (YYYY-MM-DD ya da Date)
 *
 * @example
 * calculateControlLabel("2025-12-10", "2026-02-04") // 56 gün → "2m"
 * calculateControlLabel("2026-08-01", "2026-08-08")  // 7 gün  → "1w"
 * calculateControlLabel("2026-08-10", "2026-08-01")  // negatif → "?"
 */
export function calculateControlLabel(
  surgeryDateStr: string | Date,
  eventDateStr: string | Date
): string {
  const days = daysBetweenDates(surgeryDateStr, eventDateStr);
  if (days <= 0) return '?';
  if (days <= 4) return `${days}d`;
  if (days <= 8) return '1w';
  if (days <= 12) return `${days}d`;
  if (days <= 15) return '2w';

  if (days <= 30) {
    return Math.abs(days - 21) <= Math.abs(days - AVG_DAYS_PER_MONTH) ? '3w' : '1m';
  }

  const months = days / AVG_DAYS_PER_MONTH;
  if (days <= 180) {
    const rounded = Math.round(months * 2) / 2;
    return `${rounded}m`;
  }
  return `${Math.round(months)}m`;
}
