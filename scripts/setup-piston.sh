#!/usr/bin/env bash
# Piston（コード実行サンドボックス）を起動し、deno ランタイムを導入して /runtimes を確認する。
# backend-todo 4-2: コンテナ起動直後はランタイムが無いため、手動 curl を不要にする。
#
#   bash scripts/setup-piston.sh
#   PISTON_URL=http://127.0.0.1:2000/api/v2 DENO_VERSION=1.32.3 bash scripts/setup-piston.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMPOSE_FILE="${SCRIPT_DIR}/../piston/docker-compose.yml"
PISTON_URL="${PISTON_URL:-http://127.0.0.1:2000/api/v2}"
PISTON_URL="${PISTON_URL%/}"
DENO_VERSION="${DENO_VERSION:-1.32.3}"
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

# /runtimes では deno は language="typescript", runtime="deno" として返るため runtime で判定する。
has_deno() { grep -q '"runtime":"deno"' <<<"$1"; }

runtimes="$(curl -fsS --max-time 5 "${PISTON_URL}/runtimes")"
if has_deno "${runtimes}"; then
  echo "deno ランタイムは導入済みです。"
else
  echo "[3/3] deno ${DENO_VERSION} をインストールします（数分かかることがあります）"
  # Piston はパッケージ導入を同期で処理するため、タイムアウトは長めにとる。
  if ! curl -fsS --max-time 900 -X POST "${PISTON_URL}/packages" \
    -H 'content-type: application/json' \
    -d "{\"language\":\"deno\",\"version\":\"${DENO_VERSION}\"}"; then
    echo "deno ${DENO_VERSION} のインストールに失敗しました。利用可能なバージョンは ${PISTON_URL}/packages で確認できます。" >&2
    exit 1
  fi
  echo
  runtimes="$(curl -fsS --max-time 5 "${PISTON_URL}/runtimes")"
fi

echo "導入済みランタイム:"
echo "${runtimes}"
if ! has_deno "${runtimes}"; then
  echo "インストール後も deno が /runtimes に現れません。" >&2
  exit 1
fi
echo "完了。PISTON_API_URL=${PISTON_URL} を .env.local に設定してください。"
