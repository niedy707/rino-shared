/**
 * KARAKTERİZASYON TESTLERİ — controlDuration
 *
 * Bu testler "doğru davranışı" değil, MEVCUT davranışı sabitler. Amaç: paylaşılan
 * paketi değiştirirken 4 tüketici projede (calendar-api, takvim, clinic-sync,
 * mobil-panel) sessiz davranış kayması olmasını engellemek.
 *
 * Bir test kırılırsa: değişiklik KASITLI mı diye sor. Kasıtlıysa testi güncelle
 * VE tüketicileri yeni etikete taşı (bkz. scripts/release.sh).
 */
import { describe, it, expect } from 'vitest';
import { calculateControlLabel, daysBetweenDates } from '../src/controlDuration.js';

/** 2026-01-01 + n gün → YYYY-MM-DD */
const plus = (n: number) => new Date(Date.UTC(2026, 0, 1 + n)).toISOString().slice(0, 10);

describe('daysBetweenDates', () => {
  it('aynı gün → 0', () => {
    expect(daysBetweenDates('2026-01-01', '2026-01-01')).toBe(0);
  });

  it('saat bileşenini yok sayar (UTC gün başlangıcına yuvarlar)', () => {
    // 23:00 → ertesi gün 01:00 = 2 saat, ama takvim günü olarak 1 gün
    expect(daysBetweenDates('2026-01-01T23:00:00Z', '2026-01-02T01:00:00Z')).toBe(1);
  });

  it('yıl sınırını geçer', () => {
    expect(daysBetweenDates('2025-12-31', '2026-01-01')).toBe(1);
  });

  it('artık yılı doğru sayar', () => {
    expect(daysBetweenDates('2024-02-28', '2024-02-29')).toBe(1);
    expect(daysBetweenDates('2024-02-28', '2024-03-01')).toBe(2);
  });

  it('geriye doğru negatif döner', () => {
    expect(daysBetweenDates('2026-01-10', '2026-01-05')).toBe(-5);
  });

  it('Date nesnesi de kabul eder', () => {
    expect(daysBetweenDates(new Date('2026-01-01'), new Date('2026-01-08'))).toBe(7);
  });
});

describe('calculateControlLabel — sınır değerleri', () => {
  // [gün farkı, beklenen etiket] — ÖLÇÜLMÜŞ mevcut davranış
  const cases: Array<[number, string]> = [
    [0, '?'],      // aynı gün → geçersiz
    [1, '1d'],
    [2, '2d'],
    [4, '4d'],     // 1-4 gün → gün
    [5, '1w'],     // 5-8 gün → 1w
    [7, '1w'],
    [8, '1w'],
    [9, '9d'],     // 9-12 gün → tekrar gün
    [12, '12d'],
    [13, '2w'],    // 13-15 gün → 2w
    [15, '2w'],
    [16, '3w'],    // 16-25 gün → 3w (21'e daha yakın)
    [20, '3w'],
    [21, '3w'],
    [25, '3w'],
    [26, '1m'],    // 26-30 gün → 1m (30.44'e daha yakın)
    [30, '1m'],
    [31, '1m'],    // 30+ gün → 0.5 aralıklı ay
    [38, '1m'],
    [45, '1.5m'],
    [60, '2m'],
    [91, '3m'],
    [180, '6m'],   // 180 gün sınırı
    [181, '6m'],   // 180+ → 1'er aralıklı ay
    [200, '7m'],
    [365, '12m'],
    [400, '13m'],
  ];

  for (const [days, expected] of cases) {
    it(`${days} gün → "${expected}"`, () => {
      expect(calculateControlLabel('2026-01-01', plus(days))).toBe(expected);
    });
  }

  it('negatif gün (kontrol ameliyattan önce) → "?"', () => {
    expect(calculateControlLabel('2026-01-10', '2026-01-05')).toBe('?');
  });

  it('JSDoc örnekleri tutuyor', () => {
    expect(calculateControlLabel('2025-12-10', '2026-02-04')).toBe('2m');
    expect(calculateControlLabel('2026-08-01', '2026-08-08')).toBe('1w');
    expect(calculateControlLabel('2026-08-10', '2026-08-01')).toBe('?');
  });

  it('3w/1m eşiği tam olarak 25→26 arasında', () => {
    // Regresyon koruması: yuvarlama formülü değişirse burası patlar
    expect(calculateControlLabel('2026-01-01', plus(25))).toBe('3w');
    expect(calculateControlLabel('2026-01-01', plus(26))).toBe('1m');
  });
});
