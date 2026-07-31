#!/usr/bin/env bash
#
# BUMP-CONSUMERS — tüketici projeleri belirli bir @rino/shared ETİKETİNE taşı.
#
# Neden var: bugün 4 proje de `github:niedy707/rino-shared#main` kullanıyor —
# sürüm sabitlemesi YOK. Sonuç (2026-07-31'de ölçüldü): takvim 13 Temmuz'daki bir
# build'de kilitliyken diğer üçü 18 Temmuz'daydı; dördü de package.json'da
# "1.0.0" görüyordu. md5'ler farklıydı, takvim'in kopyasında normalizeMobil HİÇ
# YOKTU ve hiçbir araç bunu göstermiyordu — "aynı etiket, farklı kod".
#
# Etikete sabitlemek sapmayı GÖRÜNÜR kılar: `npm ls @rino/shared` artık her
# projede gerçek sürümü söyler ve yükseltme bilinçli, tarihli, geri alınabilir olur.
#
# Kullanım:
#   ./scripts/bump-consumers.sh v1.2.0          # tümünü taşı
#   ./scripts/bump-consumers.sh v1.2.0 takvim   # yalnız birini taşı
#   DRY=1 ./scripts/bump-consumers.sh v1.2.0    # sadece göster, değiştirme

set -euo pipefail

TAG="${1:-}"
if [[ -z "$TAG" ]]; then
  echo "Kullanım: ./scripts/bump-consumers.sh <vX.Y.Z> [proje]" >&2
  exit 1
fi
[[ "$TAG" == v* ]] || TAG="v$TAG"

PROJECTS_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
DEP="github:niedy707/rino-shared#${TAG}"

if [[ -n "${2:-}" ]]; then
  TARGETS=("$2")
else
  TARGETS=(calendar-api clinic-sync takvim mobil-panel)
fi

echo "▸ Hedef: ${DEP}"
echo

for proj in "${TARGETS[@]}"; do
  DIR="${PROJECTS_ROOT}/${proj}"
  PKG="${DIR}/package.json"

  if [[ ! -f "$PKG" ]]; then
    echo "  ⊘ ${proj}: bulunamadı, atlanıyor"
    continue
  fi
  if ! grep -q '"@rino/shared"' "$PKG"; then
    echo "  ⊘ ${proj}: @rino/shared bağımlılığı yok, atlanıyor"
    continue
  fi

  CURRENT="$(node -p "require('${PKG}').dependencies['@rino/shared']")"
  if [[ "$CURRENT" == "$DEP" ]]; then
    echo "  = ${proj}: zaten ${TAG}"
    continue
  fi

  echo "  → ${proj}: ${CURRENT}  ⟶  ${TAG}"
  if [[ -n "${DRY:-}" ]]; then continue; fi

  ( cd "$DIR" \
    && npm pkg set "dependencies.@rino/shared=${DEP}" \
    && npm install --no-audit --no-fund --silent )
done

echo
if [[ -n "${DRY:-}" ]]; then
  echo "(DRY=1 — hiçbir şey değiştirilmedi)"
  exit 0
fi

echo "✅ Bitti. ŞİMDİ HER PROJEDE DOĞRULA:"
echo "     npm ls @rino/shared      # sürüm görünür olmalı"
echo "     npm run build            # derleme geçmeli"
echo
echo "Sonra package.json + package-lock.json değişikliklerini commit et."
