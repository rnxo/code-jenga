# デモ用: ローカル Docker の Piston を cloudflared Quick Tunnel で公開し、Vercel から使えるようにする。
# VPS を借りずに無料で済ませるための構成（チーム方針、2026-09-15）。
#
#   pwsh scripts/start-demo-tunnel.ps1               # 起動 → トンネル → Vercel 環境変数更新 → 再デプロイ
#   pwsh scripts/start-demo-tunnel.ps1 -SkipVercel   # Vercel は触らず、設定すべき値を表示するだけ
#   pwsh scripts/start-demo-tunnel.ps1 -NoDeploy     # 環境変数は更新するが再デプロイしない
#
# 仕組み:
#   1. piston/docker-compose.public.yml を起動（Caddy が X-Piston-Key で保護、Piston 本体は 127.0.0.1:2000 のみ）
#   2. deno ランタイムが無ければ導入（scripts/setup-piston.ps1）
#   3. cloudflared のポータブル版を %LOCALAPPDATA%\code-jenga に取得し、Quick Tunnel で http://127.0.0.1:80 を公開
#   4. 発行された https://xxxx.trycloudflare.com を PISTON_API_URL として Vercel に登録し、再デプロイ
#   5. Ctrl+C で終了するまでトンネルを維持（Docker コンテナは残す）
#
# Quick Tunnel は起動ごとに URL が変わるため、デモの前に毎回このスクリプトを実行する。
# 共有キーは %LOCALAPPDATA%\code-jenga\piston-api-key.txt に保存して使い回す（Vercel 側の更新は初回のみで済む）。
param(
  [switch]$SkipVercel,
  [switch]$NoDeploy,
  [string]$VercelEnvTarget = "production",
  [int]$TunnelWaitSeconds = 60
)

$ErrorActionPreference = "Stop"
$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$composeFile = Join-Path $repoRoot "piston\docker-compose.public.yml"
$toolDir = Join-Path $env:LOCALAPPDATA "code-jenga"
$cloudflared = Join-Path $toolDir "cloudflared.exe"
$keyFile = Join-Path $toolDir "piston-api-key.txt"
$localPistonUrl = "http://127.0.0.1:2000/api/v2"

New-Item -ItemType Directory -Force $toolDir | Out-Null

# --- 1. 共有キー（初回に生成して保存） ---
if (Test-Path $keyFile) {
  $apiKey = (Get-Content $keyFile -Raw).Trim()
} else {
  $bytes = New-Object byte[] 32
  [System.Security.Cryptography.RandomNumberGenerator]::Fill($bytes)
  $apiKey = ($bytes | ForEach-Object { $_.ToString("x2") }) -join ""
  Set-Content -Path $keyFile -Value $apiKey -NoNewline
  Write-Host "共有キーを生成して保存しました: $keyFile"
}
if (-not $apiKey) { throw "共有キーが空です。$keyFile を削除して再実行してください。" }

# --- 2. Piston + Caddy 起動、deno 導入 ---
Write-Host "[1/4] Piston（公開版）を起動します"
$env:PISTON_API_KEY = $apiKey
& (Join-Path $PSScriptRoot "setup-piston.ps1") -ComposeFile $composeFile -PistonUrl $localPistonUrl

$headers = @{ "X-Piston-Key" = $apiKey }
try {
  Invoke-RestMethod -Method Get -Uri "http://127.0.0.1/api/v2/runtimes" -Headers $headers -TimeoutSec 10 | Out-Null
} catch {
  throw "Caddy 経由（http://127.0.0.1/api/v2/runtimes）で Piston に到達できません: $($_.Exception.Message)。docker compose -f $composeFile logs caddy を確認してください。"
}

# --- 3. cloudflared 取得と Quick Tunnel 起動 ---
if (-not (Test-Path $cloudflared)) {
  Write-Host "[2/4] cloudflared（ポータブル版）をダウンロードします → $cloudflared"
  Invoke-WebRequest -Uri "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe" -OutFile $cloudflared
} else {
  Write-Host "[2/4] cloudflared は取得済みです ($cloudflared)"
}

$tunnelLog = Join-Path $toolDir "cloudflared.log"
if (Test-Path $tunnelLog) { Remove-Item $tunnelLog -Force }
$tunnel = Start-Process -FilePath $cloudflared `
  -ArgumentList @("tunnel", "--url", "http://127.0.0.1:80", "--no-autoupdate") `
  -RedirectStandardError $tunnelLog -PassThru -NoNewWindow

$publicUrl = $null
for ($i = 1; $i -le $TunnelWaitSeconds; $i++) {
  if ($tunnel.HasExited) { throw "cloudflared が終了しました。ログ: $tunnelLog" }
  if (Test-Path $tunnelLog) {
    $m = Select-String -Path $tunnelLog -Pattern "https://[a-z0-9-]+\.trycloudflare\.com" | Select-Object -First 1
    if ($m) { $publicUrl = $m.Matches[0].Value; break }
  }
  Start-Sleep -Seconds 1
}
if (-not $publicUrl) {
  Stop-Process -Id $tunnel.Id -Force -ErrorAction SilentlyContinue
  throw "Quick Tunnel の URL が $TunnelWaitSeconds 秒以内に取得できませんでした。ログ: $tunnelLog"
}
$pistonApiUrl = "$publicUrl/api/v2"

# トンネル経由で到達できるか確認（DNS 伝播で数秒かかることがある）
$reachable = $false
for ($i = 1; $i -le 20; $i++) {
  try {
    Invoke-RestMethod -Method Get -Uri "$pistonApiUrl/runtimes" -Headers $headers -TimeoutSec 10 | Out-Null
    $reachable = $true; break
  } catch { Start-Sleep -Seconds 2 }
}
if (-not $reachable) {
  Stop-Process -Id $tunnel.Id -Force -ErrorAction SilentlyContinue
  throw "トンネル経由（$pistonApiUrl/runtimes）で Piston に到達できませんでした。"
}
Write-Host "[3/4] トンネル公開中: $pistonApiUrl"

# --- 4. Vercel 環境変数の更新と再デプロイ ---
function Set-VercelEnv([string]$name, [string]$value) {
  # 既存値があれば削除してから追加する（vercel env には上書きが無い）
  & vercel env rm $name $VercelEnvTarget --yes 2>$null | Out-Null
  $value | & vercel env add $name $VercelEnvTarget | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "vercel env add $name に失敗しました（exit $LASTEXITCODE）。vercel login / vercel link を確認してください。" }
}

if ($SkipVercel) {
  Write-Host "[4/4] Vercel の更新はスキップしました。ダッシュボードで次の値を設定してください:"
} else {
  $vercelReady = $false
  if (Get-Command vercel -ErrorAction SilentlyContinue) {
    & vercel whoami 2>&1 | Out-Null
    $vercelReady = ($LASTEXITCODE -eq 0) -and (Test-Path (Join-Path $repoRoot ".vercel\project.json"))
  }
  if (-not $vercelReady) {
    Write-Warning "vercel CLI が未ログインか、プロジェクトが未リンクです（vercel login → vercel link）。手動で次の値を設定してください:"
  } else {
    Write-Host "[4/4] Vercel の環境変数（$VercelEnvTarget）を更新します"
    Push-Location $repoRoot
    try {
      Set-VercelEnv "PISTON_API_URL" $pistonApiUrl
      Set-VercelEnv "PISTON_API_KEY" $apiKey
      if ($NoDeploy) {
        Write-Host "再デプロイはスキップしました（-NoDeploy）。環境変数は次のデプロイから反映されます。"
      } else {
        Write-Host "再デプロイします（環境変数はデプロイ時に焼き込まれるため必須）"
        & vercel --prod --yes
        if ($LASTEXITCODE -ne 0) { throw "vercel --prod に失敗しました（exit $LASTEXITCODE）。" }
      }
    } finally { Pop-Location }
  }
}

Write-Host ""
Write-Host "  PISTON_API_URL = $pistonApiUrl"
Write-Host "  PISTON_API_KEY = $apiKey"
Write-Host ""
Write-Host "トンネルを維持しています。デモが終わったら Ctrl+C で終了してください（Docker コンテナは残ります）。"
try {
  Wait-Process -Id $tunnel.Id
} finally {
  if (-not $tunnel.HasExited) { Stop-Process -Id $tunnel.Id -Force -ErrorAction SilentlyContinue }
  Write-Host "トンネルを停止しました。Piston を止める場合: docker compose -f $composeFile down"
}
