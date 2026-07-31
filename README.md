# @rino/shared

Klinik ekosistemindeki projeler arasında paylaşılan **saf fonksiyonlar**.
Tüketiciler: `calendar-api`, `clinic-sync`, `takvim`, `mobil-panel`.

> ⚠️ **Bu repo PUBLIC.** Sır, gerçek hasta verisi ya da gerçek telefon numarası
> — JSDoc örneklerinde bile — ASLA girmemeli. Public olmasının tek sebebi
> tüketicilerin `github:` ile token'sız kurabilmesi.

---

## Yüzey — 3 fonksiyon

| Fonksiyon | Dosya | Import eden |
|---|---|---|
| `calculateControlLabel` | `controlDuration.ts` | calendar-api, takvim, clinic-sync ×3, mobil-panel |
| `daysBetweenDates` | `controlDuration.ts` | mobil-panel |
| `normalizeMobil` | `names.ts` | calendar-api (vesikalık), clinic-sync (notlar), mobil-panel |

### Neden bu kadar küçük?

2026-07-31'de ölçüldü: paket **22 export** sunuyordu ama tüketiciler yalnızca
bu 3'ünü import ediyordu. Kalan 19'u 2026-07-13'ten beri donmuştu — bu arada
calendar-api aynı fonksiyon ailesinde en az üç düzeltme yaptı (yaş kuralı
`978a0f6`, `[işlem]` etiketi `2a54f7a`, Kiril `c4e2877`) ve **hiçbiri buraya
geri akmadı.**

Ölü + bayat bir "kanonik kaynak", kopya koddan daha tehlikelidir: doğru sanılır.
Bir geliştirici (ya da AI ajanı) `normalizeName`'i buradan import etseydi,
calendar-api'nin aylar önce düzelttiği hataları geri getirmiş olurdu.

O yüzden silindiler. Kod git geçmişinde duruyor; gerektiğinde geri getirilebilir —
ama geri getirilirken **güncel** haliyle getirilmeli.

---

## Ne buraya girer, ne girmez

**Girer** — ürün yorumundan bağımsız, saf girdi→çıktı:
tarih hesabı, anahtar normalizasyonu, biçimlendirme.

**Girmez** — ürüne özgü yorum. Örnek: `categorizeEvent`.
`takvim` (müsaitlik sunar) ile `calendar-api` (klinik kayıt) aynı etkinliği
**kasıtlı olarak** farklı sınıflandırıyor — takvim'de lavanta renk `blocked`,
calendar-api'de değil. Bu bir bug değil, iki farklı ürün kararı. Böyle şeyleri
buraya taşımak sahte bir birlik kurar ve birinin ekranını sessizce bozar.

---

## 🔴 Bilinen Sorunlar

### `normalizeMobil` ASCII-dışı harfleri bozuyor

`NFD` yalnız **birleşen** aksanları ayrıştırır (`ö→o+¨`, `ñ→n+~`). Kendi kod
noktası olan harfler ve Latin-dışı alfabeler ayrışmaz → `[^a-z0-9\s]` kuralı
onları boşluğa çevirir:

| Girdi | Çıktı | |
|---|---|---|
| `Björn Håkansson` | `bjorn hakansson` | ✅ |
| `François Lévêque` | `francois leveque` | ✅ |
| `Sørén Ångström` | `s ren angstrom` | ❌ kelime bölündü |
| `Đorđe Nikolić` | `or e nikolic` | ❌ (Sırp) |
| `Łukasz Wałęsa` | `ukasz wa esa` | ❌ (Polonyalı) |
| `Weiß Müller` | `wei muller` | ❌ (Alman) |
| `Алекс Петков` | `` (boş) | ❌ (Bulgar) — **tüm Kiril isimler aynı anahtara çakışıyor** |

Bu çıktı bir Redis ANAHTARIDIR (`patient_thumbs` ve `drpanel:muayene_notu`
içindeki `m:` önekli alanlar).

### 📊 Ölçülen etki: 2026-07-31 itibarıyla **0 hasta**

```
1616 hasta kaydı · 0 harf kaybı · 0 boş anahtar · 0 çakışma
patient_thumbs 200 alan · drpanel:muayene_notu 1482 alan · boş anahtar: 0
```

**Neden sıfır?** `calendar-api`'nin `cleanDisplayName`'i isimleri `hastalar_db`'ye
yazmadan ÖNCE `transliterateCyrillic` ile Latin'e çeviriyor (`c4e2877`, `666835e`).
`normalizeMobil`'e ulaşan isim zaten temizlenmiş oluyor. Yani hata **gerçek ama
yukarı akışta maskeli** — saklanan hiçbir anahtar bozuk değil.

**Sonuç: düzeltme migrasyon GEREKTİRMEZ.** Hiçbir mevcut anahtar değişmez,
çünkü saklanan isimlerin hiçbirinde bu karakterler yok.

**Kalan gerçek risk** — temizlikten geçmeyen girdi yolları:
- `mobil-panel/app/(panel)/ara/page.tsx` — kullanıcı arama kutusuna ham metin
  yazıyor. "Алекс" aratan biri, "Aleks Petkov" olarak kayıtlı hastayı bulamaz.
  Düzeltme bunu iyileştirir.
- İleride `cleanDisplayName`'den geçmeyen yeni bir yazma yolu eklenirse hata
  aktif hale gelir.

Ölçümü tekrarla (salt-okunur, `GET`/`HKEYS` dışında komut çalıştırmaz):

```bash
node ~/Projects/calendar-api/scripts/audit_mobil_keys.mjs
```

### `normalizeMobil`'in 3 yerel kopyası var

`calendar-api` içinde aynı fonksiyonun üç kopyası daha duruyor ve **üçü de aynı
hataya sahip**:

- `scripts/finder-helper.mjs:69` (launchd daemon)
- `scripts/kontrol_notlari_finder.mjs:92`
- `src/lib/patientFolder.ts:31`

Düzeltme yapılırsa dördü birden düzeltilmeli — yoksa yazan ile okuyan farklı
anahtar üretir. `npm run guard` sayının artmasını engeller ama mevcut 3'ü silmez.

---

## Geliştirme

```bash
npm test          # karakterizasyon testleri (57)
npm run guard     # mükerrer tanım sayısı artmasın
npm run build     # dist/ üret
```

### Testler neden "karakterizasyon"?

Doğru davranışı değil, **mevcut** davranışı sabitliyorlar. Amaç 4 canlı projede
sessiz kayma olmasını engellemek. Bir test kırılırsa önce sor: değişiklik
kasıtlı mı? Kasıtlıysa testi güncelle **ve** tüketicileri yeni etikete taşı.

### Bekçi

`npm run guard` kardeş projeleri tarayıp bu paketin sahiplendiği fonksiyonların
yerel kopya sayısını `scripts/duplicate-baseline.json` ile karşılaştırır.
**Sayı artarsa hata verir.** Mevcut kopyaları silmeye zorlamaz — sadece
kanamayı durdurur. Kopya azalırsa taban çizgisini kilitlemeni söyler.

---

## Yayınlama

```bash
./scripts/release.sh minor              # test + guard + build + sürüm + etiket
git push origin main --follow-tags
./scripts/bump-consumers.sh v1.2.0      # tüketicileri taşı
```

### Neden etiket, neden `#main` değil?

2026-07-31'de ölçüldü: 4 proje de `#main` kullanıyordu ve dördü de package.json'da
`1.0.0` görüyordu — ama `takvim`'in kurulu kopyası 13 Temmuz'dan, diğer üçü
18 Temmuz'dandı. md5'ler farklı, takvim'inkinde `normalizeMobil` **hiç yoktu**,
ve hiçbir araç bunu göstermiyordu. **Aynı etiket, farklı kod.**

Etikete sabitlemek bunu görünür kılar: `npm ls @rino/shared` gerçek sürümü söyler,
yükseltme bilinçli ve geri alınabilir olur.

### `dist/` neden git'te?

Tüketiciler `github:` ile kuruyor. `prepare: tsc` normalde `dist/`i üretir, ama
herhangi bir sebeple çalışmazsa paket kullanılamaz hale gelir. Commit'li `dist/`
bu riski kapatır. Bayat kalmaması `release.sh`'ın sorumluluğunda — o her yayında
yeniden derleyip commit'e ekler.
