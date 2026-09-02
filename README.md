# @rino/shared

Klinik ekosistemindeki projeler arasında paylaşılan **saf fonksiyonlar**.
Tüketiciler: `calendar-api`, `clinic-sync`, `takvim`, `mobil-panel`.

> ⚠️ **Bu repo PUBLIC.** Sır, gerçek hasta verisi ya da gerçek telefon numarası
> — JSDoc örneklerinde bile — ASLA girmemeli. Public olmasının tek sebebi
> tüketicilerin `github:` ile token'sız kurabilmesi.

---

## Yüzey — 10 export

| Fonksiyon | Dosya | Not |
|---|---|---|
| `calculateControlLabel` | `controlDuration.ts` | calendar-api, takvim, clinic-sync ×3, mobil-panel |
| `daysBetweenDates` | `controlDuration.ts` | mobil-panel |
| `normalizeMobil` | `names.ts` | vesikalık/not `m:` anahtarı — calendar-api, clinic-sync, mobil-panel |
| `transliterate` | `names.ts` | Kiril + `ø ł ß æ þ đ` → ASCII |
| `toE164` | `phones.ts` | **kanonik depolama biçimi** |
| `phoneLast10` | `phones.ts` | mükerrer anahtarı — sözleşme: geçersizde `''` |
| `phoneCountry` | `phones.ts` | ISO ülke kodu |
| `phoneType` | `phones.ts` | `MOBILE` / `FIXED_LINE` … |
| `isMobilePhone` | `phones.ts` | WhatsApp kapısı |
| `localeForPhone` | `phones.ts` | isim büyütme locale'i |

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

## 🔜 v1.3.1 — taslak (yayınlanmadı)

- `calculateControlLabel` geçersiz/boş tarihte `"?"` döner (`"NaNm"` bitti);
  `GG.AA.YYYY` biçimi açıkça gün.ay.yıl okunur (V8 ay.gün sayıyordu → 7 gün "7m" çıkıyordu).
  ISO girdilerde çıktı değişmedi.
- `phoneLast10` Arap-Hint / Doğu Arap / tam-genişlik rakamları `toE164` ile aynı
  şekilde ASCII'ye çevirir. ASCII girdide çıktı değişmedi.
- Test/JSDoc'taki gerçek numara ve adlar sentetikle değiştirildi; `package.json`
  `files` alanı (`test/`, `scripts/`, `src/` tüketiciye gitmez).
- Yeni: `scripts/pii-bekcisi.mjs`, `scripts/surum-bekcisi.mjs`; hook PII taraması yapar;
  bekçi `web-panel` ve `insta-takip`i de tarar.

### Bilinen sınır (açık, bilinçli)

`normalizeMobil` Yunanca / Arapça / CJK / tam-genişlik isimleri **boş anahtara**
çevirir (hepsi çakışır); `Ĳ`, `ﬁ` ligatürleri düşer. Düzeltmesi (`NFKC` + yeni
alfabe haritaları) anahtar migrasyonu gerektirir — önce
`calendar-api/scripts/audit_mobil_keys.mjs` ile etki ölçülmeli. Mevcut davranış
`test/names.test.ts` "BİLİNEN SINIR" bloğunda sabitlendi.

## ✅ v1.3.0 — telefon ailesi taşındı

2026-08-01 ölçümü: ekosistemde `phoneLast10`'un **19**, `normalizePhone`
ailesinin **20+ çağrı noktasında 12 farklı davranışı** vardı.

**Kök sebep tembellik değil, yapısal erişimsizlikti.** Kanonik sayılan
fonksiyonlar `clinic-sync/src/lib/shared.mjs` içindeydi; o dosya başlığında
kendini *"@rino/shared — Ortak Yardımcı Modüller"* ilan etmesine rağmen **yerel
bir dosyaydı**. `calendar-api`, `mobil-panel` ve `takvim` paketi kursalar da o
fonksiyonlara **fiziksel olarak ulaşamıyordu** — kopya üretmekten başka
seçenekleri yoktu.

`toE164`, `phoneCountry`, `phoneType`, `isMobilePhone`, `localeForPhone` ve
`phoneLast10` buraya **taşındı** (kopyalanmadı). `libphonenumber-js/max`
bağımlılık olarak eklendi.

**Eşdeğerlik kanıtı** — taşıma öncesi gerçek verinin tamamında karşılaştırıldı:

```
3834 değer (hastalar_db 1422 · muayene_db 496 · contacts_db 1916)
6 fonksiyon × 3834 değer → FARK: 0
```

Ölçüm raporu: `~/Projects/TELEFON_NORMALIZASYON_OLCUMU_2026-08-01.md`

> `normalizePhone` **taşınmadı** — `?` önekli "şüpheli kabul" sözleşmesi
> (`"0212…"` → `"?2123456789"`) yalnız clinic-sync'e özgü ve başka hiçbir
> kopyada yok. Kanonik yapmak o tuhaflığı ekosisteme yaymak olurdu. Depolama
> için `toE164` kullanın.

---

## ✅ v1.2.1 — CJS tüketicileri onarıldı

`exports` haritasında yalnız `import` + `types` koşulu vardı, `require`/`default`
yoktu. `calendar-api`'de `"type": "module"` olmadığı için `ts-node`'un CommonJS
çıktısı paketi çözemiyordu:

```
Error: No "exports" main defined in .../@rino/shared/package.json
```

Bu, `npm run data-sync` ve `npm run archive`'ı **kırıyordu** — ve paketin ilk
commit'inden (`68b5c31`, 2026-07-13) beri böyleydi, kimse denememişti.

Düzeltme: `"default": "./dist/main.js"`. Node 24 senkron ESM'i `require()`
edebildiği için ayrı bir CJS build gerekmedi. ESM tarafı etkilenmedi.

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

### Kiril haritası beş yerde

Buradaki `transliterate()` dışında `transliterateCyrillic` adıyla **4 kopya** var:

- `calendar-api/src/lib/classification.ts`
- `clinic-sync/src/services/perop-media/lib/patients.ts`
- `clinic-sync/src/services/hastanede/lib/patients.ts`
- `mobil-panel/lib/names.ts`

Beşi de **birebir aynı Kiril haritasını** kullanmalı — ayrışırlarsa yazan ile
okuyan farklı `m:` anahtarı üretir. (2026-07-31 ölçümü: U+0400–U+052F aralığında
304 kod noktası için fark **0**.) Bekçinin İZLENEN listesinde. Uzun vadede
hepsi buradaki `transliterate()`'i benimsemeli.

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
npm test          # karakterizasyon testleri
npm run guard     # mükerrer tanım sayısı artmasın
npm run build     # dist/ üret
node scripts/pii-bekcisi.mjs --repo . --repo ../calendar-api   # gerçek telefon/TC/ad taraması
node scripts/surum-bekcisi.mjs                                  # tüketiciler son etikette mi?
```

### PII bekçisi

`scripts/pii-bekcisi.mjs` iki modda çalışır: `--staged` (pre-commit hook — staged
içerikte TR cep telefonu, checksum'u tutan 11 haneli TC ve isteğe bağlı
`pii-isimler.txt` listesindeki adları arar; eşleşme = commit durur) ve
`--repo <yol>` (tam tarama: `git ls-files` + çalışma ağacındaki `*_rapor*.md`,
`*_tara*.md`, `*_denetim*.md`, `COZUMLER.md`, `TODO.md`). Eşleşmeler **maskeli**
yazılır (`05** *** ** 33`), tam değer asla çıktıya girmez. Sentetik aileler
(`0555 111 22 33`, `05xx 123 45 67`, `05xx 000 00 00`) beyaz listededir — test ve
belgelerde yalnız bunları kullan. `pii-isimler.txt` `.gitignore`'dadır; yoksa isim
taraması sessizce atlanır.

### Sürüm bekçisi

`scripts/surum-bekcisi.mjs` 6 tüketicide `@rino/shared` spec'i + kurulu sürüm +
Next.js sürümünü bu reponun son etiketiyle karşılaştırır; sapma varsa exit 1.
launchd (`com.rino.surum-bekcisi`, her gün 07:30) çalıştırır, sonucu
`~/Library/Logs/rino/surum-bekcisi.last` dosyasına yazar. Ağa çıkmaz (`--remote`
isteğe bağlı).

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
| **İZLENEN** | `normalizeName` `phoneLast10` `normalizePhone` `titleCase` `cleanDisplayName` `categorizeEvent` `transliterateCyrillic` | pakette değil; mevcut bir tanımı kullan ya da kanonik bir yer seç |

İzlenenler ekosistemde zaten çok kopyalı ve bir kısmı **kasıtlı ürün farkı**
(`categorizeEvent`) — o yüzden "paketten import et" onlar için doğru tavsiye
değil. Güncel sayılar `scripts/duplicate-baseline.json`'da (burada tekrar
edilmiyor; bayatlıyor).

**Sayım repo bazlıdır** (`byRepo`). Böylece hook "yeni kopya BENİM repomda mı?"
sorusunu cevaplayabiliyor — global sayımla, takvim'e eklenen bir kopya
calendar-api'de commit'i kilitliyordu. Satır numarası saklanmaz; kod kayması
sahte "yeni kopya" üretmesin diye.

Yakaladığı tanım biçimleri: `function f(` · `const/let/var f =` ·
nesne-metodu kısayolu `f(a) {` · sınıf metodu (`public`/`private`/`static`/
`async` + jenerik `f<T>()` + dönüş tipi) · `f: function(…)` · `f: (a): T => …` ·
`"f": function` (tırnaklı anahtar) · `exports.f = function` · sınıf-alanı ok
fonksiyonu `private f = (s) => …`.

Yorum ve string içindeki tanımlar **sayılmaz** — `// const f = …` bırakmak
commit'i kilitlemez. Takma adlar (`const a = b`) da tanım sayılmaz.

**Commit anında çalışır.** `scripts/install-hooks.sh` 6 repoya `pre-commit`
kurar. Hook, kopya BAŞKA bir repodaysa engellemez — yalnız uyarır. Ama bekçi
mükerrer DIŞI bir sebeple patlarsa (bozuk baseline, script hatası) **fail-closed**
davranır: commit'i durdurur. Bypass: `git commit --no-verify`.

> `core.hooksPath` bilinçli olarak KULLANILMIYOR: `calendar-api`, `takvim` ve
> `asistan-panel`'de Vercel deploy izleyicisi `pre-push` hook'ları var ve
> `core.hooksPath` onları sessizce devre dışı bırakırdı. Hook doğrudan
> `.git/hooks/`'a kopyalanır — yani sürümlenmez; repo yeniden klonlanırsa
> script tekrar çalıştırılmalı.

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

### `files` alanı — `test/` ve `scripts/` tüketiciye gitmez

`package.json`'daki `"files": ["dist", "README.md"]` paketin tarball'ına yalnız bu
ikisini (+ `package.json`) koyar. **`github:` bağımlılığında da geçerlidir:** npm
git kaynağını klonlar, `prepare` (tsc) çalıştırır, sonra `npm pack` ile paketler —
`files` o pack adımında uygulanır. Yani `test/`, `scripts/`, `src/` tüketicilerin
`node_modules/@rino/shared/` altına inmez; test verisi ve bekçi script'leri
yayılmaz. Doğrulama: `npm pack --dry-run`.

### `dist/` neden git'te?

Tüketiciler `github:` ile kuruyor. `prepare: tsc` normalde `dist/`i üretir, ama
herhangi bir sebeple çalışmazsa paket kullanılamaz hale gelir. Commit'li `dist/`
bu riski kapatır. Bayat kalmaması `release.sh`'ın sorumluluğunda — o her yayında
yeniden derleyip commit'e ekler.
