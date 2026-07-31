/**
 * KARAKTERİZASYON TESTLERİ — normalizeMobil
 *
 * normalizeMobil, Redis'te `m:` önekli anahtarları üretir:
 *   - `patient_thumbs`        (vesikalık)      → calendar-api/scripts/generate_patient_thumbs.mjs
 *   - `drpanel:muayene_notu`  (muayene notu)   → clinic-sync/.../finder_notes_sync.mjs
 *   - okuma tarafı                             → mobil-panel/lib/names.ts
 *
 * ⚠️ BU FONKSİYONUN ÇIKTISI BİR VERİTABANI ANAHTARIDIR.
 * Davranışı değiştirmek = mevcut anahtarları öksüz bırakmak. Herhangi bir
 * değişiklik ÖNCE burada testleştirilmeli, SONRA anahtar migrasyonu planlanmalı.
 */
import { describe, it, expect } from 'vitest';
import { normalizeMobil, transliterate } from '../src/names.js';

describe('normalizeMobil — Türkçe karakterler', () => {
  it('JSDoc örneği: İrem Öz-Çelik', () => {
    expect(normalizeMobil('İrem Öz-Çelik')).toBe('irem oz celik');
  });

  it('büyük İ ve I ayrı ayrı ele alınır', () => {
    expect(normalizeMobil('Iğdır İstanbul')).toBe('igdir istanbul');
  });

  it('tüm Türkçe harfler ASCII karşılığına iner', () => {
    expect(normalizeMobil('Ünal Işık')).toBe('unal isik');
    expect(normalizeMobil('ÇĞÖŞÜ')).toBe('cgosu');
  });
});

describe('normalizeMobil — aksanlı Latin isimler (ÇALIŞAN durum)', () => {
  /**
   * NFD, BİRLEŞEN aksanları (combining diacritics) ayrıştırabildiği için bu
   * isimler doğru normalize oluyor: ö → o+¨, å → a+°, ñ → n+~, ê → e+^
   */
  it('aksan soyulur ama TABAN HARF KORUNUR (normalizeForMatch\'ten farkı)', () => {
    expect(normalizeMobil('José García')).toBe('jose garcia');
  });

  it('İskandinav birleşen aksanları', () => {
    expect(normalizeMobil('Björn Håkansson')).toBe('bjorn hakansson');
  });

  it('İspanyolca ñ ve Fransızca ê', () => {
    expect(normalizeMobil('Ana Muñoz')).toBe('ana munoz');
    expect(normalizeMobil('François Lévêque')).toBe('francois leveque');
  });
});

describe('normalizeMobil — biçim temizliği', () => {
  it('harf-dışı karakterler BOŞLUĞA çevrilir (silinmez)', () => {
    expect(normalizeMobil('İrem Öz-Çelik')).toBe('irem oz celik'); // tire → boşluk
  });

  it('kesme işareti boşluğa çevrilip daraltılır', () => {
    expect(normalizeMobil("O`Brien")).toBe('obrien');
  });

  it('ardışık boşluklar tek boşluğa iner, baş/son kırpılır', () => {
    expect(normalizeMobil('  çift   boşluk  ')).toBe('cift bosluk');
  });

  it('tek harfli kelimeler KORUNUR (göbek adı baş harfi kaybolmaz)', () => {
    expect(normalizeMobil('Ayşe M Kaya')).toBe('ayse m kaya');
  });

  it('rakamlar korunur', () => {
    expect(normalizeMobil('tel 0533 378 48 07')).toBe('tel 0533 378 48 07');
  });

  it('boş / null / undefined → boş string (patlamaz)', () => {
    expect(normalizeMobil('')).toBe('');
    expect(normalizeMobil(null as unknown as string)).toBe('');
    expect(normalizeMobil(undefined as unknown as string)).toBe('');
  });

  it('ALL-CAPS girdi küçük harfe iner', () => {
    expect(normalizeMobil('GABRIELA ISABEL')).toBe('gabriela isabel');
  });
});

describe('normalizeMobil — NFD ile ayrışmayan harfler (v1.2.0 düzeltmesi)', () => {
  /**
   * v1.1.0'a kadar BOZUKTU: NFD yalnız BİRLEŞEN aksanları ayrıştırır. Kendi kod
   * noktası olan harfler (ø ł ß æ þ đ) ve Latin-dışı alfabeler (Kiril) ayrışmaz →
   * `[^a-z0-9\s]` kuralı onları BOŞLUĞA çeviriyordu:
   *
   *   "Алекс Петков"  → ""               (TÜM Kiril isimler aynı anahtara çakışırdı)
   *   "Đorđe Nikolić" → "or e nikolic"
   *   "Sørén …"       → "s ren …"
   *
   * v1.2.0: normalizeMobil önce transliterate() çağırıyor.
   *
   * MEVCUT VERİYE ETKİSİ = SIFIR (ölçüldü, 2026-07-31): 1616 hasta adı +
   * 1482 not anahtarı + 200 vesikalık anahtarının hiçbiri değişmedi. Saklanan
   * isimlerde bu karakterler yok, çünkü calendar-api'nin cleanDisplayName'i
   * zaten Latin'e çeviriyordu. Kazanç OKUMA tarafında: mobil-panel arama
   * kutusuna "Алекс" yazan biri artık "Aleks Petkov"u buluyor.
   *
   * Ölçümü tekrarla: node ~/Projects/calendar-api/scripts/audit_mobil_keys.mjs
   */
  it('Kiril isim Latin karşılığına çevriliyor', () => {
    expect(normalizeMobil('Алекс Петков')).toBe('aleks petkov');
    expect(normalizeMobil('Георги Христов')).toBe('georgi hristov');
  });

  it('farklı Kiril isimler artık FARKLI anahtar üretiyor (çakışma bitti)', () => {
    expect(normalizeMobil('Алекс Петков')).not.toBe(normalizeMobil('Георги Христов'));
  });

  it('Sırpça đ korunuyor', () => {
    expect(normalizeMobil('Đorđe Nikolić')).toBe('dorde nikolic');
  });

  it('Lehçe ł korunuyor', () => {
    expect(normalizeMobil('Łukasz Wałęsa')).toBe('lukasz walesa');
  });

  it('İskandinav ø ve å korunuyor', () => {
    expect(normalizeMobil('Sørén Ångström')).toBe('soren angstrom');
  });

  it('Alman ß → ss', () => {
    expect(normalizeMobil('Weiß Müller')).toBe('weiss muller');
  });

  it('İzlandaca æ ve þ', () => {
    expect(normalizeMobil('Ægir Þórsson')).toBe('aegir thorsson');
  });

  it('Vietnamca Đ korunuyor', () => {
    expect(normalizeMobil('Nguyễn Đức')).toBe('nguyen duc');
  });

  it('REGRESYON KORUMASI: transliterate, Türkçe/Latin isimlere DOKUNMUYOR', () => {
    // Bu isimler v1.1.0'da da doğruydu — düzeltme onları değiştirmemeli.
    // Mevcut Redis anahtarlarının sabit kalmasının garantisi budur.
    expect(normalizeMobil('İrem Öz-Çelik')).toBe('irem oz celik');
    expect(normalizeMobil('José García')).toBe('jose garcia');
    expect(normalizeMobil('Björn Håkansson')).toBe('bjorn hakansson');
    expect(normalizeMobil('Ana Muñoz')).toBe('ana munoz');
    expect(normalizeMobil('François Lévêque')).toBe('francois leveque');
    expect(normalizeMobil('Ayşe M Kaya')).toBe('ayse m kaya');
    expect(normalizeMobil('Iğdır İstanbul')).toBe('igdir istanbul');
    expect(normalizeMobil('GABRIELA ISABEL')).toBe('gabriela isabel');
  });

  it('transliterate: gerekmedikçe girdiyi aynen döndürür', () => {
    expect(transliterate('Ayşe Kaya')).toBe('Ayşe Kaya');
    expect(transliterate('Алекс Петков')).toBe('Aleks Petkov');
    expect(transliterate('')).toBe('');
  });

  it('karışık Kiril+Latin: her iki kısım da korunuyor', () => {
    expect(normalizeMobil('Алекс Petkov')).toBe('aleks petkov');
  });
});
