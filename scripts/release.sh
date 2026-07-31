#!/usr/bin/env bash
#
# RELEASE — @rino/shared sürüm yayınlama (TEK KOMUT).
#
# Neden var: bu paket 2026-07'de tam olarak "tören" yüzünden öldü. Bir fonksiyonu
# değiştirmenin bedeli 6 adımdı (düzenle → tsc → src+dist commit → push → 4 projede
# npm install → 4 lockfile commit) ve kopyala-yapıştır 1 adımdı. Kazanan hep kolay
# olan oldu. Bu script yayınlama tarafını 1 adıma indirir.
#
# Kullanım:
#   ./scripts/release.sh patch      # 1.1.0 → 1.1.1
#   ./scripts/release.sh minor      # 1.1.0 → 1.2.0
#   ./scripts/release.sh major      # 1.1.0 → 2.0.0
#   ./scripts/release.sh 1.4.2      # açık sürüm
#
# Yayın SONRASI tüketicileri taşımak için: ./scripts/bump-consumers.sh v1.2.0

set -euo pipefail
cd "$(dirname "$0")/.."

BUMP="${1:-}"
if [[ -z "$BUMP" ]]; then
  echo "Kullanım: ./scripts/release.sh <patch|minor|major|X.Y.Z>" >&2
  exit 1
fi

echo "▸ Çalışma ağacı temiz mi?"
if [[ -n "$(git status --porcelain)" ]]; then
  echo "❌ Commit edilmemiş değişiklik var. Önce commit et." >&2
  git status --short >&2
  exit 1
fi

echo "▸ Testler"
npm test

echo "▸ Bekçi (mükerrer tanım sayısı artmasın)"
node scripts/guard-duplicates.mjs

echo "▸ Derleme (dist tazeleniyor)"
npm run build

# dist/ git'te izleniyor: tüketiciler `github:` ile kurduğu için prepare
# çalışmazsa bile paket kullanılabilir olmalı. Derleme sonrası dist değiştiyse
# commit'e dahil et — "bayat dist" hatası bu yüzden imkânsız hale gelir.
if [[ -n "$(git status --porcelain dist/)" ]]; then
  echo "▸ dist/ değişti — commit'e ekleniyor"
  git add dist/
fi

echo "▸ Sürüm: $BUMP"
NEW_VERSION="$(npm version "$BUMP" --no-git-tag-version)"   # örn. v1.2.0
NEW_VERSION="${NEW_VERSION#v}"

git add package.json package-lock.json dist/ 2>/dev/null || true
git commit -m "release: v${NEW_VERSION}"
git tag -a "v${NEW_VERSION}" -m "v${NEW_VERSION}"

echo
echo "✅ v${NEW_VERSION} hazır (LOKAL)."
echo
echo "Yayınla:"
echo "  git push origin main --follow-tags"
echo
echo "Sonra tüketicileri taşı:"
echo "  ./scripts/bump-consumers.sh v${NEW_VERSION}"
