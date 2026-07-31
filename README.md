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

## ✅ Yazan/okuyan ayrışması — ÇÖZÜLDÜ (2026-07-31)

v1.2.0 kısa süreliğine bir asimetri doğurmuştu: `m:` anahtarını **YAZAN** taraf
paketi (transliterate eden) kullanırken, **OKUYAN** üç yol `calendar-api` içindeki
eski yerel kopyalarında kalmıştı.

Kritik nokta: yazan taraf anahtarı **klasör adından** üretiyor ve klasör adları
`cleanDisplayName`'den GEÇMEZ — yani "0 etkilenen" ölçümünün kapsamadığı giriş
yolu tam olarak burasıydı:

```
"Đorđe Nikolić" klasörü →  yazan: m:dorde nikolic  |  okuyan: m:or e nikolic
```

**Düzeltildi:** dört yol da artık `import { normalizeMobil } from '@rino/shared'`
kullanıyor. `normalizeMobil` ekosistemde **tek tanım** (önce 4'tü).

| Rol | Dosya | Durum |
|---|---|---|
| YAZAN | `scripts/generate_patient_thumbs.mjs` | ✅ paketten |
| okuyan | `src/lib/patientFolder.ts` | ✅ paketten |
| okuyan | `scripts/finder-helper.mjs` | ✅ paketten |
| okuyan | `scripts/kontrol_notlari_finder.mjs` | ✅ paketten |

`finder-helper.mjs` bir launchd daemon'ı; paket çözümlemesi launchd bağlamında
(cwd=`/`, mutlak yol, `/usr/local/bin/node`) çalıştırılarak doğrulandı.

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

`npm run guard` (~0.2 sn) kardeş projeleri tarayıp izlenen fonksiyonların yerel
kopya sayısını `scripts/duplicate-baseline.json` ile karşılaştırır. **Sayı
artarsa hata verir.** Mevcut kopyaları silmeye zorlamaz — kanamayı durdurur.

İki kategori var ve tavsiyeleri farklıdır:

| | Fonksiyonlar | Yeni kopya çıkarsa |
|---|---|---|
| **SAHİPLENİLEN** | `calculateControlLabel` `normalizeMobil` `daysBetweenDates` `transliterate` | paketten import et |
| **İZLENEN** | `normalizeName` `phoneLast10` `normalizePhone` `titleCase` `cleanDisplayName` `categorizeEvent` | pakette değil; mevcut bir tanımı kullan ya da kanonik bir yer seç |

İzlenenler ekosistemde zaten çok kopyalı (analiz: `normalizeName` 19,
`phoneLast10` 10, …) ve bir kısmı **kasıtlı ürün farkı** (`categorizeEvent`) —
o yüzden "paketten import et" onlar için doğru tavsiye değil.

Yakaladığı tanım biçimleri: `function f(`, `const f =`, nesne-metodu kısayolu
`f(a) {`, sınıf metodu, `f: function(…)`, `f: (a) => …`.

**Commit anında çalışır.** `scripts/install-hooks.sh` her kardeş repoya bir
`pre-commit` hook'u kurar. Hook, kopya BAŞKA bir repodaysa commit'i engellemez —
yalnız uyarır. Bypass: `git commit --no-verify`.

> `core.hooksPath` bilinçli olarak KULLANILMIYOR: `calendar-api` ve `takvim`'de
> Vercel deploy izleyicisi `pre-push` hook'ları var ve `core.hooksPath` onları
> sessizce devre dışı bırakırdı. Hook doğrudan `.git/hooks/`'a kopyalanır —
> yani sürümlenmez; repo yeniden klonlanırsa script tekrar çalıştırılmalı.

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
