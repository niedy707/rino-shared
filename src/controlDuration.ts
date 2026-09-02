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

/** GG.AA.YYYY — Türkiye'de elle yazılan tarih biçimi. */
const TR_DATE = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/;

/**
 * Tarih girdisini ayrıştırır.
 *
 *   Date          → olduğu gibi
 *   "YYYY-MM-DD…" → `new Date(s)` (mevcut davranış; saat/zaman dilimi korunur)
 *   "GG.AA.YYYY"  → AÇIKÇA gün.ay.yıl — V8 bunu AA.GG.YYYY sayıyordu:
 *                   ('01.01.2026','08.01.2026') 7 gün yerine 212 gün → "7m" çıkıyordu.
 *   diğer         → `new Date(s)`; ayrıştırılamazsa Invalid Date (getTime() NaN)
 *
 * Boş/null/undefined → Invalid Date. Çağıranlar NaN'ı `Number.isFinite` ile yakalar.
 */
function parseDate(d: string | Date | null | undefined): Date {
  if (d instanceof Date) return d;
  const s = String(d ?? '').trim();
  if (!s) return new Date(NaN);
  const tr = TR_DATE.exec(s);
  if (tr) {
    const dd = Number(tr[1]), mm = Number(tr[2]), yyyy = Number(tr[3]);
    const date = new Date(Date.UTC(yyyy, mm - 1, dd));
    // 31.02.2026 gibi taşan tarihler sessizce Mart'a kaymasın → geçersiz
    return date.getUTCMonth() === mm - 1 && date.getUTCDate() === dd ? date : new Date(NaN);
  }
  return new Date(s);
}

function toUTCMidnight(d: string | Date): number {
  const date = parseDate(d);
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

/**
 * İki tarih arasındaki gün farkı (b - a), UTC gün-başlangıcına göre (saat bileşeni yok sayılır).
 * Girdilerden biri ayrıştırılamıyorsa `NaN` döner (patlamaz).
 */
export function daysBetweenDates(a: string | Date, b: string | Date): number {
  return Math.round((toUTCMidnight(b) - toUTCMidnight(a)) / 86400000);
}

const AVG_DAYS_PER_MONTH = 30.44;

/**
 * Ameliyat tarihinden (ya da referans olaydan) verilen güne kadar geçen süreyi
 * kısa bir kontrol-etiketine çevirir.
 *
 * Kurallar:
 *   geçersiz/boş tarih → "?" (v1.3.1: önceden "NaNm" üretiyordu)
 *   negatif/0 gün → "?"      (event, surgery'den önce/aynı gün — geçersiz)
 *   1-4 gün    → "{n}d"
 *   5-8 gün    → "1w"
 *   9-12 gün   → "{n}d"
 *   13-15 gün  → "2w"
 *   16-30 gün  → "3w" ya da "1m" (hangisine yakınsa)
 *   30-180 gün → 0.5 aralıklarla "{n}m" (1m, 1.5m, 2m, ... 6m)
 *   180+ gün   → 1'er aralıklarla "{n}m" (6m, 7m, 8m, ...)
 *
 * @param surgeryDateStr — Ameliyat/referans tarihi (YYYY-MM-DD, GG.AA.YYYY ya da Date)
 * @param eventDateStr — Süresi hesaplanacak gün (YYYY-MM-DD, GG.AA.YYYY ya da Date)
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
  if (!Number.isFinite(days) || days <= 0) return '?';
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
