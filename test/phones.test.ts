/**
 * KARAKTERİZASYON TESTLERİ — telefon normalizasyonu
 *
 * Bu fonksiyonlar `clinic-sync/src/lib/shared.mjs`'ten TAŞINDI (kopyalanmadı).
 * Testler taşıma öncesi ölçülen davranışı sabitler; amaç, kaynağı değiştirirken
 * 4 tüketici projede sessiz kayma olmasını engellemek.
 *
 * ⚠️ `phoneLast10` çıktısı mükerrer tespit ANAHTARIDIR. Davranışını değiştirmek
 * mevcut eşleşmeleri bozar — önce burada testleştir, sonra gerçek veri üzerinde
 * eski↔yeni karşılaştırması yap.
 */
import { describe, it, expect } from 'vitest';
import {
  toE164,
  phoneLast10,
  phoneCountry,
  phoneType,
  isMobilePhone,
  localeForPhone,
} from '../src/phones.js';

describe('toE164 — kanonik depolama biçimi', () => {
  it('TR cep numarasını her biçimden aynı sonuca getirir', () => {
    const beklenen = '+905551112233';
    expect(toE164('+905551112233')).toBe(beklenen);
    expect(toE164('0555 111 22 33')).toBe(beklenen);
    expect(toE164('555-111-2233')).toBe(beklenen);
    expect(toE164('00905551112233')).toBe(beklenen);
    expect(toE164('5551112233')).toBe(beklenen);
  });

  it('TR sabit hattını da normalize eder', () => {
    expect(toE164('0212 345 67 89')).toBe('+902123456789');
  });

  it('yabancı numarayı ülke kodunu KORUYARAK normalize eder', () => {
    expect(toE164('+34 600 000 000')).toBe('+34600000000');
    expect(toE164('+31 6 12345678')).toBe('+31612345678');
    expect(toE164('+493012345')).toBe('+493012345');
  });

  it('numaranın yanındaki serbest metni temizler', () => {
    // hastalar_db'de gerçekten böyle kayıtlar var: "+90… (eski)"
    expect(toE164('+905551112233 (eski)')).toBe('+905551112233');
  });

  it('geçersiz girdide null döner (ASLA uydurmaz)', () => {
    expect(toE164('12345')).toBeNull();
    expect(toE164('abc')).toBeNull();
    expect(toE164('')).toBeNull();
    expect(toE164(null)).toBeNull();
    expect(toE164(undefined)).toBeNull();
    expect(toE164('+9055511122332025')).toBeNull(); // 16 hane — geçersiz
    expect(toE164('+906551112233')).toBeNull();     // bozuk eski kayıt
  });
});

describe('phoneLast10 — mükerrer anahtarı', () => {
  it('her TR biçiminden aynı anahtarı üretir', () => {
    expect(phoneLast10('+905551112233')).toBe('5551112233');
    expect(phoneLast10('0555-111-2233')).toBe('5551112233');
    expect(phoneLast10('0555 111 22 33')).toBe('5551112233');
    expect(phoneLast10('5551112233')).toBe('5551112233');
  });

  it('SÖZLEŞME: geçersiz girdide BOŞ STRING döner, null DEĞİL, patlamaz', () => {
    // Ekosistemde dört ayrı sözleşme vardı ('' / null / THROW / atla).
    // Kanonik olan '' — çağıran `if (l10)` yazmalı.
    expect(phoneLast10('abc')).toBe('');
    expect(phoneLast10('')).toBe('');
    expect(phoneLast10(null)).toBe('');
    expect(phoneLast10(undefined)).toBe('');
  });

  it('10 haneden kısa girdiyi olduğu gibi döndürür (null yapmaz)', () => {
    expect(phoneLast10('12345')).toBe('12345');
  });

  it('⚠️ BİLİNEN SINIRLAMA: yabancı numarada ülke kodunu kırpar', () => {
    // "+34 600 000 000" → "4600000000": İspanyol numarasını TR biçimine benzetir.
    // Yabancı kayıtlarda anahtar olarak KULLANMA — toE164() ile tam numara üzerinden eşleştir.
    expect(phoneLast10('+34 600 000 000')).toBe('4600000000');
    expect(phoneLast10('+31 6 12345678')).toBe('1612345678');
  });
});

describe('null güvenliği — 6 export da null/undefined girdide TypeError vermez', () => {
  it('her fonksiyon sözleşmesindeki "boş" değeri döner', () => {
    for (const bad of [null, undefined, '']) {
      expect(toE164(bad)).toBeNull();
      expect(phoneLast10(bad)).toBe('');
      expect(phoneCountry(bad)).toBeNull();
      expect(phoneType(bad)).toBeNull();
      expect(isMobilePhone(bad)).toBe(false);
      expect(localeForPhone(bad)).toBeNull();
    }
  });
});

describe('phoneLast10 — ASCII-dışı rakamlar (v1.3.1, toE164 ile tutarlı)', () => {
  it('Arap-Hint / Doğu Arap / tam-genişlik rakamlar aynı anahtarı üretir', () => {
    const arapHint = '٠٥٥٥١١١٢٢٣٣';   // U+0660…
    const doguArap = '۰۵۵۵۱۱۱۲۲۳۳';   // U+06F0…
    const tamGenislik = '０５５５１１１２２３３'; // U+FF10…
    for (const n of [arapHint, doguArap, tamGenislik]) {
      expect(toE164(n)).toBe('+905551112233');
      expect(phoneLast10(n)).toBe('5551112233');
      expect(phoneLast10(n)).toBe(phoneLast10(toE164(n)));
    }
  });

  it('ASCII girdide çıktı DEĞİŞMEDİ (mükerrer anahtarı sabit)', () => {
    expect(phoneLast10('+905551112233')).toBe('5551112233');
    expect(phoneLast10('0555-111-2233')).toBe('5551112233');
    expect(phoneLast10('+34 600 000 000')).toBe('4600000000');
    expect(phoneLast10('12345')).toBe('12345');
    expect(phoneLast10('abc')).toBe('');
  });
});

describe('phoneCountry / phoneType / isMobilePhone', () => {
  it('ülkeyi doğru tespit eder', () => {
    expect(phoneCountry('+905551112233')).toBe('TR');
    expect(phoneCountry('0555 111 22 33')).toBe('TR'); // ülke kodsuz → TR varsayılanı
    expect(phoneCountry('+34 600 000 000')).toBe('ES');
    expect(phoneCountry('+31 6 12345678')).toBe('NL');
  });

  it('geçersizde null döner — çağıran elle kurallara düşebilsin', () => {
    expect(phoneCountry('+906551112233')).toBeNull();
    expect(phoneCountry('12345')).toBeNull();
    expect(phoneCountry(null)).toBeNull();
  });

  it('cep ile sabit hattı ayırır (WhatsApp kapısı için)', () => {
    expect(phoneType('+905551112233')).toBe('MOBILE');
    expect(phoneType('0212 345 67 89')).toBe('FIXED_LINE');
    expect(isMobilePhone('+905551112233')).toBe(true);
    expect(isMobilePhone('0212 345 67 89')).toBe(false);
    expect(isMobilePhone(null)).toBe(false);
  });
});

describe('localeForPhone — isim büyütme locale\'i', () => {
  /**
   * NEDEN: Türkçe locale'de I→ı düştüğü için yabancı isimler bozuluyordu
   * ("IVAN PRIMEROV" → "Ivan Prımerov"). hastalar_db'de bu yüzden
   * "Ivan Prımerov", "Irına Exemplu" gibi (sentetik örnek) kirli kayıtlar oluştu.
   */
  it('TR numarası → tr-TR', () => {
    expect(localeForPhone('+905551112233')).toBe('tr-TR');
    expect(localeForPhone('0555 111 22 33')).toBe('tr-TR');
    expect(localeForPhone('905321234567')).toBe('tr-TR');
  });

  it('yabancı numara → en-US', () => {
    expect(localeForPhone('+34 600 000 000')).toBe('en-US');
    expect(localeForPhone('+31 6 12345678')).toBe('en-US');
    expect(localeForPhone('+493012345')).toBe('en-US');
  });

  it('kütüphane tanımayınca elle kurallara düşer', () => {
    // "+906551112233" geçersiz ama 90… önekiyle TR sayılmalı.
    // '905' (cep) şartı koşulunca bu kayıt yanlışlıkla yabancı sayılıyordu.
    expect(localeForPhone('+906551112233')).toBe('tr-TR');
    // 16 haneli bozuk kayıt: TR kalıbına uymaz → yabancı
    expect(localeForPhone('+9055511122332025')).toBe('en-US');
  });

  it('telefon olmayan girdide karar vermez (null)', () => {
    expect(localeForPhone('12345')).toBeNull();
    expect(localeForPhone('abc')).toBeNull();
    expect(localeForPhone('')).toBeNull();
    expect(localeForPhone(null)).toBeNull();
  });
});
