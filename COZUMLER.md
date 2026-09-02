# Çözümler — rino-shared

> **Zor kazanılmış çözümler defteri.** Bir sorunu çözdükten sonra buraya yazılıp
> yazılmayacağının testi: *"Aynı sorun 3 ay sonra karşıma çıksa, çözümü yeniden
> bulmam ne kadar sürerdi?"*
>
> **Yazma:** tipo, eksik import, unutulmuş `await`, bilinen framework hatası — tek
> aramayla çıkan şeyler. Bunlar gürültüdür ve defteri okunmaz hale getirir.
>
> **Yaz:** standart dışı bir yöntem uygulandıysa · bariz çözümün neden işe yaramadığı ·
> bir aracın belgelenmemiş davranışı · bu projeye ya da ekosisteme özgü bir tuzak ·
> geri alınması pahalı bir karar.

## 02.09.2026 — `calculateControlLabel('01.01.2026','08.01.2026')` 7 gün yerine "7m" veriyordu

**Belirti:** TR biçimli (GG.AA.YYYY) tarih çifti 1 hafta yerine 7 ay etiketi üretti; hata yok, sessiz.
**Kök neden:** V8 `new Date("08.01.2026")`'yı **AA.GG.YYYY** okur (1 Ağustos). ISO dışı string
ayrıştırması spesifikasyon dışı ve motor bağımlı — noktalı biçim TR'de gün.ay, V8'de ay.gün.
**Çözüm:** `src/controlDuration.ts` `parseDate()` — `^\d{1,2}\.\d{1,2}\.\d{4}$` açıkça gün.ay.yıl
olarak `Date.UTC` ile kurulur; taşan tarih (31.02) geçersiz sayılır; ISO ve `Date` yolu değişmedi.
Aynı yerde geçersiz tarih → `NaN` → `calculateControlLabel` `"?"` (önceden `"NaNm"` panelde görünüyordu).
**Neden bariz olan işe yaramadı:** "ISO dışını reddet" (`'?'`) önerisi geçerli-ama-ISO-olmayan girdileri
(V8'in doğru okuduğu `2026/01/08` gibi) de kırardı — tüketicilerin ne gönderdiği tam bilinmiyor,
o yüzden yalnız TR biçimi özel ele alındı, kalan her şey eski `new Date(s)` yolunda kaldı.

## 02.09.2026 — PII bekçisi E.164 numarayı TC kimlik no sanıyordu

**Belirti:** `scripts/pii-bekcisi.mjs` `'+31612345678'` (Hollanda cep, testte sentetik) için `(tc)` eşleşmesi verdi.
**Kök neden:** `\b[1-9]\d{10}\b` 11 haneli her diziyi yakalar; `3161234567X (son hane gizlendi — hook bu satırı yakalamasın)` tesadüfen TC checksum'unu
da geçiyor (10. ve 11. hane kuralı ikisi de tutuyor — 1/100 olasılık, E.164 numaralarında sık).
**Çözüm:** `(?<![+\d])\b[1-9]\d{10}\b` — `+` ya da rakamla öncelenen dizi TC sayılmaz.
**Neden bariz olan işe yaramadı:** Checksum'u sıkılaştırmak yetmez (zaten iki kural da uygulanıyor);
bağlam (öndeki `+`) tek ayırt edici.

## 02.09.2026 — guard-duplicates SIBLINGS'e repo eklemek bekçiyi "yeni kopya" diye kilitledi

**Belirti:** `web-panel` ve `insta-takip` SIBLINGS'e eklenince bekçi 4 fonksiyonda ❌ verdi, oysa kod değişmedi.
**Kök neden:** baseline repo bazlı; yeni repo için girdi yok → mevcut kopyaları "artış" sayar. Tasarım gereği.
**Çözüm:** `node scripts/guard-duplicates.mjs --update` — ek repolar baseline'a **eklenir**, mevcut 5 reponun
32 girdisi birebir aynı kalır (diff ile doğrulandı). Bu "kanamayı durdur" felsefesiyle uyumlu: yeni görülen
kopyalar temizlenmez, yalnız artmaları engellenir.
**Neden bariz olan işe yaramadı:** Baseline'ı elle yazmak (`_not` alanı da uyarıyor) sayımı bozar; `--update` tek yol.

<!-- Yeni girişler EN ÜSTE eklenir (en yeni önce). Biçim:

## GG.AA.YYYY — <sorun tek cümlede>

**Belirti:** Ne görüldü — hata mesajı, yanlış çıktı ya da sessiz başarısızlık.
**Kök neden:** Belirtinin kendisi değil, altındaki gerçek sebep.
**Çözüm:** Ne yapıldı — `dosya:satır`, komut, ayar.
**Neden bariz olan işe yaramadı:** Denenip elenen yollar. Bu kısım defterin asıl değeridir;
boş bırakılırsa giriş büyük ölçüde anlamsızlaşır.

-->
