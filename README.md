# @rino/shared

Klinik ekosistemindeki projeler arasında paylaşılan **saf fonksiyonlar**.
Tüketiciler: `calendar-api`, `clinic-sync`, `takvim`, `mobil-panel`.

> ⚠️ **Bu repo PUBLIC.** Sır, gerçek hasta verisi ya da gerçek telefon numarası
> — JSDoc örneklerinde bile — ASLA girmemeli. Public olmasının tek sebebi
> tüketicilerin `github:` ile token'sız kurabilmesi.

---

## Yüzey — 4 export

| Fonksiyon | Dosya | Import eden |
|---|---|---|
| `calculateControlLabel` | `controlDuration.ts` | calendar-api, takvim, clinic-sync ×3, mobil-panel |
| `daysBetweenDates` | `controlDuration.ts` | mobil-panel |
| `normalizeMobil` | `names.ts` | calendar-api (vesikalık), clinic-sync (notlar), mobil-panel |
| `transliterate` | `names.ts` | (v1.2.0'da eklendi — `normalizeMobil` içinde kullanılıyor, dışarıdan henüz import edilmiyor) |

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

## ✅ v1.2.0 — ASCII-dışı harf düzeltmesi

`normalizeMobil` artık önce `transliterate()` çağırıyor.

`NFD` yalnız **birleşen** aksanları ayrıştırır (`ö→o+¨`, `ñ→n+~`). Kendi kod
noktası olan harfler (`ø ł ß æ þ đ`) ve Latin-dışı alfabeler (Kiril) ayrışmadığı
için `[^a-z0-9\s]` kuralına takılıp **siliniyorlardı**:

| Girdi | v1.1.0 | v1.2.0 |
|---|---|---|
| `Björn Håkansson` | `bjorn hakansson` ✅ | `bjorn hakansson` (değişmedi) |
| `François Lévêque` | `francois leveque` ✅ | `francois leveque` (değişmedi) |
| `Sørén Ångström` | `s ren angstrom` ❌ | **`soren angstrom`** |
| `Đorđe Nikolić` | `or e nikolic` ❌ | **`dorde nikolic`** |
| `Łukasz Wałęsa` | `ukasz wa esa` ❌ | **`lukasz walesa`** |
| `Weiß Müller` | `wei muller` ❌ | **`weiss muller`** |
| `Алекс Петков` | `` (boş) ❌ | **`aleks petkov`** |

### Neden migrasyon gerekmedi

Bu çıktı bir Redis ANAHTARIDIR — ama değişiklik öncesi **gerçek verinin tamamı**
üzerinde eski ve yeni fonksiyon karşılaştırıldı:

Yayın öncesi tek seferlik kapı (2026-07-31, v1.1.0 ↔ v1.2.0 karşılaştırması):

```
1616 hasta adı karşılaştırıldı · anahtarı DEĞİŞEN: 0
patient_thumbs 200 anahtar · öksüz kalacak: 0
drpanel:muayene_notu 1482 anahtar · öksüz kalacak: 0
```

> Anahtar sayıları oynaktır (mükerrer temizliği sonrası `patient_thumbs` aynı gün
> 98'e düştü). Önemli olan sayılar değil, **anahtarı değişen: 0** sonucudur.

Saklanan isimlerin hiçbirinde bu karakterler yok, çünkü `calendar-api`'nin
`cleanDisplayName`'i isimleri `hastalar_db`'ye yazmadan ÖNCE Latin'e çeviriyor
(`c4e2877`, `666835e`). Hata gerçekti ama **yukarı akışta maskeliydi**.

### Kazanç: okuma tarafı

`mobil-panel/app/(panel)/ara/page.tsx` arama kutusuna **ham kullanıcı girdisi**
yazılıyor ve `normalizeMobil`'den geçiyor. Artık "Алекс" aratan biri,
`Aleks Petkov` olarak kayıtlı hastayı buluyor.

## 🔴 AÇIK RİSK — yazan/okuyan ayrışması (v1.2.0 ile DOĞDU)

`normalizeMobil`'in `calendar-api` içinde **3 yerel kopyası** var ve üçü de hâlâ
v1.1.0 davranışında (transliterasyon YOK):

| Rol | Dosya | Sürüm |
|---|---|---|
| **YAZAN** | `scripts/generate_patient_thumbs.mjs:46` | ✅ paketten (v1.2.0) |
| okuyan | `src/lib/patientFolder.ts:31` | ❌ yerel, eski |
| okuyan | `scripts/finder-helper.mjs:69` | ❌ yerel, eski |
| okuyan | `scripts/kontrol_notlari_finder.mjs:92` | ❌ yerel, eski |

**Kritik nokta:** yazan taraf `m:` anahtarını **klasör adından** üretiyor ve klasör
adları `cleanDisplayName`'den GEÇMEZ. Yani yukarıdaki "0 etkilenen" ölçümünün
kapsamadığı giriş yolu tam olarak burasıdır:

```
"Đorđe Nikolić" klasörü →  yazan: m:dorde nikolic  |  okuyan: m:or e nikolic
"Алекс Петков"  klasörü →  yazan: m:aleks petkov   |  okuyan: m:
```

v1.2.0 öncesi dördü de aynı şekilde bozuktu, yani **uyumluydular**. Şimdi biri
düzeldi, üçü düzelmedi.

**Şu an latent:** 3573 hasta klasörü tarandı, hiçbirinde bu karakter sınıfı yok.
İlk yabancı isimli klasör açıldığı gün kırılır.

**Yapılması gereken:** üç kopya da `import { normalizeMobil } from '@rino/shared'`
ile değiştirilmeli. Bekçi bunu YAKALAMAZ (sayı azalır, artmaz).

### Kiril haritası iki yerde

Buradaki `transliterate()` ile `calendar-api/src/lib/classification.ts`
içindeki `transliterateCyrillic` **birebir aynı Kiril haritasını** kullanır.
Ayrışırlarsa yazan ile okuyan farklı anahtar üretir. Uzun vadede calendar-api
buradakini benimsemeli.

### Ölçüm script'i ne yapar, ne yapmaz

```bash
node ~/Projects/calendar-api/scripts/audit_mobil_keys.mjs
```

Bu script **kurulu** fonksiyonu import eder ve "mevcut fonksiyon saklanan
isimlerden herhangi birini bozuyor mu?" sorusunu cevaplar. v1.2.0'dan sonra
doğal olarak hep 0 döner.

**Yukarıdaki eski↔yeni karşılaştırmasını TEKRARLAMAZ** — o, yayın öncesi tek
seferlik bir kapıydı ve iki fonksiyon sürümünü yan yana koşturmayı gerektirir.

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
npm test          # karakterizasyon testleri (60)
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
