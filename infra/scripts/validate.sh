#!/usr/bin/env bash
# infra/** doğrulaması: LF satır sonu, shellcheck, actionlint, docker compose config.
# Yerelde (Git Bash/WSL/Linux) ve CI'da aynı şekilde çalışır. shellcheck/actionlint kurulu
# değilse Docker imajıyla çalıştırılır.
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$repo_root"

shellcheck_image="koalaman/shellcheck:v0.11.0"
actionlint_image="rhysd/actionlint:1.7.7"
failed=0

# Git Bash'te Docker'a Windows biçiminde yol ver.
mount_path="$repo_root"
if command -v cygpath >/dev/null 2>&1; then
  mount_path="$(cygpath -m "$repo_root")"
fi
export MSYS_NO_PATHCONV=1

step() { printf '\n==> %s\n' "$*"; }

step "LF satır sonu"
mapfile -t files < <(git ls-files 'infra/**' ':!infra/**/node_modules/**' 2>/dev/null || find infra -type f)
for f in "${files[@]}"; do
  [[ -f "$f" ]] || continue
  if grep -Iq $'\r' "$f"; then
    echo "CRLF bulundu: $f" >&2
    failed=1
  fi
done
# git henüz izlemiyorsa (yeni dosyalar) çalışma ağacını da tara.
while IFS= read -r f; do
  if grep -Iq $'\r' "$f"; then
    echo "CRLF bulundu: $f" >&2
    failed=1
  fi
done < <(find infra -type f \( -name '*.sh' -o -name '*.yml' -o -name '*.env' -o -name '*.example' -o -name '*.service' -o -name '*.timer' -o -name '*.md' \))

step "shellcheck"
mapfile -t scripts < <(find infra -type f -name '*.sh' | sort)
if command -v shellcheck >/dev/null 2>&1; then
  shellcheck -x "${scripts[@]}" || failed=1
else
  docker run --rm -v "$mount_path:/mnt" -w /mnt "$shellcheck_image" -x "${scripts[@]}" || failed=1
fi

# .github/workflows altındaki tüm workflow'lar + servis şablonunun workflow şablonu.
step "actionlint"
if command -v actionlint >/dev/null 2>&1; then
  actionlint .github/workflows/*.yml infra/templates/fastapi-service/workflow.yml || failed=1
else
  docker run --rm -v "$mount_path:/repo" -w /repo "$actionlint_image" -color \
    .github/workflows/*.yml infra/templates/fastapi-service/workflow.yml || failed=1
fi

step "docker compose config"
compose_check() {
  if docker compose "$@" config -q; then
    echo "ok: $*"
  else
    echo "HATA: docker compose $*" >&2
    failed=1
  fi
}
compose_check -f infra/core/compose.yml
compose_check -f infra/core/compose.yml -f infra/core/compose.local.yml
compose_check --env-file infra/local.env -f infra/core/compose.yml -f infra/core/compose.local.yml
compose_check -f infra/apps/_template/compose.yml
compose_check -f infra/templates/fastapi-service/compose.yml
for f in infra/apps/*/compose.yml infra/monitoring/compose.yml; do
  [[ "$f" == "infra/apps/_template/compose.yml" ]] && continue
  compose_check --env-file infra/local.env -f "$f"
done

if [[ $failed -ne 0 ]]; then
  printf '\nDoğrulama BAŞARISIZ.\n' >&2
  exit 1
fi
printf '\nDoğrulama başarılı.\n'
