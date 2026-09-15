# Piston（コード実行サンドボックス）を起動し、deno ランタイムを導入して /runtimes を確認する。
# backend-todo 4-2: scripts/setup-piston.sh の Windows PowerShell 版。
#
#   pwsh scripts/setup-piston.ps1
#   pwsh scripts/setup-piston.ps1 -PistonUrl http://127.0.0.1:2000/api/v2 -DenoVersion 1.32.3
param(
  [string]$PistonUrl = "http://127.0.0.1:2000/api/v2",
  [string]$DenoVersion = "1.32.3",
  [int]$WaitSeconds = 60
)

$ErrorActionPreference = "Stop"
$composeFile = Join-Path $PSScriptRoot "..\piston\docker-compose.yml"
$base = $PistonUrl.TrimEnd('/')

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
  throw "docker コマンドが見つかりません。Docker Desktop をインストール・起動してください。"
}

Write-Host "[1/3] Piston コンテナを起動します ($composeFile)"
docker compose -f $composeFile up -d
if ($LASTEXITCODE -ne 0) { throw "docker compose up に失敗しました（exit $LASTEXITCODE）。" }

Write-Host "[2/3] Piston API の起動を待ちます ($base/runtimes, 最大 $WaitSeconds 秒)"
$runtimes = $null
for ($i = 1; $i -le $WaitSeconds; $i++) {
  try {
    $runtimes = Invoke-RestMethod -Method Get -Uri "$base/runtimes" -TimeoutSec 5
    break
  } catch {
    if ($i -eq $WaitSeconds) {
      throw "Piston API が $WaitSeconds 秒以内に応答しませんでした。docker compose -f $composeFile logs を確認してください。"
    }
    Start-Sleep -Seconds 1
  }
}

# /runtimes では deno は language="typescript", runtime="deno" として返るため runtime で判定する。
function Test-DenoRuntime($list) { return [bool]($list | Where-Object { $_.runtime -eq "deno" }) }

if (Test-DenoRuntime $runtimes) {
  Write-Host "deno ランタイムは導入済みです。"
} else {
  Write-Host "[3/3] deno $DenoVersion をインストールします（数分かかることがあります）"
  try {
    Invoke-RestMethod -Method Post -Uri "$base/packages" -ContentType "application/json" `
      -Body (@{ language = "deno"; version = $DenoVersion } | ConvertTo-Json -Compress) -TimeoutSec 900 | Out-Null
  } catch {
    throw "deno $DenoVersion のインストールに失敗しました: $($_.Exception.Message)。利用可能なバージョンは $base/packages で確認できます。"
  }
  $runtimes = Invoke-RestMethod -Method Get -Uri "$base/runtimes" -TimeoutSec 5
}

Write-Host "導入済みランタイム:"
$runtimes | ConvertTo-Json -Depth 5
if (-not (Test-DenoRuntime $runtimes)) {
  throw "インストール後も deno が /runtimes に現れません。"
}
Write-Host "完了。PISTON_API_URL=$base を .env.local に設定してください。"
