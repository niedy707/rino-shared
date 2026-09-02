# TODO — rino-shared

> Son güncelleme: 02.09.2026 (`/duzelt` oturumu — rapor 02.09 bulguları işlendi).

Görev eklerken sadece başlık yazma: **ne yapılacak**, **nerede** (`dosya:satır`),
**neden bekliyor** ve varsa **engeli** belirt. Kullanıcı bir karar verdiyse kararı da yaz.

Kökteki [`../TODO.md`](../TODO.md) merkez listedir; buradaki kayıtlar onun detay
referansıdır. Bir görev kapandığında kökteki karşılığı `../TODO_done.md`'ye taşınır.

---

## Bekleyen — yayın kapısı

- [ ] **v1.3.1 yayınla** — çalışma ağacındaki düzeltmeler (NaNm→"?", GG.AA.YYYY, phoneLast10
  rakam normalizasyonu, sentetik test verisi, `files`, PII/sürüm bekçileri) commit'siz duruyor.
  `./scripts/release.sh patch` → `git push origin main --follow-tags` (`/push` skill).
  **Neden bekliyor:** commit/tag/push kullanıcı kararı. Sonra `./scripts/bump-consumers.sh v1.3.1`.
- [ ] **Git geçmişi hâlâ gerçek veri taşıyor** — HEAD sentetik ama önceki commit'lerde
  `test/phones.test.ts`, `src/phones.ts`, `dist/` içinde gerçek telefon/ad var; repo PUBLIC.
  Seçenek: `git filter-repo` + force-push (geri alınamaz, klonlar bozulur) ya da repoyu private yap.
  **Neden bekliyor:** yıkıcı işlem, kullanıcı onayı şart.

## Bekleyen — tüketici hizalaması (surum-bekcisi bunları her sabah raporlar)

- [ ] **web-panel `#main` → `#v1.3.x`** — `web-panel/package.json`; kurulu v1.0.0 (transliterasyonsuz
  `normalizeMobil` → farklı `m:` anahtarı). `./scripts/bump-consumers.sh v1.3.1 web-panel`.
- [ ] **asistan-panel'i pakete bağla** — `asistan-panel/src/app/gunluk-liste/page.tsx:72`
  `AVG_DAYS_PER_MONTH = 30.44` elle kopya. **Not:** 02.09'da başka bir ajan bağlıyor; bittiğinde
  `bump-consumers.sh` listesi zaten hazır.
- [ ] **insta-takip yerel `normalizeMobil`** — `insta-takip/app/api/vesikalik/route.js:3-11`,
  v1.0 davranışı (Kiril → `""`). Paketi bağla + import et. Bekçi artık bu repoyu görüyor (SIBLINGS).
- [ ] **calendar-api `phoneStandardize.ts:59`** — yerel `phoneLast10` `null`'da `TypeError`; kanonik
  sözleşme `''`. Tek satır: paketten re-export. Kardeş repo — ayrı karar.
- [ ] **web-panel `lib/names.ts:7,82`, `lib/fs/patientIndex.ts:20`** — `normalizeName` /
  `transliterateCyrillic` kopyaları; bekçi baseline'ına alındı (kanama durdu), temizlik ayrı iş.

## Bekleyen — bilinçli açık bırakılan

- [ ] **`normalizeMobil` Yunanca/Arapça/CJK/tam-genişlik → boş anahtar** — `src/names.ts:33,87`.
  Düzeltme (`NFKC` + yeni haritalar) anahtar migrasyonu gerektirir; önce
  `calendar-api/scripts/audit_mobil_keys.mjs` ile etki ölç. Mevcut davranış testte sabit
  (`test/names.test.ts` "BİLİNEN SINIR").
- [ ] **`npm audit` high (`nanoid`, dev-only, vitest zinciri)** — `npm audit fix` YAPMA; vitest
  major'ıyla birlikte ele al.
- [ ] **Bekçi `.d.ts` bildirimlerini tanım sayıyor** — `scripts/guard-duplicates.mjs:63` `EXTS`;
  `clinic-sync/src/lib/shared.d.ts` gibi dosyalar sayımı şişiriyor. `(?<!\.d)\.ts` + `--update`.
- [ ] **CI yok** — `.github/workflows/ci.yml` (test + tsc + `git diff --exit-code dist/`).
