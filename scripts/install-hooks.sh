#!/usr/bin/env bash
#
# Bekçi pre-commit hook'unu kardeş repolara kurar.
#
# NEDEN core.hooksPath KULLANMIYOR: calendar-api, takvim ve asistan-panel'de
# zaten bir `pre-push` hook'u var (Vercel deploy izleyicisi). core.hooksPath ayarlamak
# .git/hooks'u TAMAMEN devre dışı bırakır ve o hook'lar sessizce çalışmaz olur.
# Bu yüzden doğrudan .git/hooks/pre-commit'e kopyalıyoruz — mevcut hook'lara
# dokunmadan.
#
# Kullanım:
#   ./scripts/install-hooks.sh              # tüm kardeş repolar
#   ./scripts/install-hooks.sh calendar-api # yalnız biri
#   DRY=1 ./scripts/install-hooks.sh        # sadece göster

set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
SRC="$HERE/hooks/pre-commit"
PROJECTS_ROOT="$(cd "$HERE/../.." && pwd)"

[ -f "$SRC" ] || { echo "❌ Şablon yok: $SRC" >&2; exit 1; }

if [ -n "${1:-}" ]; then
  TARGETS=("$1")
else
  # guard-duplicates.mjs SIBLINGS listesiyle aynı olmalı + rino-shared.
  TARGETS=(calendar-api clinic-sync takvim asistan-panel mobil-panel rino-shared)
fi

for proj in "${TARGETS[@]}"; do
  DIR="$PROJECTS_ROOT/$proj"
  HOOK="$DIR/.git/hooks/pre-commit"

  if [ ! -d "$DIR/.git" ]; then
    echo "  ⊘ $proj: git reposu değil, atlanıyor"
    continue
  fi

  if [ -f "$HOOK" ] && ! grep -q "guard-duplicates" "$HOOK" 2>/dev/null; then
    echo "  ⚠ $proj: BAŞKA bir pre-commit hook'u var — ÜZERİNE YAZILMADI"
    echo "      mevcut: $HOOK"
    echo "      elle birleştir ya da önce yedekle"
    continue
  fi

  if [ -n "${DRY:-}" ]; then
    echo "  → $proj: kurulacak ($HOOK)"
    continue
  fi

  cp "$SRC" "$HOOK"
  chmod +x "$HOOK"
  echo "  ✅ $proj: pre-commit kuruldu"
done

if [ -n "${DRY:-}" ]; then
  echo
  echo "(DRY=1 — hiçbir şey değiştirilmedi)"
  exit 0
fi

echo
echo "Kurulum bitti. Not: .git/hooks sürümlenmez — repo yeniden klonlanırsa"
echo "bu script tekrar çalıştırılmalı. Mevcut pre-push hook'larına dokunulmadı."
