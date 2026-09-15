#!/usr/bin/env bash
# Piston（コード実行サンドボックス）を起動し、対応言語のランタイムを導入して /runtimes を確認する。
# backend-todo 4-2: コンテナ起動直後はランタイムが無いため、手動 curl を不要にする。
#
#   bash scripts/setup-piston.sh
#   PISTON_URL=http://127.0.0.1:2000/api/v2 DENO_VERSION=1.32.3 PYTHON_VERSION=3.12.0 bash scripts/setup-piston.sh
#   # 特定の言語だけ入れたいとき（"言語:バージョン" のカンマ区切り）
#   PISTON_PACKAGES=python:3.12.0 bash scripts/setup-piston.sh
#   # 公開版（Caddy + 共有キー、VPS や Quick Tunnel 用）。Piston 本体は 127.0.0.1:2000 に束縛されるので PISTON_URL は既定のままでよい。
#   PISTON_API_KEY=... COMPOSE_FILE=piston/docker-compose.public.yml bash scripts/setup-piston.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMPOSE_FILE="${COMPOSE_FILE:-${SCRIPT_DIR}/../piston/docker-compose.yml}"
PISTON_URL="${PISTON_URL:-http://127.0.0.1:2000/api/v2}"
PISTON_URL="${PISTON_URL%/}"
DENO_VERSION="${DENO_VERSION:-1.32.3}"
PYTHON_VERSION="${PYTHON_VERSION:-3.12.0}"
# 導入する言語の一覧（"言語:バージョン" のカンマ区切り）。
# deno は TypeScript のお題、python は Python のお題の実行に使う。
PISTON_PACKAGES="${PISTON_PACKAGES:-deno:${DENO_VERSION},python:${PYTHON_VERSION}}"
WAIT_SECONDS="${WAIT_SECONDS:-60}"

if ! command -v docker >/dev/null 2>&1; then
  echo "docker コマンドが見つかりません。Docker Desktop をインストール・起動してください。" >&2
  exit 1
fi
if ! command -v curl >/dev/null 2>&1; then
  echo "curl コマンドが見つかりません。" >&2
  exit 1
fi

echo "[1/3] Piston コンテナを起動します (${COMPOSE_FILE})"
docker compose -f "${COMPOSE_FILE}" up -d

echo "[2/3] Piston API の起動を待ちます (${PISTON_URL}/runtimes, 最大 ${WAIT_SECONDS} 秒)"
for ((i = 1; i <= WAIT_SECONDS; i++)); do
  if curl -fsS --max-time 5 "${PISTON_URL}/runtimes" >/dev/null 2>&1; then
    break
  fi
  if ((i == WAIT_SECONDS)); then
    echo "Piston API が ${WAIT_SECONDS} 秒以内に応答しませんでした。docker compose -f ${COMPOSE_FILE} logs を確認してください。" >&2
    exit 1
  fi
  sleep 1
done

# /runtimes の返し方が言語ごとに違う点に注意。
# deno は language="typescript", runtime="deno" として返るので runtime で判定する必要があり、
# python は language="python" として返るので language で判定する。
has_runtime() {
  local runtimes="$1" lang="$2"
  if [[ "${lang}" == "deno" ]]; then
    grep -q '"runtime":"deno"' <<<"${runtimes}"
  else
    grep -q "\"language\":\"${lang}\"" <<<"${runtimes}"
  fi
}

runtimes="$(curl -fsS --max-time 5 "${PISTON_URL}/runtimes")"

echo "[3/3] 必要なランタイムを導入します: ${PISTON_PACKAGES}"
IFS=',' read -ra packages <<<"${PISTON_PACKAGES}"
for package in "${packages[@]}"; do
  lang="${package%%:*}"
  version="${package##*:}"
  if [[ -z "${lang}" || -z "${version}" || "${lang}" == "${package}" ]]; then
    echo "PISTON_PACKAGES の書式が不正です: '${package}'（正しくは 言語:バージョン）" >&2
    exit 1
  fi
  if has_runtime "${runtimes}" "${lang}"; then
    echo "  - ${lang} は導入済みです。"
    continue
  fi
  echo "  - ${lang} ${version} をインストールします（数分かかることがあります）"
  # Piston はパッケージ導入を同期で処理するため、タイムアウトは長めにとる。
  # /packages への POST にバージョンの "*" は使えないので、必ず具体的な値を渡すこと。
  if ! curl -fsS --max-time 900 -X POST "${PISTON_URL}/packages" \
    -H 'content-type: application/json' \
    -d "{\"language\":\"${lang}\",\"version\":\"${version}\"}"; then
    echo "${lang} ${version} のインストールに失敗しました。利用可能なバージョンは ${PISTON_URL}/packages で確認できます（${lang} のバージョンはインデックスによって異なります）。" >&2
    exit 1
  fi
  echo
  runtimes="$(curl -fsS --max-time 5 "${PISTON_URL}/runtimes")"
done

echo "導入済みランタイム:"
echo "${runtimes}"
for package in "${packages[@]}"; do
  lang="${package%%:*}"
  if ! has_runtime "${runtimes}" "${lang}"; then
    echo "インストール後も ${lang} が /runtimes に現れません。" >&2
    exit 1
  fi
done
if [[ "${COMPOSE_FILE}" == *docker-compose.public.yml ]]; then
  echo "完了。Vercel の環境変数に PISTON_API_URL=<公開URL>/api/v2 と PISTON_API_KEY（compose に渡した値）を設定してください。"
else
  echo "完了。PISTON_API_URL=${PISTON_URL} を .env.local に設定してください。"
fi
