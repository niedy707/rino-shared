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
import { normalizeMobil } from '../src/names.js';

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

describe('normalizeMobil — 🔴 BOZUK: NFD ile ayrışmayan harfler', () => {
  /**
   * 🔴 BİLİNEN HATA (2026-07-31 tespit edildi)
   *
   * NFD yalnız BİRLEŞEN aksanları ayrıştırır. Kendi başına ayrı bir kod noktası
   * olan harfler (ø, ł, ß, æ, þ, đ) ve Latin-dışı alfabeler (Kiril) ayrışmaz →
   * `[^a-z0-9\s]` kuralı bunları BOŞLUĞA çevirir.
   *
   * SONUÇ: kelime ikiye bölünür ("Sørén" → "s ren") ya da isim tamamen kaybolur
   * ("Алекс Петков" → ""). Bu çıktı `m:` Redis ANAHTARI olduğu için:
   *   - Kiril isimli TÜM hastalar aynı boş anahtara çakışır (biri diğerinin
   *     vesikalığını/notunu ezer)
   *   - Sırp/Polonyalı/İskandinav hastalar yanlış anahtar altında saklanır
   *
   * Klinik profili gereği bu alfabeler gerçek: Bulgar, Sırp, Polonyalı hastalar.
   *
   * calendar-api Kiril sorununu classification.ts'te `transliterateCyrillic` ile
   * çözdü (commit c4e2877, 666835e) ama normalizeMobil'e uygulanmadı.
   *
   * 📊 ÖLÇÜLEN ETKİ (2026-07-31): 1616 hastanın 0'ı etkileniyor.
   * Sebep: calendar-api'nin cleanDisplayName'i isimleri hastalar_db'ye yazmadan
   * ÖNCE Latin'e çeviriyor → normalizeMobil'e ulaşan isim zaten temiz. Hata
   * gerçek ama yukarı akışta MASKELİ.
   *
   * ⇒ Düzeltme MİGRASYON GEREKTİRMEZ (hiçbir mevcut anahtar değişmez).
   *   Kalan risk: temizlikten geçmeyen girdi (mobil-panel arama kutusu).
   *
   * Bu testler MEVCUT (hatalı) davranışı sabitliyor. Düzeltme yapıldığında bu
   * bloktaki beklentiler yeni doğru değerlerle güncellenmeli.
   * Ölçümü tekrarla: node ~/Projects/calendar-api/scripts/audit_mobil_keys.mjs
   */
  it('MEVCUT (HATALI): Kiril isim tamamen kayboluyor', () => {
    expect(normalizeMobil('Алекс Петков')).toBe('');
    expect(normalizeMobil('Георги Христов')).toBe('');
  });

  it('MEVCUT (HATALI): farklı Kiril isimler AYNI anahtara çakışıyor', () => {
    expect(normalizeMobil('Алекс Петков')).toBe(normalizeMobil('Георги Христов'));
  });

  it('MEVCUT (HATALI): Sırpça đ silinip kelime bölünüyor', () => {
    expect(normalizeMobil('Đorđe Nikolić')).toBe('or e nikolic');
  });

  it('MEVCUT (HATALI): Lehçe ł silinip kelime bölünüyor', () => {
    expect(normalizeMobil('Łukasz Wałęsa')).toBe('ukasz wa esa');
  });

  it('MEVCUT (HATALI): İskandinav ø silinip kelime bölünüyor', () => {
    expect(normalizeMobil('Sørén Ångström')).toBe('s ren angstrom');
  });

  it('MEVCUT (HATALI): Alman ß siliniyor', () => {
    expect(normalizeMobil('Weiß Müller')).toBe('wei muller');
  });

  it('MEVCUT (HATALI): Vietnamca Đ siliniyor', () => {
    expect(normalizeMobil('Nguyễn Đức')).toBe('nguyen uc');
  });

  it('karışık Kiril+Latin: yalnız Latin kısım kalır', () => {
    expect(normalizeMobil('Алекс Petkov')).toBe('petkov');
  });
});
