# Piston（コード実行サンドボックス）を起動し、対応言語のランタイムを導入して /runtimes を確認する。
# backend-todo 4-2: scripts/setup-piston.sh の Windows PowerShell 版。
#
#   pwsh scripts/setup-piston.ps1
#   pwsh scripts/setup-piston.ps1 -PistonUrl http://127.0.0.1:2000/api/v2 -DenoVersion 1.32.3 -PythonVersion 3.12.0
#   # 特定の言語だけ入れたいとき
#   pwsh scripts/setup-piston.ps1 -Packages @("python:3.12.0")
#   # 公開版（Caddy + 共有キー）。Piston 本体は 127.0.0.1:2000 に束縛されるので PistonUrl は既定のままでよい。
#   $env:PISTON_API_KEY = "..."; pwsh scripts/setup-piston.ps1 -ComposeFile piston/docker-compose.public.yml
param(
  [string]$PistonUrl = "http://127.0.0.1:2000/api/v2",
  [string]$DenoVersion = "1.32.3",
  [string]$PythonVersion = "3.12.0",
  # 導入する言語（"言語:バージョン"）。未指定なら deno と python の両方を入れる。
  [string[]]$Packages = @(),
  [int]$WaitSeconds = 60,
  [string]$ComposeFile = ""
)

$ErrorActionPreference = "Stop"
$composeFile = if ($ComposeFile) { $ComposeFile } else { Join-Path $PSScriptRoot "..\piston\docker-compose.yml" }
$base = $PistonUrl.TrimEnd('/')
if ($Packages.Count -eq 0) {
  $Packages = @("deno:$DenoVersion", "python:$PythonVersion")
}

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

# /runtimes の返し方が言語ごとに違う。
# deno は language="typescript", runtime="deno" として返るため runtime で判定し、
# python は language="python" として返るため language で判定する。
function Test-Runtime($list, [string]$Language) {
  if ($Language -eq "deno") {
    return [bool]($list | Where-Object { $_.runtime -eq "deno" })
  }
  return [bool]($list | Where-Object { $_.language -eq $Language })
}

Write-Host "[3/3] 必要なランタイムを導入します: $($Packages -join ', ')"
foreach ($package in $Packages) {
  $parts = $package.Split(":")
  if ($parts.Count -ne 2 -or -not $parts[0] -or -not $parts[1]) {
    throw "Packages の書式が不正です: '$package'（正しくは 言語:バージョン）。"
  }
  $language = $parts[0]
  $version = $parts[1]
  if (Test-Runtime $runtimes $language) {
    Write-Host "  - $language は導入済みです。"
    continue
  }
  Write-Host "  - $language $version をインストールします（数分かかることがあります）"
  try {
    # /packages への POST にバージョンの "*" は使えないので、必ず具体的な値を渡すこと。
    Invoke-RestMethod -Method Post -Uri "$base/packages" -ContentType "application/json" `
      -Body (@{ language = $language; version = $version } | ConvertTo-Json -Compress) -TimeoutSec 900 | Out-Null
  } catch {
    throw "$language $version のインストールに失敗しました: $($_.Exception.Message)。利用可能なバージョンは $base/packages で確認できます（バージョンはインデックスによって異なります）。"
  }
  $runtimes = Invoke-RestMethod -Method Get -Uri "$base/runtimes" -TimeoutSec 5
}

Write-Host "導入済みランタイム:"
$runtimes | ConvertTo-Json -Depth 5
foreach ($package in $Packages) {
  $language = $package.Split(":")[0]
  if (-not (Test-Runtime $runtimes $language)) {
    throw "インストール後も $language が /runtimes に現れません。"
  }
}
if ($composeFile -like "*docker-compose.public.yml") {
  Write-Host "完了。Vercel の環境変数に PISTON_API_URL=<公開URL>/api/v2 と PISTON_API_KEY（compose に渡した値）を設定してください。"
} else {
  Write-Host "完了。PISTON_API_URL=$base を .env.local に設定してください。"
}
